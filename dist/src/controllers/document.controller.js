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
exports.verifyRider = exports.getRiderVerificationDetail = exports.getAllRidersForAdmin = void 0;
const user_model_1 = __importDefault(require("../models/user.model"));
const catchasync_util_1 = require("../utils/catchasync.util");
const onboarding_service_1 = require("../services/onboarding.service");
/**
 * @desc    Get all riders pending KYC verification for admin
 * @route   GET /api/v1/admin/riders
 * @access  Private (Admin only)
 */
exports.getAllRidersForAdmin = (0, catchasync_util_1.CatchAsync)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { status } = req.query;
    const query = {
        role: "rider",
        riderDetails: { $exists: true },
    };
    if (status === "pending") {
        query.isOnboarded = false;
    }
    else if (status === "approved") {
        query.isOnboarded = true;
    }
    const riders = yield user_model_1.default.find(query)
        .select("firstName lastName email phoneNumber isOnboarded riderDetails createdAt updatedAt")
        .limit(100)
        .sort({ createdAt: -1 });
    const ridersWithDetails = riders.map((rider) => {
        var _a, _b, _c;
        return ({
            id: rider._id,
            firstName: rider.firstName,
            lastName: rider.lastName,
            email: rider.email,
            phoneNumber: rider.phoneNumber,
            isOnboarded: rider.isOnboarded,
            riderDetails: {
                nin: (_a = rider.riderDetails) === null || _a === void 0 ? void 0 : _a.nin,
                vehicleType: (_b = rider.riderDetails) === null || _b === void 0 ? void 0 : _b.vehicleType,
                submittedAt: (_c = rider.riderDetails) === null || _c === void 0 ? void 0 : _c.submittedAt,
            },
            createdAt: rider.createdAt,
            updatedAt: rider.updatedAt,
        });
    });
    res.status(200).json({
        success: true,
        data: ridersWithDetails,
    });
}));
/**
 * @desc    Get rider KYC details for admin review
 * @route   GET /api/v1/admin/riders/:userId
 * @access  Private (Admin only)
 */
exports.getRiderVerificationDetail = (0, catchasync_util_1.CatchAsync)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { userId } = req.params;
    const rider = yield user_model_1.default.findById(userId);
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
}));
/**
 * @desc    Admin approve/reject rider KYC
 * @route   PUT /api/v1/admin/riders/:userId/verify
 * @access  Private (Admin only)
 */
exports.verifyRider = (0, catchasync_util_1.CatchAsync)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { userId } = req.params;
    const { approved, notes } = req.body;
    if (typeof approved !== "boolean") {
        res.status(400).json({
            success: false,
            message: "Approved status is required",
        });
        return;
    }
    const rider = yield user_model_1.default.findById(userId);
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
    }
    else {
        rider.isOnboarded = false;
    }
    yield rider.save();
    const accessState = yield (0, onboarding_service_1.getUserAccessState)(rider);
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
}));
