import { Response, RequestHandler } from "express";
import User from "../models/user.model";
import Vehicle from "../models/vehicle.model";
import Document from "../models/document.model";
import { AuthRequest } from "../types/user.type";
import { CatchAsync } from "../utils/catchasync.util";
import {
    getUserAccessState,
    syncUserOnboardingState,
} from "../services/onboarding.service";

/**
 * @desc    Update rider personal details
 * @route   PATCH /api/v1/riders/:userId/personal-details
 * @access  Private
 */
export const updatePersonalDetails: RequestHandler = CatchAsync(
    async (req: AuthRequest, res: Response) => {
        const { userId } = req.params;
        const { middleName, dateOfBirth, ninNumber, stateOfResidence, operationalArea } =
            req.body;

        if (!dateOfBirth || !ninNumber || !stateOfResidence || !operationalArea) {
            res.status(400).json({
                success: false,
                message: "Date of birth, NIN number, state of residence, and operational area are required",
            });
            return;
        }

        if (!/^\d{11}$/.test(ninNumber)) {
            res.status(400).json({
                success: false,
                message: "NIN number must be exactly 11 digits",
            });
            return;
        }

        const user = await User.findById(userId);
        if (!user || user.role !== "rider") {
            res.status(404).json({ success: false, message: "Rider not found" });
            return;
        }

        user.dateOfBirth = new Date(dateOfBirth);
        user.ninNumber = ninNumber.trim();
        user.stateOfResidence = stateOfResidence.trim();
        user.operationalArea = operationalArea.trim();
        if (middleName) user.middleName = middleName.trim();

        await user.save();

        const syncedUser = await syncUserOnboardingState(userId);
        const accessState = syncedUser
            ? await getUserAccessState(syncedUser)
            : undefined;

        res.status(200).json({
            success: true,
            message: "Personal details updated successfully",
            data: { accessState },
        });
    },
);

/**
 * @desc    Submit rider for verification
 * @route   POST /api/v1/riders/:userId/submit-verification
 * @access  Private
 */
export const submitForVerification: RequestHandler = CatchAsync(
    async (req: AuthRequest, res: Response) => {
        const { userId } = req.params;

        const user = await User.findById(userId);
        if (!user || user.role !== "rider") {
            res.status(404).json({ success: false, message: "Rider not found" });
            return;
        }

        // Check if all required documents are uploaded
        const [vehicles, documents] = await Promise.all([
            Vehicle.find({ userId }),
            Document.find({ userId }),
        ]);

        const hasVehicle = vehicles.length > 0;
        const hasPersonalDetails = Boolean(
            user.ninNumber && user.stateOfResidence && user.operationalArea,
        );
        const hasVehicleImage = vehicles.some((v) => v.imageUrl);
        const hasRequiredDocs = ["NIN_DOCUMENT", "RIDERS_PERMIT"].every((type) =>
            documents.some((d) => d.documentType === type),
        );

        if (
            !user.profileImageUrl ||
            !hasPersonalDetails ||
            !hasVehicle ||
            !hasVehicleImage ||
            !hasRequiredDocs
        ) {
            res.status(400).json({
                success: false,
                message: "All onboarding steps must be completed before submission",
            });
            return;
        }

        user.riderStatus = "pending_verification";
        user.onboardingStage = "review_pending";
        user.verificationStatus = "pending";
        await user.save();

        const syncedUser = await syncUserOnboardingState(userId);
        const accessState = syncedUser
            ? await getUserAccessState(syncedUser)
            : undefined;

        res.status(200).json({
            success: true,
            message: "Rider submitted for verification",
            data: { accessState },
        });
    },
);
