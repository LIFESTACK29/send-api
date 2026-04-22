import { Router } from "express";
import { upload } from "../middlewares/upload.middleware";
import { authenticate } from "../middlewares/auth.middleware";
import {
    getVehicleTypes,
    createVehicle,
    updateVehicleDetails,
    uploadVehicleImage,
    getUserVehicles,
    getVehicle,
    getOnboardingStatus,
    submitForVerification,
} from "../controllers/vehicle.controller";

const router = Router();

// Public route to get vehicle types
router.get("/vehicle-types", authenticate, getVehicleTypes);

// Rider routes
router.post("/:userId/vehicles", authenticate, createVehicle);
router.put("/:userId/vehicles/:vehicleId", authenticate, updateVehicleDetails);
router.post(
    "/:userId/vehicles/:vehicleId/image",
    authenticate,
    upload.single("vehicleImage"),
    uploadVehicleImage,
);
router.get("/:userId/vehicles", authenticate, getUserVehicles);
router.get("/:userId/vehicles/:vehicleId", authenticate, getVehicle);

// Onboarding status
router.get("/:userId/onboarding-status", authenticate, getOnboardingStatus);
router.post(
    "/:userId/submit-verification",
    authenticate,
    submitForVerification,
);

export default router;
