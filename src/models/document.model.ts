import mongoose, { Schema, Document } from "mongoose";

export interface IDocument extends Document {
    userId: mongoose.Schema.Types.ObjectId;
    documentType:
        | "DRIVING_LICENSE"
        | "GOVERNMENT_ID"
        | "INSURANCE"
        | "REGISTRATION";
    documentUrl: string;
    documentNumber: string;
    expiryDate?: Date;
    verificationStatus: "pending" | "approved" | "rejected";
    rejectionReason?: string;
    uploadedAt: Date;
    updatedAt: Date;
}

const DocumentSchema: Schema = new Schema(
    {
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
        },
        documentType: {
            type: String,
            enum: [
                "DRIVING_LICENSE",
                "GOVERNMENT_ID",
                "INSURANCE",
                "REGISTRATION",
            ],
            required: true,
        },
        documentUrl: { type: String, required: true },
        documentNumber: { type: String, required: true },
        expiryDate: { type: Date },
        verificationStatus: {
            type: String,
            enum: ["pending", "approved", "rejected"],
            default: "pending",
        },
        rejectionReason: { type: String },
        uploadedAt: { type: Date, default: Date.now },
    },
    { timestamps: true },
);

// Index for quick lookup by userId
DocumentSchema.index({ userId: 1, documentType: 1 });

export default mongoose.model<IDocument>("Document", DocumentSchema);
