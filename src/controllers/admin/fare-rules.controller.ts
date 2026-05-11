import { Response } from "express";
import { AuthRequest } from "../../types/user.type";
import { CatchAsync } from "../../utils/catchasync.util";
import FareRule from "../../models/fare-rule.model";

// GET /api/v1/admin/fare-rules?campusId=
export const listFareRules = CatchAsync(async (req: AuthRequest, res: Response) => {
    const { campusId } = req.query;
    const filter: Record<string, any> = {};
    if (campusId) filter.campusId = campusId;

    const rules = await FareRule.find(filter)
        .populate("pickupZoneId", "name")
        .populate("dropoffZoneId", "name")
        .sort({ createdAt: -1 })
        .lean();

    res.status(200).json({ success: true, data: rules });
});

// POST /api/v1/admin/fare-rules
export const createFareRule = CatchAsync(async (req: AuthRequest, res: Response) => {
    const { campusId, pickupZoneId, dropoffZoneId, fare } = req.body;

    if (!campusId || !pickupZoneId || !dropoffZoneId || fare === undefined) {
        res.status(400).json({
            message: "campusId, pickupZoneId, dropoffZoneId, and fare are required",
        });
        return;
    }
    if (typeof fare !== "number" || fare < 0) {
        res.status(400).json({ message: "fare must be a non-negative number (in kobo)" });
        return;
    }

    try {
        const rule = await FareRule.create({
            campusId,
            pickupZoneId,
            dropoffZoneId,
            fare,
        });
        res.status(201).json({ success: true, data: rule });
    } catch (err: any) {
        if (err.code === 11000) {
            res.status(409).json({
                message: "A fare rule already exists for this zone pair on this campus",
            });
            return;
        }
        throw err;
    }
});

// PUT /api/v1/admin/fare-rules/:id
export const updateFareRule = CatchAsync(async (req: AuthRequest, res: Response) => {
    const { fare, isActive } = req.body;
    const update: Record<string, any> = {};
    if (fare !== undefined) {
        if (typeof fare !== "number" || fare < 0) {
            res.status(400).json({ message: "fare must be a non-negative number (in kobo)" });
            return;
        }
        update.fare = fare;
    }
    if (isActive !== undefined) update.isActive = isActive;

    const rule = await FareRule.findByIdAndUpdate(req.params.id, update, { new: true });
    if (!rule) {
        res.status(404).json({ message: "Fare rule not found" });
        return;
    }
    res.status(200).json({ success: true, data: rule });
});

// DELETE /api/v1/admin/fare-rules/:id (soft delete)
export const deleteFareRule = CatchAsync(async (req: AuthRequest, res: Response) => {
    const rule = await FareRule.findByIdAndUpdate(
        req.params.id,
        { isActive: false },
        { new: true },
    );
    if (!rule) {
        res.status(404).json({ message: "Fare rule not found" });
        return;
    }
    res.status(200).json({ success: true, message: "Fare rule deactivated" });
});
