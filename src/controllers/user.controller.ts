import { Request, Response, RequestHandler } from "express";
import User from "../models/user.model";

export const getAuthStatus: RequestHandler = async (req, res) => {
    try {
        const { clerkId } = req.params;

        console.log("Clerk ID:", req.params);

        if (!clerkId) {
            res.status(400).json({ message: "Clerk ID is required" });
            return;
        }

        const user = await User.findOne({ clerkId });

        if (!user) {
            res.status(200).json({ exists: false });
            return;
        }

        res.status(200).json({
            exists: true,
            user: {
                role: user.role,
                isOnboarded: user.isOnboarded,
                email: user.email,
                fullName: user.fullName,
                phoneNumber: user.phoneNumber,
                addresses: user.addresses,
            },
        });
        return;
    } catch (error: any) {
        console.error("Error in getAuthStatus:", error);
        res.status(500).json({ message: "Internal server error" });
        return;
    }
};

export const onboardUser: RequestHandler = async (req, res) => {
    console.log("HIT HERE");
    try {
        const { clerkId, email, fullName, phoneNumber, role } = req.body;

        console.log("BODY: ", req.body);

        if (!clerkId || !email || !role) {
            res.status(400).json({ message: "Missing required fields" });
            return;
        }

        let user = await User.findOne({ clerkId });

        if (user) {
            user.fullName = fullName || user.fullName;
            user.phoneNumber = phoneNumber || user.phoneNumber;
            user.role = role;
            user.isOnboarded = true;
            await user.save();
        } else {
            user = await User.create({
                clerkId,
                email,
                fullName,
                phoneNumber,
                role,
                isOnboarded: true,
            });
        }

        res.status(201).json({
            message: "User onboarded successfully",
            user: {
                role: user.role,
                isOnboarded: user.isOnboarded,
            },
        });
        return;
    } catch (error: any) {
        console.error("Error in onboardUser:", error);
        res.status(500).json({ message: "Internal server error" });
        return;
    }
};

export const updateProfile: RequestHandler = async (req, res) => {
    try {
        const { clerkId } = req.params;
        const { fullName, phoneNumber } = req.body;

        if (!clerkId) {
            res.status(400).json({ message: "Clerk ID is required" });
            return;
        }

        const user = await User.findOne({ clerkId });

        if (!user) {
            res.status(404).json({ message: "User not found" });
            return;
        }

        // Update fields if provided
        if (fullName !== undefined) user.fullName = fullName;
        if (phoneNumber !== undefined) user.phoneNumber = phoneNumber;

        await user.save();

        res.status(200).json({
            message: "Profile updated successfully",
            user: {
                role: user.role,
                isOnboarded: user.isOnboarded,
                email: user.email,
                fullName: user.fullName,
                phoneNumber: user.phoneNumber,
                addresses: user.addresses,
            },
        });
        return;
    } catch (error: any) {
        console.error("Error in updateProfile:", error);
        res.status(500).json({ message: "Internal server error" });
        return;
    }
};

export const addAddress: RequestHandler = async (req, res) => {
    try {
        const { clerkId } = req.params;
        const { name, location, landmark } = req.body;

        if (!clerkId) {
            res.status(400).json({ message: "Clerk ID is required" });
            return;
        }

        if (!name || !location) {
            res.status(400).json({ message: "Name and location are required" });
            return;
        }

        console.log(
            `[DEBUG] Attempting to find user with clerkId: "${clerkId}"`,
        );

        const user = await User.findOneAndUpdate(
            { clerkId },
            { $push: { addresses: { name, location, landmark } } },
            { new: true, runValidators: true },
        );

        if (!user) {
            res.status(404).json({ message: "User not found" });
            return;
        }

        res.status(201).json({
            message: "Address added successfully",
            user: {
                role: user.role,
                isOnboarded: user.isOnboarded,
                email: user.email,
                fullName: user.fullName,
                phoneNumber: user.phoneNumber,
                addresses: user.addresses,
            },
        });
        return;
    } catch (error: any) {
        console.error("Error in addAddress:", error);
        res.status(500).json({ message: "Internal server error" });
        return;
    }
};

export const editAddress: RequestHandler = async (req, res) => {
    try {
        const { clerkId, addressId } = req.params;
        const { name, location, landmark } = req.body;

        if (!clerkId || !addressId) {
            res.status(400).json({
                message: "Clerk ID and Address ID are required",
            });
            return;
        }

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
            { clerkId },
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
            user: {
                role: user.role,
                isOnboarded: user.isOnboarded,
                email: user.email,
                fullName: user.fullName,
                phoneNumber: user.phoneNumber,
                addresses: user.addresses,
            },
        });
        return;
    } catch (error: any) {
        console.error("Error in editAddress:", error);
        res.status(500).json({ message: "Internal server error" });
        return;
    }
};

export const deleteAddress: RequestHandler = async (req, res) => {
    try {
        const { clerkId, addressId } = req.params;

        if (!clerkId || !addressId) {
            res.status(400).json({
                message: "Clerk ID and Address ID are required",
            });
            return;
        }

        const user = await User.findOneAndUpdate(
            { clerkId },
            { $pull: { addresses: { _id: addressId } } },
            { new: true },
        );

        if (!user) {
            res.status(404).json({ message: "User not found" });
            return;
        }

        res.status(200).json({
            message: "Address deleted successfully",
            user: {
                role: user.role,
                isOnboarded: user.isOnboarded,
                email: user.email,
                fullName: user.fullName,
                phoneNumber: user.phoneNumber,
                addresses: user.addresses,
            },
        });
        return;
    } catch (error: any) {
        console.error("Error in deleteAddress:", error);
        res.status(500).json({ message: "Internal server error" });
        return;
    }
};
