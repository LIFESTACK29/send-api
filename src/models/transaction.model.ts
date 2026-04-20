import mongoose, { Schema, Document } from "mongoose";

export type TransactionType = "credit" | "debit";
export type TransactionSource =
    | "bank_transfer"
    | "delivery_fee"
    | "delivery_earning"
    | "withdrawal";
export type TransactionStatus = "pending" | "success" | "failed";

export interface ITransaction extends Document {
    userId: mongoose.Types.ObjectId;
    type: TransactionType;
    source: TransactionSource;
    amount: number; // in kobo
    reference: string;
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
            enum: ["pending", "success", "failed"],
            default: "pending",
        },
        description: {
            type: String,
            required: true,
        },
        metadata: {
            type: Schema.Types.Mixed,
        },
    },
    { timestamps: true },
);

export default mongoose.model<ITransaction>("Transaction", TransactionSchema);
