import mongoose, { Schema, Document } from "mongoose";

export interface ILocation {
    address: string;
    lat: number;
    lng: number;
}

export interface IDelivery extends Document {
    trackingId: string;
    pickupLocation: ILocation;
    dropoffLocation: ILocation;
    packageType: string;
    deliveryNote?: string;
    itemImage?: string;
    distance?: number;
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
            address: { type: String, required: true },
            lat: { type: Number, required: true },
            lng: { type: Number, required: true },
        },
        dropoffLocation: {
            address: { type: String, required: true },
            lat: { type: Number, required: true },
            lng: { type: Number, required: true },
        },
        packageType: {
            type: String,
            required: true,
        },
        deliveryNote: {
            type: String,
            default: "",
        },
        itemImage: {
            type: String,
        },
        distance: {
            type: Number,
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
            ref: "User",
            required: true,
        },
        riderId: {
            type: String,
            ref: "User",
        },
    },
    { timestamps: true }
);

export default mongoose.model<IDelivery>("Delivery", DeliverySchema);
