import { Router } from "express";
import { authenticate, authorizeSelfOrAdmin } from "../middlewares/auth.middleware";
import {
    getVehicleTypes,
    createVehicle,
    getUserVehicles,
    getVehicle,
    getOnboardingStatus,
    uploadVehicleImage,
} from "../controllers/vehicle.controller";
import { updatePersonalDetails, submitForVerification } from "../controllers/rider.controller";
import { upload } from "../middlewares/upload.middleware";

const router = Router();

// Public route to get vehicle types
router.get("/vehicle-types", authenticate, getVehicleTypes);

// Rider routes
router.post("/:userId/vehicles", authenticate, authorizeSelfOrAdmin(), createVehicle);
router.get("/:userId/vehicles", authenticate, authorizeSelfOrAdmin(), getUserVehicles);
router.get(
    "/:userId/vehicles/:vehicleId",
    authenticate,
    authorizeSelfOrAdmin(),
    getVehicle,
);
router.post(
    "/:userId/vehicles/:vehicleId/image",
    authenticate,
    authorizeSelfOrAdmin(),
    upload.single("vehicleImage"),
    uploadVehicleImage,
);

// Personal details
router.patch(
    "/:userId/personal-details",
    authenticate,
    authorizeSelfOrAdmin(),
    updatePersonalDetails,
);

// Submit for verification
router.post(
    "/:userId/submit-verification",
    authenticate,
    authorizeSelfOrAdmin(),
    submitForVerification,
);

// Onboarding status
router.get(
    "/:userId/onboarding-status",
    authenticate,
    authorizeSelfOrAdmin(),
    getOnboardingStatus,
);

export default router;
