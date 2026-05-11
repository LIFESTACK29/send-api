import mongoose, { Schema, Document } from "mongoose";

export type TransactionType = "credit" | "debit";
export type TransactionSource =
    | "bank_transfer"
    | "delivery_fee"
    | "delivery_earning"
    | "withdrawal"
    | "ride_fare_hold"
    | "ride_fare"
    | "ride_earning"
    | "settlement_payout"
    | "settlement_reversal"
    | "ride_refund"
    | "platform_commission";
export type TransactionStatus = "pending" | "completed" | "cancelled" | "success" | "failed";

export interface ITransaction extends Document {
    userId: mongoose.Types.ObjectId;
    rideId?: mongoose.Types.ObjectId;
    type: TransactionType;
    source: TransactionSource;
    amount: number; // in kobo
    reference: string;
    idempotencyKey?: string;
    status: TransactionStatus;
    description: string;
    metadata?: Record<string, any>;
    createdAt: Date;
    updatedAt: Date;
}

const TransactionSchema: Schema = new Schema(
    {
        userId: {
            type: Schema.Types.ObjectId,
            ref: "User",
            required: true,
            index: true,
        },
        rideId: {
            type: Schema.Types.ObjectId,
            ref: "Ride",
            index: true,
            sparse: true,
        },
        type: {
            type: String,
            enum: ["credit", "debit"],
            required: true,
        },
        source: {
            type: String,
            enum: [
                "bank_transfer",
                "delivery_fee",
                "delivery_earning",
                "withdrawal",
                "ride_fare_hold",
                "ride_fare",
                "ride_earning",
                "settlement_payout",
                "settlement_reversal",
                "ride_refund",
                "platform_commission",
            ],
            required: true,
        },
        amount: {
            type: Number,
            required: true,
            min: 0,
        },
        reference: {
            type: String,
            required: true,
            unique: true,
        },
        status: {
            type: String,
            enum: ["pending", "completed", "cancelled", "success", "failed"],
            default: "pending",
        },
        description: {
            type: String,
            required: true,
        },
        metadata: {
            type: Schema.Types.Mixed,
        },
        idempotencyKey: {
            type: String,
            index: true,
            sparse: true,
        },
    },
    { timestamps: true },
);

export default mongoose.model<ITransaction>("Transaction", TransactionSchema);
