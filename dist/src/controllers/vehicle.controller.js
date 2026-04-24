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
exports.getOnboardingStatus = exports.getVehicle = exports.getUserVehicles = exports.createVehicle = exports.getVehicleTypes = void 0;
const vehicle_model_1 = __importDefault(require("../models/vehicle.model"));
const user_model_1 = __importDefault(require("../models/user.model"));
const catchasync_util_1 = require("../utils/catchasync.util");
const onboarding_service_1 = require("../services/onboarding.service");
const VEHICLE_TYPES = [
    {
        type: "BICYCLE",
        label: "Bicycle",
        icon: "bicycle",
        description: "Two-wheeled pedal vehicle",
    },
    {
        type: "MOTORCYCLE",
        label: "Motorcycle",
        icon: "motorcycle",
        description: "Two-wheeled motorized vehicle",
    },
    {
        type: "TRICYCLE",
        label: "Tricycle",
        icon: "tricycle",
        description: "Three-wheeled vehicle (Tuk-tuk)",
    },
    {
        type: "CAR",
        label: "Car",
        icon: "car",
        description: "Four-wheeled sedan/sedan vehicle",
    },
];
/**
 * @desc    Get available vehicle types
 * @route   GET /api/v1/riders/vehicle-types
 * @access  Private
 */
exports.getVehicleTypes = (0, catchasync_util_1.CatchAsync)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    res.status(200).json({
        success: true,
        data: VEHICLE_TYPES,
    });
}));
/**
 * @desc    Create a new vehicle for rider
 * @route   POST /api/v1/riders/:userId/vehicles
 * @access  Private
 */
exports.createVehicle = (0, catchasync_util_1.CatchAsync)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { userId } = req.params;
    const { vehicleType } = req.body;
    // Validate user exists and is a rider
    const user = yield user_model_1.default.findById(userId);
    if (!user || user.role !== "rider") {
        res.status(404).json({
            success: false,
            message: "Rider not found",
        });
        return;
    }
    // Validate vehicle type
    if (!["BICYCLE", "MOTORCYCLE", "TRICYCLE", "CAR"].includes(vehicleType)) {
        res.status(400).json({
            success: false,
            message: "Invalid vehicle type",
        });
        return;
    }
    // Create vehicle with pending status
    const vehicle = yield vehicle_model_1.default.create({
        userId,
        vehicleType,
        verificationStatus: "pending",
    });
    yield (0, onboarding_service_1.syncUserOnboardingState)(userId);
    const accessState = yield (0, onboarding_service_1.getRiderOnboardingState)(userId);
    res.status(201).json({
        success: true,
        message: "Vehicle created successfully",
        data: {
            vehicleId: vehicle._id,
            vehicleType: vehicle.vehicleType,
            nextStep: accessState.nextStep,
            accessState,
        },
    });
}));
/**
 * @desc    Get user's vehicles
 * @route   GET /api/v1/riders/:userId/vehicles
 * @access  Private
 */
exports.getUserVehicles = (0, catchasync_util_1.CatchAsync)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { userId } = req.params;
    const vehicles = yield vehicle_model_1.default.find({ userId });
    res.status(200).json({
        success: true,
        data: {
            totalVehicles: vehicles.length,
            vehicles,
        },
    });
}));
/**
 * @desc    Get single vehicle
 * @route   GET /api/v1/riders/:userId/vehicles/:vehicleId
 * @access  Private
 */
exports.getVehicle = (0, catchasync_util_1.CatchAsync)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { userId, vehicleId } = req.params;
    const vehicle = yield vehicle_model_1.default.findOne({
        _id: vehicleId,
        userId,
    });
    if (!vehicle) {
        res.status(404).json({
            success: false,
            message: "Vehicle not found",
        });
        return;
    }
    res.status(200).json({
        success: true,
        data: vehicle,
    });
}));
/**
 * @desc    Get rider onboarding status
 * @route   GET /api/v1/riders/:userId/onboarding-status
 * @access  Private
 */
exports.getOnboardingStatus = (0, catchasync_util_1.CatchAsync)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { userId } = req.params;
    // Get user
    const user = yield (0, onboarding_service_1.syncUserOnboardingState)(userId);
    if (!user) {
        res.status(404).json({
            success: false,
            message: "User not found",
        });
        return;
    }
    const accessState = yield (0, onboarding_service_1.getRiderOnboardingState)(userId);
    const vehicles = yield vehicle_model_1.default.find({ userId });
    res.status(200).json({
        success: true,
        data: {
            userId,
            riderStatus: user.riderStatus,
            onboardingStage: accessState.onboardingStage,
            verificationStatus: accessState.verificationStatus,
            accessState,
            onboardingProgress: accessState.onboardingProgress,
            completionPercentage: accessState.completionPercentage,
            vehicleSelection: {
                totalVehicles: vehicles.length,
                vehicles: vehicles.map((v) => ({
                    id: v._id,
                    type: v.vehicleType,
                })),
            },
        },
    });
}));
