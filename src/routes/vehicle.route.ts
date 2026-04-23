import { Router } from "express";
import { upload } from "../middlewares/upload.middleware";
import { authenticate, authorizeSelfOrAdmin } from "../middlewares/auth.middleware";
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
router.post("/:userId/vehicles", authenticate, authorizeSelfOrAdmin(), createVehicle);
router.put(
    "/:userId/vehicles/:vehicleId",
    authenticate,
    authorizeSelfOrAdmin(),
    updateVehicleDetails,
);
router.post(
    "/:userId/vehicles/:vehicleId/image",
    authenticate,
    authorizeSelfOrAdmin(),
    upload.single("vehicleImage"),
    uploadVehicleImage,
);
router.get("/:userId/vehicles", authenticate, authorizeSelfOrAdmin(), getUserVehicles);
router.get(
    "/:userId/vehicles/:vehicleId",
    authenticate,
    authorizeSelfOrAdmin(),
    getVehicle,
);

// Onboarding status
router.get(
    "/:userId/onboarding-status",
    authenticate,
    authorizeSelfOrAdmin(),
    getOnboardingStatus,
);
router.post(
    "/:userId/submit-verification",
    authenticate,
    authorizeSelfOrAdmin(),
    submitForVerification,
);

export default router;
