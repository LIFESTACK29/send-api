import { Response } from "express";
import mongoose from "mongoose";
import { AuthRequest } from "../../types/user.type";
import { CatchAsync } from "../../utils/catchasync.util";
import User from "../../models/user.model";
import Wallet from "../../models/wallet.model";
import BankAccount from "../../models/bank-account.model";
import Ride from "../../models/ride.model";
import { ensureWalletForUser } from "../../services/wallet.service";
import { listBanks, resolveAccountNumber, createTransferRecipient } from "../../services/paystack.service";

// Simple 24-hour in-memory cache for bank list
let bankListCache: { data: any; expiry: number } | null = null;

// POST /api/v1/admin/keke-riders
export const createKekeRider = CatchAsync(async (req: AuthRequest, res: Response) => {
    const { fullName, phoneNumber, campusId, tricycleIdentifier, profileImage, notes } =
        req.body;

    if (!fullName || !phoneNumber || !campusId || !tricycleIdentifier) {
        res.status(400).json({
            message: "fullName, phoneNumber, campusId, and tricycleIdentifier are required",
        });
        return;
    }

    const nameParts = fullName.trim().split(" ");
    const firstName = nameParts[0];
    const lastName = nameParts.slice(1).join(" ") || "Rider";

    // Use phone as a synthetic email — keke riders don't log in via app
    const syntheticEmail = `rider_${phoneNumber.replace(/\D/g, "")}@keke.internal`;

    const existing = await User.findOne({ phoneNumber });
    if (existing) {
        res.status(409).json({ message: "A user with this phone number already exists" });
        return;
    }

    // Random password — riders don't authenticate via app
    const tempPassword = Math.random().toString(36).slice(-12) + "K1!";

    const user = await User.create({
        firstName,
        lastName,
        email: syntheticEmail,
        phoneNumber,
        password: tempPassword,
        role: "keke_rider",
        isOnboarded: true,
        kekeRiderProfile: {
            campusId,
            onboardedBy: req.user!.userId,
            onboardedAt: new Date(),
            tricycleIdentifier,
            profileImage: profileImage ?? undefined,
            notes: notes ?? undefined,
            status: "PENDING_BANK_SETUP",
        },
    });

    await ensureWalletForUser(user._id.toString());

    res.status(201).json({
        success: true,
        data: {
            id: user._id,
            fullName: `${user.firstName} ${user.lastName}`,
            phoneNumber: user.phoneNumber,
            campusId: user.kekeRiderProfile!.campusId,
            tricycleIdentifier: user.kekeRiderProfile!.tricycleIdentifier,
            status: user.kekeRiderProfile!.status,
        },
    });
});

// GET /api/v1/admin/keke-riders?campusId=&status=&search=
export const listKekeRiders = CatchAsync(async (req: AuthRequest, res: Response) => {
    const { campusId, status, search } = req.query;

    const filter: Record<string, any> = { role: "keke_rider" };
    if (campusId) filter["kekeRiderProfile.campusId"] = campusId;
    if (status) filter["kekeRiderProfile.status"] = status;
    if (search && typeof search === "string") {
        const regex = new RegExp(search, "i");
        filter.$or = [
            { firstName: regex },
            { lastName: regex },
            { phoneNumber: regex },
            { "kekeRiderProfile.tricycleIdentifier": regex },
        ];
    }

    const riders = await User.find(filter)
        .select("-password")
        .populate("kekeRiderProfile.campusId", "name code")
        .sort({ createdAt: -1 })
        .lean();

    res.status(200).json({ success: true, data: riders });
});

// GET /api/v1/admin/keke-riders/:id
export const getKekeRider = CatchAsync(async (req: AuthRequest, res: Response) => {
    const rider = await User.findOne({ _id: req.params.id, role: "keke_rider" })
        .select("-password")
        .populate("kekeRiderProfile.campusId", "name code")
        .lean();

    if (!rider) {
        res.status(404).json({ message: "Keke rider not found" });
        return;
    }

    const [wallet, unsettledRides] = await Promise.all([
        Wallet.findOne({ userId: req.params.id }).lean(),
        Ride.find({
            assignedRiderId: req.params.id,
            status: "COMPLETED",
            settlementId: null,
        }),
    ]);

    const unsettledTotal = unsettledRides.reduce((sum, r) => sum + (r.riderPayoutAmount ?? 0), 0);

    res.status(200).json({
        success: true,
        data: {
            ...rider,
            walletBalance: wallet?.balance ?? 0,
            walletBalanceNaira: (wallet?.balance ?? 0) / 100,
            unsettledRideCount: unsettledRides.length,
            unsettledTotal,
            unsettledTotalNaira: unsettledTotal / 100,
        },
    });
});

// PUT /api/v1/admin/keke-riders/:id
export const updateKekeRider = CatchAsync(async (req: AuthRequest, res: Response) => {
    const { tricycleIdentifier, notes, profileImage } = req.body;

    const update: Record<string, any> = {};
    if (tricycleIdentifier !== undefined)
        update["kekeRiderProfile.tricycleIdentifier"] = tricycleIdentifier;
    if (notes !== undefined) update["kekeRiderProfile.notes"] = notes;
    if (profileImage !== undefined) update["kekeRiderProfile.profileImage"] = profileImage;

    const rider = await User.findOneAndUpdate(
        { _id: req.params.id, role: "keke_rider" },
        update,
        { new: true, select: "-password" },
    );
    if (!rider) {
        res.status(404).json({ message: "Keke rider not found" });
        return;
    }
    res.status(200).json({ success: true, data: rider });
});

