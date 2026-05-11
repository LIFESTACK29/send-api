import mongoose, { Schema, Document } from "mongoose";

export interface IFareRule extends Document {
    campusId: mongoose.Types.ObjectId;
    pickupZoneId: mongoose.Types.ObjectId;
    dropoffZoneId: mongoose.Types.ObjectId;
    fare: number; // in kobo
    isActive: boolean;
    createdAt: Date;
    updatedAt: Date;
}

const FareRuleSchema: Schema = new Schema(
    {
        campusId: {
            type: Schema.Types.ObjectId,
            ref: "Campus",
            required: true,
        },
        pickupZoneId: {
            type: Schema.Types.ObjectId,
            ref: "Zone",
            required: true,
        },
        dropoffZoneId: {
            type: Schema.Types.ObjectId,
            ref: "Zone",
            required: true,
        },
        fare: { type: Number, required: true, min: 0 },
        isActive: { type: Boolean, default: true },
    },
    { timestamps: true },
);

FareRuleSchema.index(
    { campusId: 1, pickupZoneId: 1, dropoffZoneId: 1 },
    { unique: true },
);

export default mongoose.model<IFareRule>("FareRule", FareRuleSchema);
