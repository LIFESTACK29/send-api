"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_middleware_1 = require("../middlewares/auth.middleware");
const delivery_controller_1 = require("../controllers/delivery.controller");
const upload_middleware_1 = require("../middlewares/upload.middleware");
const router = (0, express_1.Router)();
// Protect all delivery routes
router.use(auth_middleware_1.authenticate);
router.get("/nearby-riders", delivery_controller_1.getNearbyRiders);
router.get("/my-deliveries", delivery_controller_1.getMyDeliveries);
router.get("/:id", delivery_controller_1.getDeliveryById);
router.post("/calculate-fee", delivery_controller_1.calculateDeliveryFee);
router.post("/request", upload_middleware_1.upload.single("itemImage"), delivery_controller_1.requestDelivery);
router.post("/:id/accept", delivery_controller_1.acceptDelivery);
router.post("/:id/cancel", delivery_controller_1.cancelDelivery);
exports.default = router;
