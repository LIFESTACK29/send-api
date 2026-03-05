import mongoose, { Schema, Document } from "mongoose";

export interface IAddress {
    name: string;
    location: string;
    landmark?: string;
}

export interface IUser extends Document {
    clerkId: string;
    email: string;
    fullName?: string;
    phoneNumber?: string;
    role: "customer" | "rider";
    isOnboarded: boolean;
    addresses: mongoose.Types.DocumentArray<IAddress>;
    createdAt: Date;
    updatedAt: Date;
}

const AddressSchema = new Schema<IAddress>({
    name: { type: String, required: true },
    location: { type: String, required: true },
    landmark: { type: String },
});

const UserSchema: Schema = new Schema(
    {
        clerkId: { type: String, required: true, unique: true },
        email: { type: String, required: true, unique: true },
        fullName: { type: String },
        phoneNumber: { type: String },
        role: { type: String, enum: ["customer", "rider"], required: true },
        isOnboarded: { type: Boolean, default: false },
        addresses: { type: [AddressSchema], default: [] },
    },
    { timestamps: true },
);

export default mongoose.model<IUser>("User", UserSchema);
