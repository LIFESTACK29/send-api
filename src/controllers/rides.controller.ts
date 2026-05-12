import { Response } from "express";
import mongoose from "mongoose";
import { AuthRequest } from "../types/user.type";
import { CatchAsync } from "../utils/catchasync.util";
import Ride from "../models/ride.model";
import CampusLocation from "../models/campus-location.model";
import FareRule from "../models/fare-rule.model";
import Wallet from "../models/wallet.model";
import Transaction from "../models/transaction.model";
import { getAvailableBalance, placeRideHold, cancelRideHold } from "../services/wallet-hold.service";
import { emitToRoom } from "../services/socket.service";

const KEKE_COMMISSION_RATE = parseFloat(process.env.KEKE_COMMISSION_RATE ?? "0.15");

const generateRideTrackingId = () =>
    `KR-${new Date().toISOString().split("T")[0].replace(/-/g, "")}-${Math.floor(1000 + Math.random() * 9000)}`;

const buildRideResponse = (ride: any) => ({
    id: ride._id,
    trackingId: ride.trackingId,
    status: ride.status,
    campusId: ride.campusId,
    fare: ride.fare,
    fareNaira: ride.fare / 100,
    pickup: ride.pickupLocationId,
    dropoff: ride.dropoffLocationId,
    pickupZone: ride.pickupZoneId,
    dropoffZone: ride.dropoffZoneId,
    assignedRider: ride.assignedRiderId,
    assignedAt: ride.assignedAt,
    riderPayoutAmount: ride.riderPayoutAmount,
    platformCommissionAmount: ride.platformCommissionAmount,
    statusTimestamps: ride.statusTimestamps,
    cancelledBy: ride.cancelledBy,
    cancellationReason: ride.cancellationReason,
    createdAt: ride.createdAt,
    updatedAt: ride.updatedAt,
});

// POST /api/v1/rides/quote
export const getRideQuote = CatchAsync(async (req: AuthRequest, res: Response) => {
    const { pickupLocationId, dropoffLocationId } = req.body;

    if (!pickupLocationId || !dropoffLocationId) {
        res.status(400).json({ message: "pickupLocationId and dropoffLocationId are required" });
        return;
    }

    const [pickup, dropoff] = await Promise.all([
        CampusLocation.findById(pickupLocationId).lean(),
        CampusLocation.findById(dropoffLocationId).lean(),
    ]);

    if (!pickup || !pickup.isActive) {
        res.status(404).json({ message: "Pickup location not found" });
        return;
    }
    if (!dropoff || !dropoff.isActive) {
        res.status(404).json({ message: "Dropoff location not found" });
        return;
    }
    if (pickup.campusId.toString() !== dropoff.campusId.toString()) {
        res.status(400).json({ message: "Pickup and dropoff must be on the same campus" });
        return;
    }

    const fareRule = await FareRule.findOne({
        campusId: pickup.campusId,
        pickupZoneId: pickup.zoneId,
        dropoffZoneId: dropoff.zoneId,
        isActive: true,
    }).lean();

    if (!fareRule) {
        res.status(404).json({
            code: "NO_FARE_RULE",
            message: "No fare available for this route",
        });
        return;
    }

    let availableBalance = 0;
    try {
        const result = await getAvailableBalance(req.user!.userId);
        availableBalance = result.availableBalance;
    } catch (err: any) {
        if (err.code === "WALLET_NOT_FOUND") {
            res.status(404).json({ code: "WALLET_NOT_FOUND", message: "Wallet not found" });
            return;
        }
        throw err;
    }

    res.status(200).json({
        success: true,
        data: {
            fare: fareRule.fare,
            fareNaira: fareRule.fare / 100,
            availableBalance,
            availableBalanceNaira: availableBalance / 100,
            currency: "NGN",
        },
    });
});

