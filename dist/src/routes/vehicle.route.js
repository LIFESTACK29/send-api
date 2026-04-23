"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const upload_middleware_1 = require("../middlewares/upload.middleware");
const auth_middleware_1 = require("../middlewares/auth.middleware");
const vehicle_controller_1 = require("../controllers/vehicle.controller");
const router = (0, express_1.Router)();
// Public route to get vehicle types
router.get("/vehicle-types", auth_middleware_1.authenticate, vehicle_controller_1.getVehicleTypes);
// Rider routes
router.post("/:userId/vehicles", auth_middleware_1.authenticate, (0, auth_middleware_1.authorizeSelfOrAdmin)(), vehicle_controller_1.createVehicle);
router.put("/:userId/vehicles/:vehicleId", auth_middleware_1.authenticate, (0, auth_middleware_1.authorizeSelfOrAdmin)(), vehicle_controller_1.updateVehicleDetails);
router.post("/:userId/vehicles/:vehicleId/image", auth_middleware_1.authenticate, (0, auth_middleware_1.authorizeSelfOrAdmin)(), upload_middleware_1.upload.single("vehicleImage"), vehicle_controller_1.uploadVehicleImage);
router.get("/:userId/vehicles", auth_middleware_1.authenticate, (0, auth_middleware_1.authorizeSelfOrAdmin)(), vehicle_controller_1.getUserVehicles);
router.get("/:userId/vehicles/:vehicleId", auth_middleware_1.authenticate, (0, auth_middleware_1.authorizeSelfOrAdmin)(), vehicle_controller_1.getVehicle);
// Onboarding status
router.get("/:userId/onboarding-status", auth_middleware_1.authenticate, (0, auth_middleware_1.authorizeSelfOrAdmin)(), vehicle_controller_1.getOnboardingStatus);
router.post("/:userId/submit-verification", auth_middleware_1.authenticate, (0, auth_middleware_1.authorizeSelfOrAdmin)(), vehicle_controller_1.submitForVerification);
exports.default = router;
