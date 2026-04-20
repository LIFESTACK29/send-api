import mongoose, { Schema, Document } from "mongoose";

export interface IWallet extends Document {
    userId: mongoose.Types.ObjectId;
    balance: number; // stored in kobo (100 kobo = ₦1)
    paystackCustomerCode: string;
    dedicatedAccountNumber?: string;
    dedicatedBankName?: string;
    dedicatedAccountName?: string;
    dedicatedAccountReference?: string;
    createdAt: Date;
    updatedAt: Date;
}

const WalletSchema: Schema = new Schema(
    {
        userId: {
            type: Schema.Types.ObjectId,
            ref: "User",
            required: true,
            unique: true,
        },
        balance: {
            type: Number,
            default: 0,
            min: 0,
        },
        paystackCustomerCode: {
            type: String,
            required: true,
        },
        dedicatedAccountNumber: {
            type: String,
        },
        dedicatedBankName: {
            type: String,
        },
        dedicatedAccountName: {
            type: String,
        },
        dedicatedAccountReference: {
            type: String,
        },
    },
    { timestamps: true },
);

export default mongoose.model<IWallet>("Wallet", WalletSchema);
