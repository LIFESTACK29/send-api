import mongoose, { Schema, Document } from "mongoose";

export interface ILocation {
    address: string;
    lat: number;
    lng: number;
    shortName?: string;
}

export interface IContactDetails {
    fullName: string;
    email: string;
    phoneNumber: string;
}

export interface IDelivery extends Document {
    trackingId: string;
    pickupLocation: ILocation;
    dropoffLocation: ILocation;
    customer: IContactDetails;
    receiver: IContactDetails;
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
            shortName: { type: String },
        },
        dropoffLocation: {
            address: { type: String, required: true },
            lat: { type: Number, required: true },
            lng: { type: Number, required: true },
            shortName: { type: String },
        },
        customer: {
            fullName: { type: String, required: true },
            email: { type: String, required: true },
            phoneNumber: { type: String, required: true },
        },
        receiver: {
            fullName: { type: String, required: true },
            email: { type: String, required: true },
            phoneNumber: { type: String, required: true },
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
