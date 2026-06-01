"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_middleware_1 = require("../middlewares/auth.middleware");
const vehicle_controller_1 = require("../controllers/vehicle.controller");
const rider_controller_1 = require("../controllers/rider.controller");
const upload_middleware_1 = require("../middlewares/upload.middleware");
const router = (0, express_1.Router)();
// Public route to get vehicle types
router.get("/vehicle-types", auth_middleware_1.authenticate, vehicle_controller_1.getVehicleTypes);
// KYC Submission
router.post("/:userId/kyc-details", auth_middleware_1.authenticate, (0, auth_middleware_1.authorizeSelfOrAdmin)(), rider_controller_1.submitRiderKyc);
// Rider vehicle management
router.post("/:userId/vehicles", auth_middleware_1.authenticate, (0, auth_middleware_1.authorizeSelfOrAdmin)(), vehicle_controller_1.createVehicle);
router.get("/:userId/vehicles", auth_middleware_1.authenticate, (0, auth_middleware_1.authorizeSelfOrAdmin)(), vehicle_controller_1.getUserVehicles);
router.get("/:userId/vehicles/:vehicleId", auth_middleware_1.authenticate, (0, auth_middleware_1.authorizeSelfOrAdmin)(), vehicle_controller_1.getVehicle);
router.post("/:userId/vehicles/:vehicleId/image", auth_middleware_1.authenticate, (0, auth_middleware_1.authorizeSelfOrAdmin)(), upload_middleware_1.upload.single("vehicleImage"), vehicle_controller_1.uploadVehicleImage);
// Onboarding status
router.get("/:userId/onboarding-status", auth_middleware_1.authenticate, (0, auth_middleware_1.authorizeSelfOrAdmin)(), vehicle_controller_1.getOnboardingStatus);
exports.default = router;
