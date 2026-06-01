import mongoose, { Schema, Document } from "mongoose";
import bcrypt from "bcryptjs";

export interface IAddress {
    name: string;
    location: string;
    landmark?: string;
}

export interface IRiderDetails {
    nin: string;
    vehicleType: string;
    profileImage: string;
    submittedAt?: Date;
}

export interface IKekeRiderProfile {
    campusId: mongoose.Types.ObjectId;
    onboardedBy?: mongoose.Types.ObjectId;
    onboardedAt?: Date;
    tricycleIdentifier: string;
    profileImage?: string;
    notes?: string;
    status: "PENDING_BANK_SETUP" | "ACTIVE" | "DEACTIVATED";
    bankAccountVerifiedAt?: Date;
    deactivatedAt?: Date;
    deactivationReason?: string;
}

export interface IUser extends Document {
    firstName: string;
    lastName: string;
    middleName?: string;
    email: string;
    phoneNumber: string;
    password: string;
    role: "customer" | "rider" | "admin" | "keke_rider" | "operations";
    isOnline: boolean;
    currentLocation?: {
        type: "Point";
        coordinates: [number, number];
    };
    lastLocationUpdate?: Date;
    pushToken?: string;
    createdAt: Date;
    isOnboarded: boolean;
    updatedAt: Date;
    riderDetails?: IRiderDetails;
    kekeRiderProfile?: IKekeRiderProfile;
    comparePassword(candidatePassword: string): Promise<boolean>;
}

const AddressSchema = new Schema<IAddress>({
    name: { type: String, required: true },
    location: { type: String, required: true },
    landmark: { type: String },
});

const RiderDetailsSchema = new Schema<IRiderDetails>({
    nin: { type: String, required: true },
    vehicleType: { type: String, required: true },
    profileImage: { type: String, required: true },
    submittedAt: { type: Date, default: Date.now },
});

const UserSchema: Schema = new Schema(
    {
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
        kekeRiderProfile: {
            campusId: { type: Schema.Types.ObjectId, ref: "Campus" },
            onboardedBy: { type: Schema.Types.ObjectId, ref: "User" },
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
    },
    { timestamps: true },
);

UserSchema.index(
    { currentLocation: "2dsphere" },
    {
        partialFilterExpression: {
            "currentLocation.type": "Point",
            "currentLocation.coordinates.1": { $exists: true },
        },
    },
);

// Hash password before saving
UserSchema.pre("save", async function (next) {
    if (!this.isModified("password")) return next();
    const salt = await bcrypt.genSalt(12);
    this.password = await bcrypt.hash(this.password as string, salt);
    next();
});

// Compare password method
UserSchema.methods.comparePassword = async function (
    candidatePassword: string,
): Promise<boolean> {
    return bcrypt.compare(candidatePassword, this.password);
};

export default mongoose.model<IUser>("User", UserSchema);
