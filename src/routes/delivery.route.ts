import { Router } from "express";
import { authenticate } from "../middlewares/auth.middleware";
import {
    requestDelivery,
    acceptDelivery,
    calculateDeliveryFee,
    cancelDelivery,
    getMyDeliveries,
    getDeliveryById,
    getNearbyRiders,
} from "../controllers/delivery.controller";
import { upload } from "../middlewares/upload.middleware";

const router = Router();

// Protect all delivery routes
router.use(authenticate);
router.get("/nearby-riders", getNearbyRiders);
router.get("/my-deliveries", getMyDeliveries);
router.get("/:id", getDeliveryById);
router.post("/calculate-fee", calculateDeliveryFee);
router.post("/request", upload.single("itemImage"), requestDelivery);
router.post("/:id/accept", acceptDelivery);
router.post("/:id/cancel", cancelDelivery);

export default router;
