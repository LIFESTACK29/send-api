import { Response } from "express";
import mongoose from "mongoose";
import { AuthRequest } from "../../types/user.type";
import { CatchAsync } from "../../utils/catchasync.util";
import Settlement from "../../models/settlement.model";
import Ride from "../../models/ride.model";
import Wallet from "../../models/wallet.model";
import Transaction from "../../models/transaction.model";
import BankAccount from "../../models/bank-account.model";
import {
    initiateTransfer,
    getPlatformBalance,
} from "../../services/paystack.service";
import { emitToRoom } from "../../services/socket.service";

// POST /api/v1/admin/settlements
export const createSettlement = CatchAsync(async (req: AuthRequest, res: Response) => {
    const { riderId, rideIds } = req.body;
    if (!riderId) {
        res.status(400).json({ message: "riderId is required" });
        return;
    }

    const bankAccount = await BankAccount.findOne({ userId: riderId });
    if (!bankAccount) {
        res.status(409).json({ code: "NO_BANK_ACCOUNT", message: "Rider has no bank account" });
        return;
    }

    // Determine rides to settle
    const rideFilter: Record<string, any> = {
        assignedRiderId: riderId,
        status: "COMPLETED",
        settlementId: null,
    };
    if (rideIds && Array.isArray(rideIds) && rideIds.length > 0) {
        rideFilter._id = { $in: rideIds };
    }

    const rides = await Ride.find(rideFilter);
    if (rides.length === 0) {
        res.status(400).json({ message: "No unsettled rides found for this rider" });
        return;
    }

    const settlementAmountKobo = rides.reduce((sum, r) => sum + (r.riderPayoutAmount ?? 0), 0);
    if (settlementAmountKobo === 0) {
        res.status(400).json({ message: "Total settlement amount is zero" });
        return;
    }

    // Check Paystack platform balance
    const balanceResp = await getPlatformBalance();
    const paystackBalanceKobo: number =
        balanceResp?.data?.[0]?.balance ?? 0;
    if (paystackBalanceKobo < settlementAmountKobo) {
        res.status(402).json({
            code: "INSUFFICIENT_PAYSTACK_BALANCE",
            message: "Paystack platform balance is insufficient for this settlement",
            required: settlementAmountKobo,
            available: paystackBalanceKobo,
        });
        return;
    }

    // Determine attemptNumber (max of previous failed attempts + 1)
    const lastSettlement = await Settlement.findOne({ riderId }).sort({ attemptNumber: -1 });
    const attemptNumber = 1;

    const paystackReference = `setl_${riderId}_${Date.now()}_${attemptNumber}`;
    const riderWallet = await Wallet.findOne({ userId: riderId });

    // Create settlement and lock rides in a Mongo transaction
    const session = await mongoose.startSession();
    session.startTransaction();
    let settlement: any;
    try {
        [settlement] = await Settlement.create(
            [
                {
                    riderId,
                    amount: settlementAmountKobo,
                    rideIds: rides.map((r) => r._id),
                    status: "INITIATED",
                    paystackReference,
                    attemptNumber,
                    initiatedByAdminId: req.user!.userId,
                    initiatedAt: new Date(),
                    walletBalanceBeforeSettlement: riderWallet?.balance ?? 0,
                },
            ],
            { session },
        );

        await Ride.updateMany(
            { _id: { $in: rides.map((r) => r._id) } },
            { settlementId: settlement._id },
            { session },
        );

        await session.commitTransaction();
    } catch (err) {
        await session.abortTransaction();
        throw err;
    } finally {
        session.endSession();
    }

    // Initiate Paystack transfer outside the Mongo transaction
    try {
        const transferResp = await initiateTransfer(
            settlementAmountKobo,
            bankAccount.paystackRecipientCode,
            `Keke ride settlement`,
            paystackReference,
        );
        await Settlement.findByIdAndUpdate(settlement._id, {
            status: "PROCESSING",
            paystackTransferCode: transferResp.data.transfer_code,
        });
        settlement.status = "PROCESSING";
    } catch {
        // Leave as INITIATED — reconciliation job will handle it
    }

    res.status(201).json({ success: true, data: settlement });
});

