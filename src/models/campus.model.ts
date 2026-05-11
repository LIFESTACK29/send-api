import mongoose, { Schema, Document } from "mongoose";

export interface ICampus extends Document {
    name: string;
    code: string;
    isActive: boolean;
    createdAt: Date;
    updatedAt: Date;
}

const CampusSchema: Schema = new Schema(
    {
        name: { type: String, required: true },
        code: { type: String, required: true, unique: true, uppercase: true },
        isActive: { type: Boolean, default: true },
    },
    { timestamps: true },
);

export default mongoose.model<ICampus>("Campus", CampusSchema);
