import { Response, RequestHandler } from "express";
import { AuthRequest } from "../types/user.type";
import User from "../models/user.model";
import { getUserAccessState } from "../services/onboarding.service";
import { CatchAsync } from "../utils/catchasync.util";

/**
 * @desc    Get canonical onboarding state for logged-in user
 * @route   GET /api/v1/onboarding/state
 * @access  Private
 */
export const getOnboardingState: RequestHandler = CatchAsync(
    async (req: AuthRequest, res: Response) => {
        const userId = req.user?.userId;
        if (!userId) {
            res.status(401).json({ message: "Unauthorized" });
            return;
        }

        const user = await User.findById(userId);
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
                isOnboarded: user.isOnboarded,
                riderDetails: user.role === "rider" ? user.riderDetails : null,
                accessState,
            },
        });
    }
);
