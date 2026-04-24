"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_middleware_1 = require("../middlewares/auth.middleware");
const vehicle_controller_1 = require("../controllers/vehicle.controller");
const router = (0, express_1.Router)();
// Public route to get vehicle types
router.get("/vehicle-types", auth_middleware_1.authenticate, vehicle_controller_1.getVehicleTypes);
// Rider routes
router.post("/:userId/vehicles", auth_middleware_1.authenticate, (0, auth_middleware_1.authorizeSelfOrAdmin)(), vehicle_controller_1.createVehicle);
router.get("/:userId/vehicles", auth_middleware_1.authenticate, (0, auth_middleware_1.authorizeSelfOrAdmin)(), vehicle_controller_1.getUserVehicles);
router.get("/:userId/vehicles/:vehicleId", auth_middleware_1.authenticate, (0, auth_middleware_1.authorizeSelfOrAdmin)(), vehicle_controller_1.getVehicle);
// Onboarding status
router.get("/:userId/onboarding-status", auth_middleware_1.authenticate, (0, auth_middleware_1.authorizeSelfOrAdmin)(), vehicle_controller_1.getOnboardingStatus);
exports.default = router;
