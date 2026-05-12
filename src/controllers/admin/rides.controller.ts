import { Response } from "express";
import mongoose from "mongoose";
import { AuthRequest } from "../../types/user.type";
import { CatchAsync } from "../../utils/catchasync.util";
import Ride, { RideStatus } from "../../models/ride.model";
import User from "../../models/user.model";
import Wallet from "../../models/wallet.model";
import Transaction from "../../models/transaction.model";
import { cancelRideHold } from "../../services/wallet-hold.service";
import { emitToRoom } from "../../services/socket.service";

const KEKE_COMMISSION_RATE = parseFloat(process.env.KEKE_COMMISSION_RATE ?? "0.15");

// Admin can only advance to RIDER_ON_THE_WAY (from ASSIGNED) or CANCEL any active ride.
// IN_PROGRESS and COMPLETED are triggered by the passenger via the customer app.
const VALID_TRANSITIONS: Record<RideStatus, RideStatus[]> = {
    REQUESTED: ["CANCELLED"],
    ASSIGNED: ["RIDER_ON_THE_WAY", "CANCELLED"],
    RIDER_ON_THE_WAY: ["CANCELLED"],
    ARRIVED: ["CANCELLED"],
    IN_PROGRESS: ["CANCELLED"],
    COMPLETED: [],
    CANCELLED: [],
};

// GET /api/v1/admin/rides?status=&campusId=&from=&to=&page=&limit=
export const listRides = CatchAsync(async (req: AuthRequest, res: Response) => {
    const { status, campusId, from, to, page = "1", limit = "20" } = req.query;

    const filter: Record<string, any> = {};
    if (status) filter.status = status;
    if (campusId) filter.campusId = campusId;
    if (from || to) {
        filter.createdAt = {};
        if (from) filter.createdAt.$gte = new Date(from as string);
        if (to) filter.createdAt.$lte = new Date(to as string);
    }

    const pageNum = Math.max(1, parseInt(page as string));
    const limitNum = Math.min(100, Math.max(1, parseInt(limit as string)));
    const skip = (pageNum - 1) * limitNum;

    const [rides, total] = await Promise.all([
        Ride.find(filter)
            .populate("passengerId", "firstName lastName phoneNumber")
            .populate("assignedRiderId", "firstName lastName kekeRiderProfile")
            .populate("pickupLocationId", "name category")
            .populate("dropoffLocationId", "name category")
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limitNum)
            .lean(),
        Ride.countDocuments(filter),
    ]);

    res.status(200).json({
        success: true,
        data: rides,
        pagination: { page: pageNum, limit: limitNum, total, pages: Math.ceil(total / limitNum) },
    });
});

