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
    // Determine required fields based on vehicle type
    const requiredFields = [
        "brand",
        "model",
        "year",
        "color",
        "licensePlate",
    ];
    if (vehicleType !== "BICYCLE") {
        requiredFields.push("registrationNumber");
    }
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
    const { brand, model, year, color, licensePlate, registrationNumber, additionalDetails } = req.body;
    // Validate required fields
    if (!brand || !model || !year || !color || !licensePlate) {
        res.status(400).json({
            success: false,
            message: "Missing required fields",
        });
        return;
    }
    // Find and update vehicle
    const vehicle = yield vehicle_model_1.default.findOneAndUpdate({ _id: vehicleId, userId }, {
        brand,
        model,
        year,
        color,
        licensePlate,
        registrationNumber,
        additionalDetails: additionalDetails || {},
    }, { new: true });
    if (!vehicle) {
        res.status(404).json({
            success: false,
            message: "Vehicle not found",
        });
        return;
    }
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
    res.status(200).json({
        success: true,
        message: "Vehicle image uploaded successfully",
        data: {
            vehicleId: vehicle._id,
            imageUrl,
            nextStep: "documents",
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
    const user = yield user_model_1.default.findById(userId);
    if (!user) {
        res.status(404).json({
            success: false,
            message: "User not found",
        });
        return;
    }
    // Check vehicles
    const vehicles = yield vehicle_model_1.default.find({ userId });
    const vehicleComplete = vehicles.length > 0 &&
        vehicles.every((v) => Boolean(v.brand &&
            v.get("model") &&
            v.year &&
            v.color &&
            v.imageUrl));
    // Check documents
    const documents = yield document_model_1.default.find({ userId });
    const requiredDocuments = [
        "DRIVING_LICENSE",
        "GOVERNMENT_ID",
        "INSURANCE",
        "REGISTRATION",
    ];
    const allDocumentsUploaded = requiredDocuments.every((docType) => documents.some((d) => d.documentType === docType));
    const progress = {
        emailVerified: user.isOnboarded,
        profileCompleted: !!user.profileImageUrl,
        vehicleSelected: vehicles.length > 0,
        vehicleDetailsCompleted: vehicleComplete,
        documentsUploaded: allDocumentsUploaded,
        submittedForVerification: user.riderStatus === "pending_verification" ||
            user.riderStatus === "active",
    };
    const completionPercentage = Object.values(progress).filter(Boolean).length;
    res.status(200).json({
        success: true,
        data: {
            userId,
            onboardingProgress: progress,
            riderStatus: user.riderStatus,
            completionPercentage: (completionPercentage / 6) * 100,
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
    // Check if all required data is present
    const vehicles = yield vehicle_model_1.default.find({ userId });
    const documents = yield document_model_1.default.find({ userId });
    if (vehicles.length === 0) {
        res.status(400).json({
            success: false,
            message: "Please add a vehicle before submitting",
        });
        return;
    }
    const vehicleComplete = vehicles.every((v) => Boolean(v.brand && v.get("model") && v.year && v.color && v.imageUrl));
    if (!vehicleComplete) {
        res.status(400).json({
            success: false,
            message: "Please complete all vehicle details",
        });
        return;
    }
    if (documents.length === 0) {
        res.status(400).json({
            success: false,
            message: "Please upload all required documents",
        });
        return;
    }
    // Update user status to pending verification
    user.riderStatus = "pending_verification";
    yield user.save();
    res.status(200).json({
        success: true,
        message: "Submitted for verification successfully",
        data: {
            userId,
            riderStatus: user.riderStatus,
            message: "Your application is under review. You'll be notified once verified.",
        },
    });
}));
