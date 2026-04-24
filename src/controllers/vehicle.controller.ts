import { Response, RequestHandler } from "express";
import Vehicle from "../models/vehicle.model";
import User from "../models/user.model";
import { AuthRequest } from "../types/user.type";
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

        const accessState = await getRiderOnboardingState(userId);

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
    },
);
