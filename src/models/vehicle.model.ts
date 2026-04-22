import mongoose, { Schema } from "mongoose";

export interface IVehicle {
    userId: mongoose.Types.ObjectId;
    vehicleType: "BICYCLE" | "MOTORCYCLE" | "TRICYCLE" | "CAR";
    brand: string;
    model: string;
    year: number;
    color: string;
    licensePlate: string;
    registrationNumber?: string;
    imageUrl?: string;
    additionalDetails?: {
        [key: string]: any;
    };
    verificationStatus: "pending" | "approved" | "rejected";
    createdAt: Date;
    updatedAt: Date;
}

const VehicleSchema: Schema = new Schema(
    {
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
        },
        vehicleType: {
            type: String,
            enum: ["BICYCLE", "MOTORCYCLE", "TRICYCLE", "CAR"],
            required: true,
        },
        brand: { type: String, required: true },
        model: { type: String, required: true },
        year: { type: Number, required: true },
        color: { type: String, required: true },
        licensePlate: { type: String, required: true },
        registrationNumber: { type: String },
        imageUrl: { type: String },
        additionalDetails: { type: Schema.Types.Mixed, default: {} },
        verificationStatus: {
            type: String,
            enum: ["pending", "approved", "rejected"],
            default: "pending",
        },
    },
    { timestamps: true },
);

// Index for quick lookup by userId
VehicleSchema.index({ userId: 1 });

export default mongoose.model<IVehicle>("Vehicle", VehicleSchema);
