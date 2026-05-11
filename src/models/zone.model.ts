import mongoose, { Schema, Document } from "mongoose";

export interface IZone extends Document {
    campusId: mongoose.Types.ObjectId;
    name: string;
    isActive: boolean;
    displayOrder: number;
    createdAt: Date;
    updatedAt: Date;
}

const ZoneSchema: Schema = new Schema(
    {
        campusId: {
            type: Schema.Types.ObjectId,
            ref: "Campus",
            required: true,
            index: true,
        },
        name: { type: String, required: true },
        isActive: { type: Boolean, default: true },
        displayOrder: { type: Number, default: 0 },
    },
    { timestamps: true },
);

export default mongoose.model<IZone>("Zone", ZoneSchema);
