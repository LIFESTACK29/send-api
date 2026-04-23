import { Response, RequestHandler } from "express";
import { AuthRequest } from "../types/user.type";
import User from "../models/user.model";
import {
    getUserAccessState,
    syncUserOnboardingState,
} from "../services/onboarding.service";

/**
 * @desc    Get canonical onboarding state for logged-in user
 * @route   GET /api/v1/onboarding/state
 * @access  Private
 */
export const getOnboardingState: RequestHandler = async (
    req: AuthRequest,
    res: Response,
) => {
    try {
        const userId = req.user?.userId;
        if (!userId) {
            res.status(401).json({ message: "Unauthorized" });
            return;
        }

        const user = await syncUserOnboardingState(userId);
        if (!user) {
            res.status(404).json({ message: "User not found" });
            return;
        }

        const accessState = await getUserAccessState(user);

        res.status(200).json({
            success: true,
            data: {
                userId: user._id,
                role: user.role,
                riderStatus: user.riderStatus,
                onboardingStage: user.onboardingStage,
                verificationStatus: user.verificationStatus,
                accessState,
            },
        });
    } catch (error: any) {
        console.error("Error in getOnboardingState:", error);
        res.status(500).json({ message: "Internal server error" });
    }
};

