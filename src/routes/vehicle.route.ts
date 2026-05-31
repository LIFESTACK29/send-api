import { Router } from "express";
import { authenticate, authorizeSelfOrAdmin } from "../middlewares/auth.middleware";
import {
    getVehicleTypes,
    createVehicle,
    getUserVehicles,
    getVehicle,
    getOnboardingStatus,
} from "../controllers/vehicle.controller";
import { updatePersonalDetails } from "../controllers/rider.controller";

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

// Personal details
router.patch(
    "/:userId/personal-details",
    authenticate,
    authorizeSelfOrAdmin(),
    updatePersonalDetails,
);

// Onboarding status
router.get(
    "/:userId/onboarding-status",
    authenticate,
    authorizeSelfOrAdmin(),
    getOnboardingStatus,
);

export default router;