// POST /api/v1/rides
export const requestRide = CatchAsync(async (req: AuthRequest, res: Response) => {
    const { pickupLocationId, dropoffLocationId } = req.body;

    if (!pickupLocationId || !dropoffLocationId) {
        res.status(400).json({ message: "pickupLocationId and dropoffLocationId are required" });
        return;
    }

    const [pickup, dropoff] = await Promise.all([
        CampusLocation.findById(pickupLocationId).lean(),
        CampusLocation.findById(dropoffLocationId).lean(),
    ]);

    if (!pickup || !pickup.isActive) {
        res.status(404).json({ message: "Pickup location not found" });
        return;
    }
    if (!dropoff || !dropoff.isActive) {
        res.status(404).json({ message: "Dropoff location not found" });
        return;
    }
    if (pickup.campusId.toString() !== dropoff.campusId.toString()) {
        res.status(400).json({ message: "Pickup and dropoff must be on the same campus" });
        return;
    }

    const fareRule = await FareRule.findOne({
        campusId: pickup.campusId,
        pickupZoneId: pickup.zoneId,
        dropoffZoneId: dropoff.zoneId,
        isActive: true,
    }).lean();

    if (!fareRule) {
        res.status(404).json({
            code: "NO_FARE_RULE",
            message: "No fare available for this route",
        });
        return;
    }

    let wallet: any;
    let availableBalance: number;
    try {
        const result = await getAvailableBalance(req.user!.userId);
        wallet = result.wallet;
        availableBalance = result.availableBalance;
    } catch (err: any) {
        if (err.code === "WALLET_NOT_FOUND") {
            res.status(404).json({ code: "WALLET_NOT_FOUND", message: "Wallet not found" });
            return;
        }
        throw err;
    }

    if (availableBalance < fareRule.fare) {
        res.status(402).json({
            code: "INSUFFICIENT_WALLET_BALANCE",
            message: "Insufficient wallet balance",
            required: fareRule.fare,
            requiredNaira: fareRule.fare / 100,
            available: availableBalance,
            availableNaira: availableBalance / 100,
            shortfall: fareRule.fare - availableBalance,
            shortfallNaira: (fareRule.fare - availableBalance) / 100,
        });
        return;
    }

    // Create ride and hold atomically
    const session = await mongoose.startSession();
    session.startTransaction();
    let ride: any;
    try {
        const rideId = new mongoose.Types.ObjectId();
        const holdTx = await placeRideHold(
            req.user!.userId,
            rideId,
            fareRule.fare,
            session,
        );

        [ride] = await Ride.create(
            [
                {
                    _id: rideId,
                    trackingId: generateRideTrackingId(),
                    campusId: pickup.campusId,
                    passengerId: req.user!.userId,
                    pickupLocationId: pickup._id,
                    dropoffLocationId: dropoff._id,
                    pickupZoneId: pickup.zoneId,
                    dropoffZoneId: dropoff.zoneId,
                    fare: fareRule.fare,
                    walletHoldId: holdTx._id,
                    status: "REQUESTED",
                    statusTimestamps: { REQUESTED: new Date() },
                },
            ],
            { session },
        );

        await session.commitTransaction();
    } catch (err) {
        await session.abortTransaction();
        throw err;
    } finally {
        session.endSession();
    }

    const populated = await Ride.findById(ride._id)
        .populate("pickupLocationId", "name category")
        .populate("dropoffLocationId", "name category")
        .populate("pickupZoneId", "name")
        .populate("dropoffZoneId", "name")
        .lean();

    // Notify ops room of new ride request
    emitToRoom("ops_room", "new_ride_request", {
        ride: buildRideResponse(populated),
        passengerId: req.user!.userId,
    });

    res.status(201).json({ success: true, data: buildRideResponse(populated) });
});

// GET /api/v1/rides/:id
export const getRideById = CatchAsync(async (req: AuthRequest, res: Response) => {
    const ride = await Ride.findById(req.params.id)
        .populate("pickupLocationId", "name category")
        .populate("dropoffLocationId", "name category")
        .populate("pickupZoneId", "name")
        .populate("dropoffZoneId", "name")
        .populate("assignedRiderId", "firstName lastName kekeRiderProfile")
        .lean();

    if (!ride) {
        res.status(404).json({ message: "Ride not found" });
        return;
    }

    if (ride.passengerId.toString() !== req.user!.userId) {
        res.status(403).json({ message: "Forbidden" });
        return;
    }

    res.status(200).json({ success: true, data: buildRideResponse(ride) });
});

// GET /api/v1/rides/my-rides?status=&page=&limit=
export const getMyRides = CatchAsync(async (req: AuthRequest, res: Response) => {
    const { status, page = "1", limit = "20" } = req.query;
    const pageNum = Math.max(1, parseInt(page as string));
    const limitNum = Math.min(50, Math.max(1, parseInt(limit as string)));
    const skip = (pageNum - 1) * limitNum;

    const filter: Record<string, any> = { passengerId: req.user!.userId };
    if (status) filter.status = status;

    const [rides, total] = await Promise.all([
        Ride.find(filter)
            .populate("pickupLocationId", "name")
            .populate("dropoffLocationId", "name")
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limitNum)
            .lean(),
        Ride.countDocuments(filter),
    ]);

    res.status(200).json({
        success: true,
        data: rides.map(buildRideResponse),
        pagination: {
            page: pageNum,
            limit: limitNum,
            total,
            pages: Math.ceil(total / limitNum),
        },
    });
});

