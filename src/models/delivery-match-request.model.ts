import mongoose, { Schema, Document } from "mongoose";
import { IContactDetails, ILocation } from "./delivery.model";

export type MatchRequestStatus =
    | "SEARCHING"
    | "NO_RIDER_FOUND"
    | "RIDER_ASSIGNED"
    | "MANUAL_CREATED"
    | "CANCELLED";

export interface IDeliveryMatchRequest extends Document {
    customerId: string;
    pickupLocation: ILocation;
    dropoffLocation: ILocation;
    customer: IContactDetails;
    receiver: IContactDetails;
    packageType: string;
    deliveryNote?: string;
    itemImage: string;
    distance: number;
    fee: number;
    status: MatchRequestStatus;
    matchedRiderId?: string;
    createdDeliveryId?: string;
    searchRadiusMeters: number;
    timeoutSeconds: number;
    declinedRiderIds: string[];
    createdAt: Date;
    updatedAt: Date;
}

const DeliveryMatchRequestSchema: Schema = new Schema(
    {
        customerId: {
            type: String,
            ref: "User",
            required: true,
            index: true,
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
            required: true,
        },
        distance: {
            type: Number,
            required: true,
        },
        fee: {
            type: Number,
            required: true,
        },
        status: {
            type: String,
            enum: [
                "SEARCHING",
                "NO_RIDER_FOUND",
                "RIDER_ASSIGNED",
                "MANUAL_CREATED",
                "CANCELLED",
            ],
            default: "SEARCHING",
            index: true,
        },
        matchedRiderId: {
            type: String,
            ref: "User",
        },
        createdDeliveryId: {
            type: String,
            ref: "Delivery",
        },
        searchRadiusMeters: {
            type: Number,
            default: 5000,
        },
        timeoutSeconds: {
            type: Number,
            default: 60,
        },
        declinedRiderIds: {
            type: [String],
            default: [],
        },
    },
    { timestamps: true },
);

export default mongoose.model<IDeliveryMatchRequest>(
    "DeliveryMatchRequest",
    DeliveryMatchRequestSchema,
);
