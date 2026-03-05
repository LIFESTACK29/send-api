import mongoose, { Schema, Document } from "mongoose";

export interface IDelivery extends Document {
    trackingId: string;
    pickupLocation: string;
    dropoffLocation: string;
    packageType: string;
    deliveryNote?: string;
    fee: number;
    status: "PENDING" | "ONGOING" | "DELIVERED" | "CANCELLED";
    customerId: string;
    riderId?: string;
    createdAt: Date;
    updatedAt: Date;
}

const DeliverySchema: Schema = new Schema(
    {
        trackingId: {
            type: String,
            required: true,
            unique: true,
        },
        pickupLocation: {
            type: String,
            required: true,
        },
        dropoffLocation: {
            type: String,
            required: true,
        },
        packageType: {
            type: String,
            required: true,
        },
        deliveryNote: {
            type: String,
            default: "",
        },
        fee: {
            type: Number,
            required: true,
        },
        status: {
            type: String,
            enum: ["PENDING", "ONGOING", "DELIVERED", "CANCELLED"],
            default: "PENDING",
        },
        customerId: {
            type: String,
            required: true,
        },
        riderId: {
            type: String,
        },
    },
    { timestamps: true }
);

export default mongoose.model<IDelivery>("Delivery", DeliverySchema);
