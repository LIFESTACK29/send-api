import mongoose, { Schema, Document } from "mongoose";

export interface IBankAccount extends Document {
    userId: mongoose.Types.ObjectId;
    bankCode: string;
    bankName: string;
    accountNumber: string;
    accountName: string;
    paystackRecipientCode: string;
    createdAt: Date;
    updatedAt: Date;
}

const BankAccountSchema: Schema = new Schema(
    {
        userId: {
            type: Schema.Types.ObjectId,
            ref: "User",
            required: true,
            unique: true,
        },
        bankCode: {
            type: String,
            required: true,
        },
        bankName: {
            type: String,
            required: true,
        },
        accountNumber: {
            type: String,
            required: true,
        },
        accountName: {
            type: String,
            required: true,
        },
        paystackRecipientCode: {
            type: String,
            required: true,
        },
    },
    { timestamps: true },
);

export default mongoose.model<IBankAccount>("BankAccount", BankAccountSchema);