// POST /api/v1/admin/rides/:id/assign
export const assignRide = CatchAsync(async (req: AuthRequest, res: Response) => {
    const { kekeRiderId } = req.body;
    if (!kekeRiderId) {
        res.status(400).json({ message: "kekeRiderId is required" });
        return;
    }

    const ride = await Ride.findById(req.params.id);
    if (!ride) {
        res.status(404).json({ message: "Ride not found" });
        return;
    }
    if (ride.status !== "REQUESTED") {
        res.status(409).json({
            code: "ILLEGAL_RIDE_STATE_TRANSITION",
            message: "Only REQUESTED rides can be assigned",
            currentStatus: ride.status,
        });
        return;
    }

    const kekeRider = await User.findOne({ _id: kekeRiderId, role: "keke_rider" });
    if (!kekeRider) {
        res.status(404).json({ message: "Keke rider not found" });
        return;
    }
    if (kekeRider.kekeRiderProfile?.status !== "ACTIVE") {
        res.status(409).json({ code: "RIDER_NOT_ACTIVE", message: "Rider is not ACTIVE" });
        return;
    }
    if (
        kekeRider.kekeRiderProfile?.campusId.toString() !== ride.campusId.toString()
    ) {
        res.status(409).json({ code: "RIDER_WRONG_CAMPUS", message: "Rider is not on the same campus" });
        return;
    }

    // DB unique index enforces no active ride, but we surface a friendly error first
    const existingActive = await Ride.findOne({
        assignedRiderId: kekeRiderId,
        status: { $in: ["ASSIGNED", "RIDER_ON_THE_WAY", "ARRIVED", "IN_PROGRESS"] },
    });
    if (existingActive) {
        res.status(409).json({
            code: "RIDER_HAS_ACTIVE_RIDE",
            message: "Rider already has an active ride",
            activeRideId: existingActive._id,
        });
        return;
    }

    ride.status = "ASSIGNED";
    ride.assignedRiderId = new mongoose.Types.ObjectId(kekeRiderId);
    ride.assignedAt = new Date();
    ride.assignedByAdminId = new mongoose.Types.ObjectId(req.user!.userId);
    ride.statusTimestamps.ASSIGNED = new Date();
    await ride.save();

    const populated = await Ride.findById(ride._id)
        .populate("assignedRiderId", "firstName lastName kekeRiderProfile")
        .populate("pickupLocationId", "name")
        .populate("dropoffLocationId", "name")
        .lean();

    const ridePayload = {
        ...(populated ?? {}),
        id: populated?._id,
        fareNaira: (populated?.fare ?? 0) / 100,
        pickup: populated?.pickupLocationId,
        dropoff: populated?.dropoffLocationId,
        assignedRider: populated?.assignedRiderId,
    };

    emitToRoom(`user-${ride.passengerId}`, "ride_assigned", {
        ride: ridePayload,
        rider: {
            name: `${kekeRider.firstName} ${kekeRider.lastName}`,
            tricycleIdentifier: kekeRider.kekeRiderProfile?.tricycleIdentifier,
        },
    });

    // Notify the assigned keke rider of their new ride
    emitToRoom(`user-${kekeRiderId}`, "keke_ride_assigned", { ride: ridePayload });
    emitToRoom("ops_room", "ride_status_update", { rideId: ride._id, status: "ASSIGNED", trackingId: ride.trackingId });

    res.status(200).json({ success: true, data: populated });
});

// POST /api/v1/admin/rides/:id/status
export const updateRideStatus = CatchAsync(async (req: AuthRequest, res: Response) => {
    const { status } = req.body as { status: RideStatus };
    if (!status) {
        res.status(400).json({ message: "status is required" });
        return;
    }

    const ride = await Ride.findById(req.params.id);
    if (!ride) {
        res.status(404).json({ message: "Ride not found" });
        return;
    }

    const allowed = VALID_TRANSITIONS[ride.status];
    if (!allowed.includes(status)) {
        res.status(409).json({
            code: "ILLEGAL_RIDE_STATE_TRANSITION",
            message: `Cannot transition from ${ride.status} to ${status}`,
            currentStatus: ride.status,
            allowedTransitions: allowed,
        });
        return;
    }

    if (status === "CANCELLED") {
        // Release wallet hold
        if (ride.walletHoldId) {
            await cancelRideHold(ride.walletHoldId as unknown as mongoose.Types.ObjectId);
        }
        ride.cancelledBy = "admin";
        ride.cancellationReason = req.body.reason ?? "Cancelled by admin";
    }

    ride.status = status;
    (ride.statusTimestamps as any)[status] = new Date();
    await ride.save();

    emitToRoom(`user-${ride.passengerId}`, "ride_status_update", {
        rideId: ride._id,
        status: ride.status,
    });

    if (status === "CANCELLED") {
        emitToRoom(`user-${ride.passengerId}`, "ride_cancelled", {
            rideId: ride._id,
            reason: ride.cancellationReason,
        });
    }

    res.status(200).json({ success: true, data: { status: ride.status } });
});

