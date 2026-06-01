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
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const mongoose_1 = __importStar(require("mongoose"));
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const AddressSchema = new mongoose_1.Schema({
    name: { type: String, required: true },
    location: { type: String, required: true },
    landmark: { type: String },
});
const RiderDetailsSchema = new mongoose_1.Schema({
    nin: { type: String, required: true },
    vehicleType: { type: String, required: true },
    profileImage: { type: String, required: true },
    submittedAt: { type: Date, default: Date.now },
});
const UserSchema = new mongoose_1.Schema({
    firstName: { type: String, required: true },
    lastName: { type: String, required: true },
    middleName: { type: String },
    email: { type: String, required: true, unique: true },
    phoneNumber: { type: String, required: true },
    password: { type: String, required: true, select: false },
    role: {
        type: String,
        enum: ["customer", "rider", "admin", "keke_rider", "operations"],
        required: true,
    },
    isOnboarded: { type: Boolean, default: false },
    isOnline: { type: Boolean, default: false },
    lastLocationUpdate: { type: Date },
    currentLocation: {
        type: {
            type: String,
            enum: ["Point"],
        },
        coordinates: {
            type: [Number],
        },
    },
    addresses: { type: [AddressSchema], default: [] },
    pushToken: { type: String },
    riderDetails: RiderDetailsSchema,
    walletProvisioningStatus: {
        type: String,
        enum: ["not_started", "creating", "active", "failed"],
        default: "not_started",
    },
    kekeRiderProfile: {
        campusId: { type: mongoose_1.Schema.Types.ObjectId, ref: "Campus" },
        onboardedBy: { type: mongoose_1.Schema.Types.ObjectId, ref: "User" },
        onboardedAt: { type: Date },
        tricycleIdentifier: { type: String },
        profileImage: { type: String },
        notes: { type: String },
        status: {
            type: String,
            enum: ["PENDING_BANK_SETUP", "ACTIVE", "DEACTIVATED"],
            default: "PENDING_BANK_SETUP",
        },
        bankAccountVerifiedAt: { type: Date },
        deactivatedAt: { type: Date },
        deactivationReason: { type: String },
    },
}, { timestamps: true });
UserSchema.index({ currentLocation: "2dsphere" }, {
    partialFilterExpression: {
        "currentLocation.type": "Point",
        "currentLocation.coordinates.1": { $exists: true },
    },
});
// Hash password before saving
UserSchema.pre("save", function (next) {
    return __awaiter(this, void 0, void 0, function* () {
        if (!this.isModified("password"))
            return next();
        const salt = yield bcryptjs_1.default.genSalt(12);
        this.password = yield bcryptjs_1.default.hash(this.password, salt);
        next();
    });
});
// Compare password method
UserSchema.methods.comparePassword = function (candidatePassword) {
    return __awaiter(this, void 0, void 0, function* () {
        return bcryptjs_1.default.compare(candidatePassword, this.password);
    });
};
exports.default = mongoose_1.default.model("User", UserSchema);
