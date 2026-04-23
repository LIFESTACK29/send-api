import mongoose, { Schema, Document } from "mongoose";
import bcrypt from "bcryptjs";

export interface IAddress {
    name: string;
    location: string;
    landmark?: string;
}

export interface IUser extends Document {
    firstName: string;
    lastName: string;
    email: string;
    phoneNumber: string;
    password: string;
    role: "customer" | "rider" | "admin";
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
    // Rider-specific fields
    riderStatus?: "incomplete" | "pending_verification" | "active" | "rejected";
    profileImageUrl?: string;
    verificationNotes?: string;
    comparePassword(candidatePassword: string): Promise<boolean>;
}

const AddressSchema = new Schema<IAddress>({
    name: { type: String, required: true },
    location: { type: String, required: true },
    landmark: { type: String },
});

const UserSchema: Schema = new Schema(
    {
        firstName: { type: String, required: true },
        lastName: { type: String, required: true },
        email: { type: String, required: true, unique: true },
        phoneNumber: { type: String, required: true },
        password: { type: String, required: true, select: false },
        role: {
            type: String,
            enum: ["customer", "rider", "admin"],
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
            default: undefined,
        },
        addresses: { type: [AddressSchema], default: [] },
        pushToken: { type: String },
        // Rider-specific fields
        riderStatus: {
            type: String,
            enum: ["incomplete", "pending_verification", "active", "rejected"],
            default: "incomplete",
        },
        profileImageUrl: { type: String },
        verificationNotes: { type: String },
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
