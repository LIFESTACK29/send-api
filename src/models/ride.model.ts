import mongoose, { Schema, Document } from "mongoose";

export type RideStatus =
    | "REQUESTED"
    | "ASSIGNED"
    | "RIDER_ON_THE_WAY"
    | "ARRIVED"
    | "IN_PROGRESS"
    | "COMPLETED"
    | "CANCELLED";

export interface IStatusTimestamps {
    REQUESTED?: Date;
    ASSIGNED?: Date;
    RIDER_ON_THE_WAY?: Date;
    ARRIVED?: Date;
    IN_PROGRESS?: Date;
    COMPLETED?: Date;
    CANCELLED?: Date;
}

export interface IRide extends Document {
    trackingId: string;
    campusId: mongoose.Types.ObjectId;
    passengerId: mongoose.Types.ObjectId;
    pickupLocationId: mongoose.Types.ObjectId;
    dropoffLocationId: mongoose.Types.ObjectId;
    pickupZoneId: mongoose.Types.ObjectId;
    dropoffZoneId: mongoose.Types.ObjectId;
    fare: number; // kobo snapshot
    assignedRiderId?: mongoose.Types.ObjectId;
    assignedAt?: Date;
    assignedByAdminId?: mongoose.Types.ObjectId;
    status: RideStatus;
    walletHoldId?: mongoose.Types.ObjectId;
    passengerDebitTransactionId?: mongoose.Types.ObjectId;
    riderCreditTransactionId?: mongoose.Types.ObjectId;
    platformCommissionAmount?: number; // kobo
    riderPayoutAmount?: number; // kobo
    settlementId?: mongoose.Types.ObjectId;
    cancelledBy?: "passenger" | "admin";
    cancellationReason?: string;
    refundTransactionId?: mongoose.Types.ObjectId;
    statusTimestamps: IStatusTimestamps;
    createdAt: Date;
    updatedAt: Date;
}

const RideSchema: Schema = new Schema(
    {
        trackingId: { type: String, required: true, unique: true },
        campusId: {
            type: Schema.Types.ObjectId,
            ref: "Campus",
            required: true,
            index: true,
        },
        passengerId: {
            type: Schema.Types.ObjectId,
            ref: "User",
            required: true,
            index: true,
        },
        pickupLocationId: {
            type: Schema.Types.ObjectId,
            ref: "CampusLocation",
            required: true,
        },
        dropoffLocationId: {
            type: Schema.Types.ObjectId,
            ref: "CampusLocation",
            required: true,
        },
        pickupZoneId: {
            type: Schema.Types.ObjectId,
            ref: "Zone",
            required: true,
        },
        dropoffZoneId: {
            type: Schema.Types.ObjectId,
            ref: "Zone",
            required: true,
        },
        fare: { type: Number, required: true, min: 0 },
        assignedRiderId: {
            type: Schema.Types.ObjectId,
            ref: "User",
            default: null,
        },
        assignedAt: { type: Date },
        assignedByAdminId: { type: Schema.Types.ObjectId, ref: "User" },
        status: {
            type: String,
            enum: [
                "REQUESTED",
                "ASSIGNED",
                "RIDER_ON_THE_WAY",
                "ARRIVED",
                "IN_PROGRESS",
                "COMPLETED",
                "CANCELLED",
            ],
            default: "REQUESTED",
            index: true,
        },
        walletHoldId: { type: Schema.Types.ObjectId, ref: "Transaction" },
        passengerDebitTransactionId: {
            type: Schema.Types.ObjectId,
            ref: "Transaction",
        },
        riderCreditTransactionId: {
            type: Schema.Types.ObjectId,
            ref: "Transaction",
        },
        platformCommissionAmount: { type: Number },
        riderPayoutAmount: { type: Number },
        settlementId: {
            type: Schema.Types.ObjectId,
            ref: "Settlement",
            default: null,
            index: true,
            sparse: true,
        },
        cancelledBy: { type: String, enum: ["passenger", "admin"] },
        cancellationReason: { type: String },
        refundTransactionId: { type: Schema.Types.ObjectId, ref: "Transaction" },
        statusTimestamps: {
            REQUESTED: { type: Date },
            ASSIGNED: { type: Date },
            RIDER_ON_THE_WAY: { type: Date },
            ARRIVED: { type: Date },
            IN_PROGRESS: { type: Date },
            COMPLETED: { type: Date },
            CANCELLED: { type: Date },
        },
    },
    { timestamps: true },
);

// One rider can only have one active ride at a time — enforced at DB level
const ACTIVE_RIDE_STATUSES = [
    "ASSIGNED",
    "RIDER_ON_THE_WAY",
    "ARRIVED",
    "IN_PROGRESS",
];
RideSchema.index(
    { assignedRiderId: 1 },
    {
        unique: true,
        partialFilterExpression: { status: { $in: ACTIVE_RIDE_STATUSES } },
        sparse: true,
    },
);

export default mongoose.model<IRide>("Ride", RideSchema);