// POST /api/v1/admin/keke-riders/:id/deactivate
export const deactivateKekeRider = CatchAsync(async (req: AuthRequest, res: Response) => {
    const { reason } = req.body;

    const rider = await User.findOne({ _id: req.params.id, role: "keke_rider" });
    if (!rider) {
        res.status(404).json({ message: "Keke rider not found" });
        return;
    }

    const wallet = await Wallet.findOne({ userId: req.params.id });
    if (wallet && wallet.balance > 0) {
        res.status(409).json({
            code: "UNSETTLED_BALANCE",
            message: "Rider has an unsettled wallet balance. Settle all rides before deactivating.",
            balance: wallet.balance,
            balanceNaira: wallet.balance / 100,
        });
        return;
    }

    rider.kekeRiderProfile!.status = "DEACTIVATED";
    rider.kekeRiderProfile!.deactivatedAt = new Date();
    rider.kekeRiderProfile!.deactivationReason = reason ?? "Deactivated by admin";
    await rider.save();

    res.status(200).json({ success: true, message: "Rider deactivated" });
});

// POST /api/v1/admin/keke-riders/:id/reactivate
export const reactivateKekeRider = CatchAsync(async (req: AuthRequest, res: Response) => {
    const rider = await User.findOne({ _id: req.params.id, role: "keke_rider" });
    if (!rider) {
        res.status(404).json({ message: "Keke rider not found" });
        return;
    }

    const bankAccount = await BankAccount.findOne({ userId: req.params.id });
    rider.kekeRiderProfile!.status = bankAccount ? "ACTIVE" : "PENDING_BANK_SETUP";
    rider.kekeRiderProfile!.deactivatedAt = undefined;
    rider.kekeRiderProfile!.deactivationReason = undefined;
    await rider.save();

    res.status(200).json({ success: true, data: rider.kekeRiderProfile!.status });
});

// GET /api/v1/admin/banks  (cached 24h)
export const getBanks = CatchAsync(async (_req: AuthRequest, res: Response) => {
    if (bankListCache && bankListCache.expiry > Date.now()) {
        res.status(200).json({ success: true, data: bankListCache.data });
        return;
    }
    const response = await listBanks();
    bankListCache = { data: response.data, expiry: Date.now() + 24 * 60 * 60 * 1000 };
    res.status(200).json({ success: true, data: response.data });
});

// POST /api/v1/admin/banks/resolve
export const resolveBank = CatchAsync(async (req: AuthRequest, res: Response) => {
    const { bankCode, accountNumber } = req.body;
    if (!bankCode || !accountNumber) {
        res.status(400).json({ message: "bankCode and accountNumber are required" });
        return;
    }
    const response = await resolveAccountNumber(accountNumber, bankCode);
    res.status(200).json({ success: true, data: response.data });
});

// POST /api/v1/admin/keke-riders/:id/bank-account
export const setKekeRiderBankAccount = CatchAsync(async (req: AuthRequest, res: Response) => {
    const { bankCode, accountNumber, accountName } = req.body;
    if (!bankCode || !accountNumber || !accountName) {
        res.status(400).json({ message: "bankCode, accountNumber, and accountName are required" });
        return;
    }

    const rider = await User.findOne({ _id: req.params.id, role: "keke_rider" });
    if (!rider) {
        res.status(404).json({ message: "Keke rider not found" });
        return;
    }

    const recipientResponse = await createTransferRecipient(
        `${rider.firstName} ${rider.lastName}`,
        accountNumber,
        bankCode,
    );

    const recipientCode = recipientResponse.data.recipient_code;
    const bankName = recipientResponse.data.details?.bank_name ?? "";

    // Retire old bank account if exists
    const existing = await BankAccount.findOne({ userId: req.params.id });
    if (existing) {
        await BankAccount.findByIdAndDelete(existing._id);
    }

    await BankAccount.create({
        userId: req.params.id,
        bankCode,
        bankName,
        accountNumber,
        accountName,
        paystackRecipientCode: recipientCode,
    });

    // Transition rider to ACTIVE if previously PENDING_BANK_SETUP
    if (rider.kekeRiderProfile!.status === "PENDING_BANK_SETUP") {
        rider.kekeRiderProfile!.status = "ACTIVE";
        rider.kekeRiderProfile!.bankAccountVerifiedAt = new Date();
        await rider.save();
    }

    res.status(201).json({
        success: true,
        message: "Bank account set. Rider is now ACTIVE.",
        status: rider.kekeRiderProfile!.status,
    });
});

// GET /api/v1/admin/keke-riders/:id/bank-account
export const getKekeRiderBankAccount = CatchAsync(async (req: AuthRequest, res: Response) => {
    const account = await BankAccount.findOne({ userId: req.params.id }).lean();
    if (!account) {
        res.status(404).json({ message: "Bank account not found" });
        return;
    }

    // Mask account number
    const masked =
        account.accountNumber.slice(0, 3) +
        "*".repeat(account.accountNumber.length - 6) +
        account.accountNumber.slice(-3);

    res.status(200).json({
        success: true,
        data: {
            bankName: account.bankName,
            accountName: account.accountName,
            accountNumber: masked,
            bankCode: account.bankCode,
        },
    });
});

