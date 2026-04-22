"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.updatePushToken = exports.deleteAddress = exports.editAddress = exports.addAddress = exports.updateProfile = exports.getProfile = void 0;
const user_model_1 = __importDefault(require("../models/user.model"));
/**
 * @desc    Get current user profile
 * @route   GET /api/v1/user/profile
 * @access  Private
 */
const getProfile = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    try {
        const userId = (_a = req.user) === null || _a === void 0 ? void 0 : _a.userId;
        if (!userId) {
            res.status(401).json({ message: "Unauthorized" });
            return;
        }
        const user = yield user_model_1.default.findById(userId);
        if (!user) {
            res.status(404).json({ message: "User not found" });
            return;
        }
        res.status(200).json({
            user: {
                id: user._id,
                firstName: user.firstName,
                lastName: user.lastName,
                email: user.email,
                phoneNumber: user.phoneNumber,
                role: user.role,
                isOnboarded: user.isOnboarded,
                // addresses: user.addresses,
            },
        });
    }
    catch (error) {
        console.error("Error in getProfile:", error);
        res.status(500).json({ message: "Internal server error" });
    }
});
exports.getProfile = getProfile;
/**
 * @desc    Update user profile
 * @route   PATCH /api/v1/user/profile
 * @access  Private
 */
const updateProfile = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    try {
        const userId = (_a = req.user) === null || _a === void 0 ? void 0 : _a.userId;
        if (!userId) {
            res.status(401).json({ message: "Unauthorized" });
            return;
        }
        const { firstName, lastName, phoneNumber } = req.body;
        const user = yield user_model_1.default.findById(userId);
        if (!user) {
            res.status(404).json({ message: "User not found" });
            return;
        }
        if (firstName !== undefined)
            user.firstName = firstName;
        if (lastName !== undefined)
            user.lastName = lastName;
        if (phoneNumber !== undefined)
            user.phoneNumber = phoneNumber;
        yield user.save();
        res.status(200).json({
            message: "Profile updated successfully",
            user: {
                id: user._id,
                firstName: user.firstName,
                lastName: user.lastName,
                email: user.email,
                phoneNumber: user.phoneNumber,
                role: user.role,
                isOnboarded: user.isOnboarded,
                // addresses: user.addresses,
            },
        });
    }
    catch (error) {
        console.error("Error in updateProfile:", error);
        res.status(500).json({ message: "Internal server error" });
    }
});
exports.updateProfile = updateProfile;
/**
 * @desc    Add an address
 * @route   POST /api/v1/user/addresses
 * @access  Private
 */
const addAddress = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    try {
        const userId = (_a = req.user) === null || _a === void 0 ? void 0 : _a.userId;
        if (!userId) {
            res.status(401).json({ message: "Unauthorized" });
            return;
        }
        const { name, location, landmark } = req.body;
        if (!name || !location) {
            res.status(400).json({ message: "Name and location are required" });
            return;
        }
        const user = yield user_model_1.default.findByIdAndUpdate(userId, { $push: { addresses: { name, location, landmark } } }, { new: true, runValidators: true });
        if (!user) {
            res.status(404).json({ message: "User not found" });
            return;
        }
        res.status(201).json({
            message: "Address added successfully",
            user: {
                id: user._id,
                firstName: user.firstName,
                lastName: user.lastName,
                email: user.email,
                phoneNumber: user.phoneNumber,
                role: user.role,
                isOnboarded: user.isOnboarded,
                // addresses: user.addresses,
            },
        });
    }
    catch (error) {
        console.error("Error in addAddress:", error);
        res.status(500).json({ message: "Internal server error" });
    }
});
exports.addAddress = addAddress;
/**
 * @desc    Edit an address
 * @route   PUT /api/v1/user/addresses/:addressId
 * @access  Private
 */
const editAddress = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    try {
        const userId = (_a = req.user) === null || _a === void 0 ? void 0 : _a.userId;
        const { addressId } = req.params;
        if (!userId || !addressId) {
            res.status(400).json({
                message: "Address ID is required",
            });
            return;
        }
        const { name, location, landmark } = req.body;
        const updateFields = {};
        if (name !== undefined)
            updateFields["addresses.$[elem].name"] = name;
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
        const user = yield user_model_1.default.findOneAndUpdate({ _id: userId }, { $set: updateFields }, {
            new: true,
            runValidators: true,
            arrayFilters: [{ "elem._id": addressId }],
        });
        if (!user) {
            res.status(404).json({ message: "User or address not found" });
            return;
        }
        res.status(200).json({
            message: "Address updated successfully",
            user: {
                id: user._id,
                firstName: user.firstName,
                lastName: user.lastName,
                email: user.email,
                phoneNumber: user.phoneNumber,
                role: user.role,
                isOnboarded: user.isOnboarded,
                // addresses: user.addresses,
            },
        });
    }
    catch (error) {
        console.error("Error in editAddress:", error);
        res.status(500).json({ message: "Internal server error" });
    }
});
exports.editAddress = editAddress;
/**
 * @desc    Delete an address
 * @route   DELETE /api/v1/user/addresses/:addressId
 * @access  Private
 */
const deleteAddress = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    try {
        const userId = (_a = req.user) === null || _a === void 0 ? void 0 : _a.userId;
        const { addressId } = req.params;
        if (!userId || !addressId) {
            res.status(400).json({
                message: "Address ID is required",
            });
            return;
        }
        const user = yield user_model_1.default.findOneAndUpdate({ _id: userId }, { $pull: { addresses: { _id: addressId } } }, { new: true });
        if (!user) {
            res.status(404).json({ message: "User not found" });
            return;
        }
        res.status(200).json({
            message: "Address deleted successfully",
            user: {
                id: user._id,
                firstName: user.firstName,
                lastName: user.lastName,
                email: user.email,
                phoneNumber: user.phoneNumber,
                role: user.role,
                isOnboarded: user.isOnboarded,
                // addresses: user.addresses,
            },
        });
    }
    catch (error) {
        console.error("Error in deleteAddress:", error);
        res.status(500).json({ message: "Internal server error" });
    }
});
exports.deleteAddress = deleteAddress;
/**
 * @desc    Update user's push token
 * @route   PATCH /api/v1/user/push-token
 * @access  Private
 */
const updatePushToken = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    try {
        const userId = (_a = req.user) === null || _a === void 0 ? void 0 : _a.userId;
        const { pushToken } = req.body;
        if (!userId) {
            res.status(401).json({ message: "Unauthorized" });
            return;
        }
        if (!pushToken) {
            res.status(400).json({ message: "Push token is required" });
            return;
        }
        const user = yield user_model_1.default.findByIdAndUpdate(userId, { pushToken }, { new: true });
        if (!user) {
            res.status(404).json({ message: "User not found" });
            return;
        }
        res.status(200).json({
            message: "Push token updated successfully",
        });
    }
    catch (error) {
        console.error("Error in updatePushToken:", error);
        res.status(500).json({ message: "Internal server error" });
    }
});
exports.updatePushToken = updatePushToken;
