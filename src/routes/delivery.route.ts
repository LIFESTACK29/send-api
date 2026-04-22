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
    waitMoreForRider,
    createDeliveryManually,
    assignRiderToDeliveryByAdmin,
} from "../controllers/delivery.controller";
import { upload } from "../middlewares/upload.middleware";

const router = Router();

// Protect all delivery routes
router.use(authenticate);
router.get("/nearby-riders", getNearbyRiders);
router.get("/my-deliveries", getMyDeliveries);
router.post("/calculate-fee", calculateDeliveryFee);
router.post("/request", upload.single("itemImage"), requestDelivery);
router.post("/match-requests/:id/wait-more", waitMoreForRider);
router.post("/match-requests/:id/create-manual", createDeliveryManually);
router.post("/:id/assign-rider", assignRiderToDeliveryByAdmin);
router.post("/:id/accept", acceptDelivery);
router.post("/:id/cancel", cancelDelivery);
router.get("/:id", getDeliveryById);

export default router;
