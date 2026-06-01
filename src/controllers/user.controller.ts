import { Response, RequestHandler } from "express";
import User from "../models/user.model";
import { AuthRequest } from "../types/user.type";
import { getUserAccessState } from "../services/onboarding.service";
import { CatchAsync } from "../utils/catchasync.util";

const buildUserResponse = async (user: any) => {
    const accessState = await getUserAccessState(user);

    const response: any = {
        id: user._id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        phoneNumber: user.phoneNumber,
        role: user.role,
        isOnboarded: user.isOnboarded,
        accessState,
    };

    // Include rider details if user is a rider
    if (user.role === "rider" && user.riderDetails) {
        response.riderDetails = {
            nin: user.riderDetails.nin,
            vehicleType: user.riderDetails.vehicleType,
            submittedAt: user.riderDetails.submittedAt,
        };
    }

    return response;
};

/**
 * @desc    Get current user profile
 * @route   GET /api/v1/user/profile
 * @access  Private
 */
export const getProfile: RequestHandler = CatchAsync(
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

        res.status(200).json({
            user: await buildUserResponse(user),
        });
    }
);

/**
 * @desc    Update user profile
 * @route   PATCH /api/v1/user/profile
 * @access  Private
 */
export const updateProfile: RequestHandler = CatchAsync(
    async (req: AuthRequest, res: Response) => {
        const userId = req.user?.userId;

        if (!userId) {
            res.status(401).json({ message: "Unauthorized" });
            return;
        }

        const { firstName, lastName, phoneNumber } = req.body;

        const user = await User.findById(userId);

        if (!user) {
            res.status(404).json({ message: "User not found" });
            return;
        }

        if (firstName !== undefined) user.firstName = firstName;
        if (lastName !== undefined) user.lastName = lastName;
        if (phoneNumber !== undefined) user.phoneNumber = phoneNumber;

        await user.save();

        res.status(200).json({
            message: "Profile updated successfully",
            user: await buildUserResponse(user),
        });
    }
);

/**
 * @desc    Add an address
 * @route   POST /api/v1/user/addresses
 * @access  Private
 */
export const addAddress: RequestHandler = CatchAsync(
    async (req: AuthRequest, res: Response) => {
        const userId = req.user?.userId;

        if (!userId) {
            res.status(401).json({ message: "Unauthorized" });
            return;
        }

        const { name, location, landmark } = req.body;

        if (!name || !location) {
            res.status(400).json({ message: "Name and location are required" });
            return;
        }

        const user = await User.findByIdAndUpdate(
            userId,
            { $push: { addresses: { name, location, landmark } } },
            { new: true, runValidators: true },
        );

        if (!user) {
            res.status(404).json({ message: "User not found" });
            return;
        }

        res.status(201).json({
            message: "Address added successfully",
            user: await buildUserResponse(user),
        });
    }
);

/**
 * @desc    Edit an address
 * @route   PUT /api/v1/user/addresses/:addressId
 * @access  Private
 */
export const editAddress: RequestHandler = CatchAsync(
    async (req: AuthRequest, res: Response) => {
        const userId = req.user?.userId;
        const { addressId } = req.params;

        if (!userId || !addressId) {
            res.status(400).json({
                message: "Address ID is required",
            });
            return;
        }

        const { name, location, landmark } = req.body;

        const updateFields: any = {};
        if (name !== undefined) updateFields["addresses.$[elem].name"] = name;
        if (location !== undefined)
            updateFields["addresses.$[elem].location"] = location;
        if (landmark !== undefined)
            updateFields["addresses.$[elem].landmark"] = landmark;

        if (Object.keys(updateFields).length === 0) {
            res.status(400).json({
                message: "No fields to update for this address",
            });
            return;
        }

        const user = await User.findOneAndUpdate(
            { _id: userId },
            { $set: updateFields },
            {
                new: true,
                runValidators: true,
                arrayFilters: [{ "elem._id": addressId }],
            },
        );

        if (!user) {
            res.status(404).json({ message: "User or address not found" });
            return;
        }

        res.status(200).json({
            message: "Address updated successfully",
            user: await buildUserResponse(user),
        });
    }
);

/**
 * @desc    Delete an address
 * @route   DELETE /api/v1/user/addresses/:addressId
 * @access  Private
 */
export const deleteAddress: RequestHandler = CatchAsync(
    async (req: AuthRequest, res: Response) => {
        const userId = req.user?.userId;
        const { addressId } = req.params;

        if (!userId || !addressId) {
            res.status(400).json({
                message: "Address ID is required",
            });
            return;
        }

        const user = await User.findOneAndUpdate(
            { _id: userId },
            { $pull: { addresses: { _id: addressId } } },
            { new: true },
        );

        if (!user) {
            res.status(404).json({ message: "User not found" });
            return;
        }

        res.status(200).json({
            message: "Address deleted successfully",
            user: await buildUserResponse(user),
        });
    }
);

/**
 * @desc    Update user's push token
 * @route   PATCH /api/v1/user/push-token
 * @access  Private
 */
export const updatePushToken: RequestHandler = CatchAsync(
    async (req: AuthRequest, res: Response) => {
        const userId = req.user?.userId;
        const { pushToken } = req.body;

        if (!userId) {
            res.status(401).json({ message: "Unauthorized" });
            return;
        }

        if (!pushToken) {
            res.status(400).json({ message: "Push token is required" });
            return;
        }

        const user = await User.findByIdAndUpdate(
            userId,
            { pushToken },
            { new: true }
        );

        if (!user) {
            res.status(404).json({ message: "User not found" });
            return;
        }

        res.status(200).json({
            message: "Push token updated successfully",
        });
    }
);