// POST /api/v1/rides/:id/status  (passenger only)
// RIDER_ON_THE_WAY → IN_PROGRESS: settles wallet hold and credits rider
// IN_PROGRESS → COMPLETED: status update only
export const passengerUpdateStatus = CatchAsync(async (req: AuthRequest, res: Response) => {
    const { status } = req.body as { status: string };
    const PASSENGER_TRANSITIONS: Record<string, string[]> = {
        RIDER_ON_THE_WAY: ["ARRIVED"],
        ARRIVED:          ["IN_PROGRESS"],
        IN_PROGRESS:      ["COMPLETED"],
    };

    if (!status) {
        res.status(400).json({ message: "status is required" });
        return;
    }

    const ride = await Ride.findById(req.params.id);
    if (!ride) {
        res.status(404).json({ message: "Ride not found" });
        return;
    }
    if (ride.passengerId.toString() !== req.user!.userId) {
        res.status(403).json({ message: "Forbidden" });
        return;
    }

    const allowed = PASSENGER_TRANSITIONS[ride.status] ?? [];
    if (!allowed.includes(status)) {
        res.status(409).json({
            code: "ILLEGAL_RIDE_STATE_TRANSITION",
            message: `Cannot transition from ${ride.status} to ${status}`,
            currentStatus: ride.status,
            allowedTransitions: allowed,
        });
        return;
    }

    // Wallet settlement happens when passenger confirms ride has started (IN_PROGRESS)
    if (status === "IN_PROGRESS") {
        const commissionKobo = Math.round(ride.fare * KEKE_COMMISSION_RATE);
        const riderPayoutKobo = ride.fare - commissionKobo;

        const session = await mongoose.startSession();
        session.startTransaction();
        try {
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
            ride.status = "IN_PROGRESS";
            ride.platformCommissionAmount = commissionKobo;
            ride.riderPayoutAmount = riderPayoutKobo;
            (ride as any).riderCreditTransactionId = riderTx._id;
            (ride.statusTimestamps as any).IN_PROGRESS = new Date();
            await ride.save({ session });
            await session.commitTransaction();
        } catch (err) {
            await session.abortTransaction();
            throw err;
        } finally {
            session.endSession();
        }

        emitToRoom(`user-${ride.passengerId}`, "ride_status_update", { rideId: ride._id, status: "IN_PROGRESS" });
        emitToRoom("ops_room", "ride_status_update", { rideId: ride._id, status: "IN_PROGRESS", trackingId: ride.trackingId });
        res.status(200).json({ success: true, data: { status: "IN_PROGRESS" } });
        return;
    }

    // COMPLETED — no financial action needed (already settled at IN_PROGRESS)
    ride.status = "COMPLETED";
    (ride.statusTimestamps as any).COMPLETED = new Date();
    await ride.save();

    emitToRoom(`user-${ride.passengerId}`, "ride_completed", { rideId: ride._id, status: "COMPLETED" });
    emitToRoom("ops_room", "ride_status_update", { rideId: ride._id, status: "COMPLETED", trackingId: ride.trackingId });
    res.status(200).json({ success: true, data: { status: "COMPLETED" } });
});

// POST /api/v1/rides/:id/cancel
export const cancelRide = CatchAsync(async (req: AuthRequest, res: Response) => {
    const ride = await Ride.findById(req.params.id);

    if (!ride) {
        res.status(404).json({ message: "Ride not found" });
        return;
    }
    if (ride.passengerId.toString() !== req.user!.userId) {
        res.status(403).json({ message: "Forbidden" });
        return;
    }
    if (ride.status !== "REQUESTED") {
        res.status(409).json({
            code: "ILLEGAL_RIDE_STATE_TRANSITION",
            message: "Ride can only be cancelled while in REQUESTED status",
            currentStatus: ride.status,
        });
        return;
    }

    ride.status = "CANCELLED";
    ride.cancelledBy = "passenger";
    ride.cancellationReason = req.body.reason ?? "Cancelled by passenger";
    ride.statusTimestamps.CANCELLED = new Date();

    if (ride.walletHoldId) {
        await cancelRideHold(ride.walletHoldId as unknown as mongoose.Types.ObjectId);
    }

    await ride.save();

    emitToRoom("ops_room", "ride_cancelled_by_passenger", {
        rideId: ride._id,
        trackingId: ride.trackingId,
        passengerId: ride.passengerId,
    });

    res.status(200).json({ success: true, message: "Ride cancelled" });
});
