import mongoose, { Schema, Document } from "mongoose";

export type LocationCategory =
    | "FACULTY"
    | "HOSTEL"
    | "GATE"
    | "LANDMARK"
    | "FOOD"
    | "ADMIN";

export interface ICampusLocation extends Document {
    campusId: mongoose.Types.ObjectId;
    zoneId: mongoose.Types.ObjectId;
    name: string;
    category: LocationCategory;
    aliases: string[];
    description?: string;
    isActive: boolean;
    displayOrder: number;
    createdBy?: mongoose.Types.ObjectId;
    createdAt: Date;
    updatedAt: Date;
}

const CampusLocationSchema: Schema = new Schema(
    {
        campusId: {
            type: Schema.Types.ObjectId,
            ref: "Campus",
            required: true,
        },
        zoneId: {
            type: Schema.Types.ObjectId,
            ref: "Zone",
            required: true,
        },
        name: { type: String, required: true },
        category: {
            type: String,
            enum: ["FACULTY", "HOSTEL", "GATE", "LANDMARK", "FOOD", "ADMIN"],
            required: true,
        },
        aliases: { type: [String], default: [] },
        description: { type: String },
        isActive: { type: Boolean, default: true },
        displayOrder: { type: Number, default: 0 },
        createdBy: { type: Schema.Types.ObjectId, ref: "User" },
    },
    { timestamps: true },
);

CampusLocationSchema.index({ name: "text", aliases: "text" });
CampusLocationSchema.index({ campusId: 1, isActive: 1, category: 1 });

export default mongoose.model<ICampusLocation>(
    "CampusLocation",
    CampusLocationSchema,
);
