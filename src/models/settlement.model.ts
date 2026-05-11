import mongoose, { Schema, Document } from "mongoose";

export type SettlementStatus =
    | "INITIATED"
    | "PROCESSING"
    | "SETTLED"
    | "FAILED"
    | "REVERSED";

export interface ISettlement extends Document {
    riderId: mongoose.Types.ObjectId;
    amount: number; // kobo
    rideIds: mongoose.Types.ObjectId[];
    status: SettlementStatus;
    paystackTransferCode?: string;
    paystackReference: string;
    paystackFailureReason?: string;
    attemptNumber: number;
    initiatedByAdminId: mongoose.Types.ObjectId;
    initiatedAt: Date;
    settledAt?: Date;
    walletBalanceBeforeSettlement: number; // kobo
    walletBalanceAfterSettlement?: number; // kobo
    reversalTransactionId?: mongoose.Types.ObjectId;
    notes?: string;
    createdAt: Date;
    updatedAt: Date;
}

const SettlementSchema: Schema = new Schema(
    {
        riderId: {
            type: Schema.Types.ObjectId,
            ref: "User",
            required: true,
            index: true,
        },
        amount: { type: Number, required: true, min: 0 },
        rideIds: [{ type: Schema.Types.ObjectId, ref: "Ride" }],
        status: {
            type: String,
            enum: ["INITIATED", "PROCESSING", "SETTLED", "FAILED", "REVERSED"],
            default: "INITIATED",
            index: true,
        },
        paystackTransferCode: { type: String },
        paystackReference: { type: String, required: true, unique: true },
        paystackFailureReason: { type: String },
        attemptNumber: { type: Number, default: 1 },
        initiatedByAdminId: {
            type: Schema.Types.ObjectId,
            ref: "User",
            required: true,
        },
        initiatedAt: { type: Date, required: true },
        settledAt: { type: Date },
        walletBalanceBeforeSettlement: { type: Number, required: true },
        walletBalanceAfterSettlement: { type: Number },
        reversalTransactionId: { type: Schema.Types.ObjectId, ref: "Transaction" },
        notes: { type: String },
    },
    { timestamps: true },
);

export default mongoose.model<ISettlement>("Settlement", SettlementSchema);
