import { Response, RequestHandler } from "express";
import Vehicle from "../models/vehicle.model";
import User from "../models/user.model";
import Document from "../models/document.model";
import { AuthRequest } from "../types/user.type";
import { uploadToStorage } from "../middlewares/upload.middleware";
import { CatchAsync } from "../utils/catchasync.util";
import {
    getRiderOnboardingState,
    syncUserOnboardingState,
} from "../services/onboarding.service";

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

const getRequiredFieldsForVehicleType = (vehicleType: string): string[] => {
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

const isVehicleDetailsComplete = (vehicle: any): boolean => {
    const requiredFields = getRequiredFieldsForVehicleType(vehicle.vehicleType);
    return requiredFields.every((field) => Boolean(vehicle[field]));
};

/**
 * @desc    Get available vehicle types
 * @route   GET /api/v1/riders/vehicle-types
 * @access  Private
 */
export const getVehicleTypes: RequestHandler = CatchAsync(
    async (req: AuthRequest, res: Response) => {
        res.status(200).json({
            success: true,
            data: VEHICLE_TYPES,
        });
    },
);

/**
 * @desc    Create a new vehicle for rider
 * @route   POST /api/v1/riders/:userId/vehicles
 * @access  Private
 */
export const createVehicle: RequestHandler = CatchAsync(
    async (req: AuthRequest, res: Response) => {
        const { userId } = req.params;
        const { vehicleType } = req.body;

        // Validate user exists and is a rider
        const user = await User.findById(userId);
        if (!user || user.role !== "rider") {
            res.status(404).json({
                success: false,
                message: "Rider not found",
            });
            return;
        }

        // Validate vehicle type
        if (
            !["BICYCLE", "MOTORCYCLE", "TRICYCLE", "CAR"].includes(vehicleType)
        ) {
            res.status(400).json({
                success: false,
                message: "Invalid vehicle type",
            });
            return;
        }

        // Create vehicle with pending status
        const vehicle = await Vehicle.create({
            userId,
            vehicleType,
            verificationStatus: "pending",
        });

        await syncUserOnboardingState(userId);

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
    },
);

/**
 * @desc    Update vehicle details
 * @route   PUT /api/v1/riders/:userId/vehicles/:vehicleId
 * @access  Private
 */
export const updateVehicleDetails: RequestHandler = CatchAsync(
    async (req: AuthRequest, res: Response) => {
        const { userId, vehicleId } = req.params;
        const {
            brand,
            model,
            year,
            color,
            licensePlate,
            registrationNumber,
            additionalDetails,
        } = req.body;

        const vehicle = await Vehicle.findOne({ _id: vehicleId, userId });

        if (!vehicle) {
            res.status(404).json({
                success: false,
                message: "Vehicle not found",
            });
            return;
        }

        const nextVehicleData = {
            brand: brand ?? vehicle.brand,
            model: model ?? vehicle.model,
            year: year ?? vehicle.year,
            color: color ?? vehicle.color,
            licensePlate: licensePlate ?? vehicle.licensePlate,
        };

        const requiredFields = getRequiredFieldsForVehicleType(vehicle.vehicleType);
        const missingRequiredFields = requiredFields.filter(
            (field) => !nextVehicleData[field as keyof typeof nextVehicleData],
        );

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

        await vehicle.save();

        await syncUserOnboardingState(userId);

        res.status(200).json({
            success: true,
            message: "Vehicle details updated successfully",
            data: {
                vehicleId: vehicle._id,
                nextStep: "vehicle_image",
            },
        });
    },
);

/**
 * @desc    Upload vehicle image
 * @route   POST /api/v1/riders/:userId/vehicles/:vehicleId/image
 * @access  Private
 */
export const uploadVehicleImage: RequestHandler = CatchAsync(
    async (req: AuthRequest, res: Response) => {
        const { userId, vehicleId } = req.params;

        if (!req.file) {
            res.status(400).json({
                success: false,
                message: "No image file provided",
            });
            return;
        }

        // Find vehicle
        const vehicle = await Vehicle.findOne({
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
        const imageUrl = await uploadToStorage(req.file, `vehicles/${userId}`);

        // Update vehicle with image
        vehicle.imageUrl = imageUrl;
        await vehicle.save();
        await syncUserOnboardingState(userId);

        res.status(200).json({
            success: true,
            message: "Vehicle image uploaded successfully",
            data: {
                vehicleId: vehicle._id,
                imageUrl,
                nextStep: "submit_verification",
            },
        });
    },
);

/**
 * @desc    Get user's vehicles
 * @route   GET /api/v1/riders/:userId/vehicles
 * @access  Private
 */
export const getUserVehicles: RequestHandler = CatchAsync(
    async (req: AuthRequest, res: Response) => {
        const { userId } = req.params;

        const vehicles = await Vehicle.find({ userId });

        res.status(200).json({
            success: true,
            data: {
                totalVehicles: vehicles.length,
                vehicles,
            },
        });
    },
);

/**
 * @desc    Get single vehicle
 * @route   GET /api/v1/riders/:userId/vehicles/:vehicleId
 * @access  Private
 */
export const getVehicle: RequestHandler = CatchAsync(
    async (req: AuthRequest, res: Response) => {
        const { userId, vehicleId } = req.params;

        const vehicle = await Vehicle.findOne({
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
    },
);

/**
 * @desc    Get rider onboarding status
 * @route   GET /api/v1/riders/:userId/onboarding-status
 * @access  Private
 */
export const getOnboardingStatus: RequestHandler = CatchAsync(
    async (req: AuthRequest, res: Response) => {
        const { userId } = req.params;

        // Get user
        const user = await syncUserOnboardingState(userId);
        if (!user) {
            res.status(404).json({
                success: false,
                message: "User not found",
            });
            return;
        }

        const accessState = await getRiderOnboardingState(userId);
        const vehicles = await Vehicle.find({ userId });
        const documents = await Document.find({ userId });

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
        if (!user) {
            res.status(404).json({
                success: false,
                message: "User not found",
            });
            return;
        }

        // Check if onboarding-required data is present
        const vehicles = await Vehicle.find({ userId });

        if (vehicles.length === 0) {
            res.status(400).json({
                success: false,
                message: "Please add a vehicle before submitting",
            });
            return;
        }

        const vehicleComplete = vehicles.every(
            (v) => isVehicleDetailsComplete(v) && Boolean(v.imageUrl),
        );

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
        await user.save();

        const syncedUser = await syncUserOnboardingState(userId);
        const accessState = await getRiderOnboardingState(userId);

        res.status(200).json({
            success: true,
            message: "Submitted for verification successfully",
            data: {
                userId,
                riderStatus: user.riderStatus,
                onboardingStage: syncedUser?.onboardingStage,
                verificationStatus: syncedUser?.verificationStatus,
                accessState,
                message:
                    "Your application is under review. You'll be notified once verified.",
            },
        });
    },
);