// POST /api/v1/admin/rides/:id/complete
export const completeRide = CatchAsync(async (req: AuthRequest, res: Response) => {
    const ride = await Ride.findById(req.params.id);
    if (!ride) {
        res.status(404).json({ message: "Ride not found" });
        return;
    }

    const allowed = VALID_TRANSITIONS[ride.status];
    if (!allowed.includes("COMPLETED")) {
        res.status(409).json({
            code: "ILLEGAL_RIDE_STATE_TRANSITION",
            message: `Cannot complete ride from status ${ride.status}`,
            currentStatus: ride.status,
        });
        return;
    }
    if (!ride.assignedRiderId) {
        res.status(409).json({ message: "Ride has no assigned rider" });
        return;
    }

    const commissionKobo = Math.round(ride.fare * KEKE_COMMISSION_RATE);
    const riderPayoutKobo = ride.fare - commissionKobo;

    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        // Settle hold transaction → completed + debit passenger wallet
        await Transaction.findByIdAndUpdate(
            ride.walletHoldId,
            { status: "completed", source: "ride_fare" },
            { session },
        );

        await Wallet.findOneAndUpdate(
            { userId: ride.passengerId },
            { $inc: { balance: -ride.fare } },
            { session },
        );

        // Credit rider wallet
        const riderCreditRef = `ride_earning_${ride._id}_${Date.now()}`;
        const [riderTx] = await Transaction.create(
            [
                {
                    userId: ride.assignedRiderId,
                    rideId: ride._id,
                    type: "credit",
                    source: "ride_earning",
                    amount: riderPayoutKobo,
                    reference: riderCreditRef,
                    status: "completed",
                    description: `Ride earning for ${ride.trackingId}`,
                },
            ],
            { session },
        );

        await Wallet.findOneAndUpdate(
            { userId: ride.assignedRiderId },
            { $inc: { balance: riderPayoutKobo } },
            { session },
        );

        // Update ride
        ride.status = "COMPLETED";
        ride.platformCommissionAmount = commissionKobo;
        ride.riderPayoutAmount = riderPayoutKobo;
        ride.riderCreditTransactionId = riderTx._id as mongoose.Types.ObjectId;
        (ride.statusTimestamps as any).COMPLETED = new Date();
        await ride.save({ session });

        await session.commitTransaction();
    } catch (err) {
        await session.abortTransaction();
        throw err;
    } finally {
        session.endSession();
    }

    const populated = await Ride.findById(ride._id)
        .populate("passengerId", "firstName lastName")
        .populate("assignedRiderId", "firstName lastName kekeRiderProfile")
        .populate("pickupLocationId", "name")
        .populate("dropoffLocationId", "name")
        .lean();

    emitToRoom(`user-${ride.passengerId}`, "ride_completed", { ride: populated });

    res.status(200).json({ success: true, data: populated });
});

// POST /api/v1/admin/rides/:id/cancel
export const adminCancelRide = CatchAsync(async (req: AuthRequest, res: Response) => {
    const { reason } = req.body;
    const ride = await Ride.findById(req.params.id);
    if (!ride) {
        res.status(404).json({ message: "Ride not found" });
        return;
    }

    const TERMINAL: RideStatus[] = ["COMPLETED", "CANCELLED"];
    if (TERMINAL.includes(ride.status)) {
        res.status(409).json({
            code: "ILLEGAL_RIDE_STATE_TRANSITION",
            message: "Ride is already in a terminal state",
            currentStatus: ride.status,
        });
        return;
    }

    if (ride.walletHoldId) {
        await cancelRideHold(ride.walletHoldId as unknown as mongoose.Types.ObjectId);
    }

    ride.status = "CANCELLED";
    ride.cancelledBy = "admin";
    ride.cancellationReason = reason ?? "Cancelled by admin";
    (ride.statusTimestamps as any).CANCELLED = new Date();
    await ride.save();

    emitToRoom(`user-${ride.passengerId}`, "ride_cancelled", {
        rideId: ride._id,
        reason: ride.cancellationReason,
    });

    res.status(200).json({ success: true, message: "Ride cancelled" });
});

// GET /api/v1/admin/keke-riders/:id/unsettled-rides
export const getUnsettledRides = CatchAsync(async (req: AuthRequest, res: Response) => {
    const rides = await Ride.find({
        assignedRiderId: req.params.id,
        status: "COMPLETED",
        settlementId: null,
    })
        .populate("pickupLocationId", "name")
        .populate("dropoffLocationId", "name")
        .sort({ createdAt: -1 })
        .lean();

    const total = rides.reduce((sum, r) => sum + (r.riderPayoutAmount ?? 0), 0);

    res.status(200).json({
        success: true,
        data: rides,
        summary: { count: rides.length, total, totalNaira: total / 100 },
    });
});