// POST /api/v1/admin/settlements/:id/retry
export const retrySettlement = CatchAsync(async (req: AuthRequest, res: Response) => {
    const original = await Settlement.findById(req.params.id);
    if (!original) {
        res.status(404).json({ message: "Settlement not found" });
        return;
    }
    if (original.status !== "FAILED") {
        res.status(409).json({
            message: "Only FAILED settlements can be retried",
            currentStatus: original.status,
        });
        return;
    }

    const bankAccount = await BankAccount.findOne({ userId: original.riderId });
    if (!bankAccount) {
        res.status(409).json({ code: "NO_BANK_ACCOUNT", message: "Rider has no bank account" });
        return;
    }

    const newAttemptNumber = original.attemptNumber + 1;
    const newReference = `setl_${original.riderId}_${Date.now()}_${newAttemptNumber}`;
    const riderWallet = await Wallet.findOne({ userId: original.riderId });

    const session = await mongoose.startSession();
    session.startTransaction();
    let newSettlement: any;
    try {
        [newSettlement] = await Settlement.create(
            [
                {
                    riderId: original.riderId,
                    amount: original.amount,
                    rideIds: original.rideIds,
                    status: "INITIATED",
                    paystackReference: newReference,
                    attemptNumber: newAttemptNumber,
                    initiatedByAdminId: req.user!.userId,
                    initiatedAt: new Date(),
                    walletBalanceBeforeSettlement: riderWallet?.balance ?? 0,
                },
            ],
            { session },
        );

        await Ride.updateMany(
            { _id: { $in: original.rideIds } },
            { settlementId: newSettlement._id },
            { session },
        );

        await session.commitTransaction();
    } catch (err) {
        await session.abortTransaction();
        throw err;
    } finally {
        session.endSession();
    }

    try {
        const transferResp = await initiateTransfer(
            original.amount,
            bankAccount.paystackRecipientCode,
            `Keke ride settlement retry #${newAttemptNumber}`,
            newReference,
        );
        await Settlement.findByIdAndUpdate(newSettlement._id, {
            status: "PROCESSING",
            paystackTransferCode: transferResp.data.transfer_code,
        });
        newSettlement.status = "PROCESSING";
    } catch {
        // Leave as INITIATED
    }

    res.status(201).json({ success: true, data: newSettlement });
});

// GET /api/v1/admin/settlements?status=&riderId=&from=&to=
export const listSettlements = CatchAsync(async (req: AuthRequest, res: Response) => {
    const { status, riderId, from, to, page = "1", limit = "20" } = req.query;

    const filter: Record<string, any> = {};
    if (status) filter.status = status;
    if (riderId) filter.riderId = riderId;
    if (from || to) {
        filter.initiatedAt = {};
        if (from) filter.initiatedAt.$gte = new Date(from as string);
        if (to) filter.initiatedAt.$lte = new Date(to as string);
    }

    const pageNum = Math.max(1, parseInt(page as string));
    const limitNum = Math.min(100, Math.max(1, parseInt(limit as string)));

    const [settlements, total] = await Promise.all([
        Settlement.find(filter)
            .populate("riderId", "firstName lastName phoneNumber")
            .sort({ initiatedAt: -1 })
            .skip((pageNum - 1) * limitNum)
            .limit(limitNum)
            .lean(),
        Settlement.countDocuments(filter),
    ]);

    res.status(200).json({
        success: true,
        data: settlements,
        pagination: { page: pageNum, limit: limitNum, total, pages: Math.ceil(total / limitNum) },
    });
});

// GET /api/v1/admin/platform/balance
export const getPlatformBalanceHandler = CatchAsync(
    async (_req: AuthRequest, res: Response) => {
        const resp = await getPlatformBalance();
        res.status(200).json({ success: true, data: resp.data });
    },
);
