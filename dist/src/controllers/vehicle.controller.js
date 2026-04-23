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
exports.submitForVerification = exports.getOnboardingStatus = exports.getVehicle = exports.getUserVehicles = exports.uploadVehicleImage = exports.updateVehicleDetails = exports.createVehicle = exports.getVehicleTypes = void 0;
const vehicle_model_1 = __importDefault(require("../models/vehicle.model"));
const user_model_1 = __importDefault(require("../models/user.model"));
const document_model_1 = __importDefault(require("../models/document.model"));
const upload_middleware_1 = require("../middlewares/upload.middleware");
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
const getRequiredFieldsForVehicleType = (vehicleType) => {
    switch (vehicleType) {
        case "BICYCLE":
            return ["color"];
        case "MOTORCYCLE":
            return ["color", "licensePlate"];
        case "TRICYCLE":
            return ["color", "licensePlate"];
        case "CAR":
            return ["brand", "model", "year", "color", "licensePlate"];
        default:
            return ["color"];
    }
};
const isVehicleDetailsComplete = (vehicle) => {
    const requiredFields = getRequiredFieldsForVehicleType(vehicle.vehicleType);
    return requiredFields.every((field) => Boolean(vehicle[field]));
};
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
    // Determine required fields based on vehicle type
    const requiredFields = getRequiredFieldsForVehicleType(vehicleType);
    res.status(201).json({
        success: true,
        message: "Vehicle created successfully",
        data: {
            vehicleId: vehicle._id,
            vehicleType: vehicle.vehicleType,
            nextStep: "vehicle_details",
            requiredFields,
        },
    });
}));
/**
 * @desc    Update vehicle details
 * @route   PUT /api/v1/riders/:userId/vehicles/:vehicleId
 * @access  Private
 */
exports.updateVehicleDetails = (0, catchasync_util_1.CatchAsync)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { userId, vehicleId } = req.params;
    const { brand, model, year, color, licensePlate, registrationNumber, additionalDetails, } = req.body;
    const vehicle = yield vehicle_model_1.default.findOne({ _id: vehicleId, userId });
    if (!vehicle) {
        res.status(404).json({
            success: false,
            message: "Vehicle not found",
        });
        return;
    }
    const nextVehicleData = {
        brand: brand !== null && brand !== void 0 ? brand : vehicle.brand,
        model: model !== null && model !== void 0 ? model : vehicle.model,
        year: year !== null && year !== void 0 ? year : vehicle.year,
        color: color !== null && color !== void 0 ? color : vehicle.color,
        licensePlate: licensePlate !== null && licensePlate !== void 0 ? licensePlate : vehicle.licensePlate,
    };
    const requiredFields = getRequiredFieldsForVehicleType(vehicle.vehicleType);
    const missingRequiredFields = requiredFields.filter((field) => !nextVehicleData[field]);
    if (missingRequiredFields.length > 0) {
        res.status(400).json({
            success: false,
            message: `Missing required fields for ${vehicle.vehicleType.toLowerCase()}: ${missingRequiredFields.join(", ")}`,
        });
        return;
    }
    vehicle.brand = nextVehicleData.brand;
    vehicle.model = nextVehicleData.model;
    vehicle.year = nextVehicleData.year;
    vehicle.color = nextVehicleData.color;
    vehicle.licensePlate = nextVehicleData.licensePlate;
    if (registrationNumber !== undefined)
        vehicle.registrationNumber = registrationNumber;
    if (additionalDetails !== undefined)
        vehicle.additionalDetails = additionalDetails || {};
    yield vehicle.save();
    yield (0, onboarding_service_1.syncUserOnboardingState)(userId);
    res.status(200).json({
        success: true,
        message: "Vehicle details updated successfully",
        data: {
            vehicleId: vehicle._id,
            nextStep: "vehicle_image",
        },
    });
}));
/**
 * @desc    Upload vehicle image
 * @route   POST /api/v1/riders/:userId/vehicles/:vehicleId/image
 * @access  Private
 */
exports.uploadVehicleImage = (0, catchasync_util_1.CatchAsync)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { userId, vehicleId } = req.params;
    if (!req.file) {
        res.status(400).json({
            success: false,
            message: "No image file provided",
        });
        return;
    }
    // Find vehicle
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
    // Upload to S3
    const imageUrl = yield (0, upload_middleware_1.uploadToStorage)(req.file, `vehicles/${userId}`);
    // Update vehicle with image
    vehicle.imageUrl = imageUrl;
    yield vehicle.save();
    yield (0, onboarding_service_1.syncUserOnboardingState)(userId);
    res.status(200).json({
        success: true,
        message: "Vehicle image uploaded successfully",
        data: {
            vehicleId: vehicle._id,
            imageUrl,
            nextStep: "submit_verification",
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
    const documents = yield document_model_1.default.find({ userId });
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
            vehicleDetails: {
                totalVehicles: vehicles.length,
                vehicles: vehicles.map((v) => ({
                    id: v._id,
                    type: v.vehicleType,
                    brand: v.brand,
                    model: v.model,
                    imageUrl: v.imageUrl,
                })),
            },
            documentDetails: {
                totalDocuments: documents.length,
                uploadedDocuments: documents.map((d) => ({
                    id: d._id,
                    type: d.documentType,
                    status: d.verificationStatus,
                })),
            },
        },
    });
}));
/**
 * @desc    Submit rider for verification
 * @route   POST /api/v1/riders/:userId/submit-verification
 * @access  Private
 */
exports.submitForVerification = (0, catchasync_util_1.CatchAsync)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { userId } = req.params;
    const user = yield user_model_1.default.findById(userId);
    if (!user) {
        res.status(404).json({
            success: false,
            message: "User not found",
        });
        return;
    }
    // Check if onboarding-required data is present
    const vehicles = yield vehicle_model_1.default.find({ userId });
    if (vehicles.length === 0) {
        res.status(400).json({
            success: false,
            message: "Please add a vehicle before submitting",
        });
        return;
    }
    const vehicleComplete = vehicles.every((v) => isVehicleDetailsComplete(v) && Boolean(v.imageUrl));
    if (!vehicleComplete) {
        res.status(400).json({
            success: false,
            message: "Please complete all vehicle details",
        });
        return;
    }
    // Update user status to pending verification
    user.riderStatus = "pending_verification";
    user.verificationStatus = "pending";
    user.onboardingStage = "pending_admin_approval";
    yield user.save();
    const syncedUser = yield (0, onboarding_service_1.syncUserOnboardingState)(userId);
    const accessState = yield (0, onboarding_service_1.getRiderOnboardingState)(userId);
    res.status(200).json({
        success: true,
        message: "Submitted for verification successfully",
        data: {
            userId,
            riderStatus: user.riderStatus,
            onboardingStage: syncedUser === null || syncedUser === void 0 ? void 0 : syncedUser.onboardingStage,
            verificationStatus: syncedUser === null || syncedUser === void 0 ? void 0 : syncedUser.verificationStatus,
            accessState,
            message: "Your application is under review. You'll be notified once verified.",
        },
    });
}));
