import mongoose, { Schema, Document } from "mongoose";

export interface IOtp extends Document {
    userId: mongoose.Types.ObjectId;
    code: string;
    expiresAt: Date;
    createdAt: Date;
}

const OtpSchema: Schema = new Schema({
    userId: {
        type: Schema.Types.ObjectId,
        ref: "User",
        required: true,
    },
    code: {
        type: String,
        required: true,
    },
    expiresAt: {
        type: Date,
        required: true,
        index: { expires: 0 }, // TTL index — auto-deletes when expiresAt is reached
    },
    createdAt: {
        type: Date,
        default: Date.now,
    },
});

export default mongoose.model<IOtp>("Otp", OtpSchema);
