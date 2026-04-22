"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const mongoose_1 = __importStar(require("mongoose"));
const DeliveryMatchRequestSchema = new mongoose_1.Schema({
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
}, { timestamps: true });
exports.default = mongoose_1.default.model("DeliveryMatchRequest", DeliveryMatchRequestSchema);
