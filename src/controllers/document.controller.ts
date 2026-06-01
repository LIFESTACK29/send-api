import { Request, Response, RequestHandler } from "express";
import User from "../models/user.model";
import { AuthRequest } from "../types/user.type";
import { CatchAsync } from "../utils/catchasync.util";
import { getUserAccessState } from "../services/onboarding.service";

/**
 * @desc    Get all riders pending KYC verification for admin
 * @route   GET /api/v1/admin/riders
 * @access  Private (Admin only)
 */
export const getAllRidersForAdmin: RequestHandler = CatchAsync(
    async (req: AuthRequest, res: Response) => {
        const { status } = req.query;

        const query: any = {
            role: "rider",
            riderDetails: { $exists: true },
        };

        if (status === "pending") {
            query.isOnboarded = false;
        } else if (status === "approved") {
            query.isOnboarded = true;
        }

        const riders = await User.find(query)
            .select(
                "firstName lastName email phoneNumber isOnboarded riderDetails createdAt updatedAt"
            )
            .limit(100)
            .sort({ createdAt: -1 });

        const ridersWithDetails = riders.map((rider) => ({
            id: rider._id,
            firstName: rider.firstName,
            lastName: rider.lastName,
            email: rider.email,
            phoneNumber: rider.phoneNumber,
            isOnboarded: rider.isOnboarded,
            riderDetails: {
                nin: rider.riderDetails?.nin,
                vehicleType: rider.riderDetails?.vehicleType,
                submittedAt: rider.riderDetails?.submittedAt,
            },
            createdAt: rider.createdAt,
            updatedAt: rider.updatedAt,
        }));

        res.status(200).json({
            success: true,
            data: ridersWithDetails,
        });
    }
);

/**
 * @desc    Get rider KYC details for admin review
 * @route   GET /api/v1/admin/riders/:userId
 * @access  Private (Admin only)
 */
export const getRiderVerificationDetail: RequestHandler = CatchAsync(
    async (req: AuthRequest, res: Response) => {
        const { userId } = req.params;

        const rider = await User.findById(userId);
        if (!rider || rider.role !== "rider") {
            res.status(404).json({
                success: false,
                message: "Rider not found",
            });
            return;
        }

        if (!rider.riderDetails) {
            res.status(400).json({
                success: false,
                message: "Rider has not submitted KYC details yet",
            });
            return;
        }

        res.status(200).json({
            success: true,
            data: {
                id: rider._id,
                firstName: rider.firstName,
                lastName: rider.lastName,
                email: rider.email,
                phoneNumber: rider.phoneNumber,
                isOnboarded: rider.isOnboarded,
                riderDetails: {
                    nin: rider.riderDetails.nin,
                    vehicleType: rider.riderDetails.vehicleType,
                    profileImage: rider.riderDetails.profileImage,
                    submittedAt: rider.riderDetails.submittedAt,
                },
                createdAt: rider.createdAt,
                updatedAt: rider.updatedAt,
            },
        });
    }
);

/**
 * @desc    Admin approve/reject rider KYC
 * @route   PUT /api/v1/admin/riders/:userId/verify
 * @access  Private (Admin only)
 */
export const verifyRider: RequestHandler = CatchAsync(
    async (req: AuthRequest, res: Response) => {
        const { userId } = req.params;
        const { approved, notes } = req.body;

        if (typeof approved !== "boolean") {
            res.status(400).json({
                success: false,
                message: "Approved status is required",
            });
            return;
        }

        const rider = await User.findById(userId);
        if (!rider || rider.role !== "rider") {
            res.status(404).json({
                success: false,
                message: "Rider not found",
            });
            return;
        }

        if (!rider.riderDetails) {
            res.status(400).json({
                success: false,
                message: "Rider has not submitted KYC details yet",
            });
            return;
        }

        if (approved) {
            rider.isOnboarded = true;
        } else {
            rider.isOnboarded = false;
        }

        await rider.save();

        const accessState = await getUserAccessState(rider);

        res.status(200).json({
            success: true,
            message: approved
                ? "Rider approved successfully"
                : "Rider rejected",
            data: {
                userId: rider._id,
                isOnboarded: rider.isOnboarded,
                accessState,
            },
        });
    }
);
