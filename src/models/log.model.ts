import mongoose, { Schema, Document } from "mongoose";

export interface ILog extends Document {
    event: string;
    payload: any;
    email?: string;
    success: boolean;
    reason?: string;
    createdAt: Date;
    updatedAt: Date;
}

const LogSchema: Schema = new Schema(
    {
        event: {
            type: String,
            required: true,
            index: true,
        },
        payload: {
            type: Schema.Types.Mixed,
            required: true,
        },
        email: {
            type: String,
            index: true,
        },
        success: {
            type: Boolean,
            required: true,
            default: true,
        },
        reason: {
            type: String,
        },
    },
    { timestamps: true },
);

export default mongoose.model<ILog>("Log", LogSchema);
