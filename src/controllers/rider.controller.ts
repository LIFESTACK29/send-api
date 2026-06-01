import { Response, RequestHandler } from "express";
import User from "../models/user.model";
import { AuthRequest } from "../types/user.type";
import { CatchAsync } from "../utils/catchasync.util";
import { getUserAccessState } from "../services/onboarding.service";

/**
 * @desc    Submit rider KYC details
 * @route   POST /api/v1/riders/:userId/kyc-details
 * @access  Private
 */
export const submitRiderKyc: RequestHandler = CatchAsync(
    async (req: AuthRequest, res: Response) => {
        const { userId } = req.params;
        const { nin, vehicleType, profileImage } = req.body;

        if (!nin || !vehicleType || !profileImage) {
            res.status(400).json({
                success: false,
                message: "NIN, vehicle type, and profile image are required",
            });
            return;
        }

        if (!/^\d{11}$/.test(nin)) {
            res.status(400).json({
                success: false,
                message: "NIN must be exactly 11 digits",
            });
            return;
        }

        const user = await User.findById(userId);
        if (!user || user.role !== "rider") {
            res.status(404).json({ success: false, message: "Rider not found" });
            return;
        }

        user.riderDetails = {
            nin: nin.trim(),
            vehicleType,
            profileImage,
            submittedAt: new Date(),
        };

        await user.save();

        const accessState = await getUserAccessState(user);

        res.status(200).json({
            success: true,
            message: "KYC details submitted successfully. Awaiting admin approval.",
            data: user.riderDetails,
            accessState,
        });
    },
);
