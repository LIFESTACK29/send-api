import { Router } from "express";
import {
    authenticate,
    requireActiveRiderAccess,
} from "../middlewares/auth.middleware";
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
    declineMatchRequest,
    getRiderHomeSummary,
    completeDelivery,
} from "../controllers/delivery.controller";
import { upload, validateFileType } from "../middlewares/upload.middleware";

const router = Router();

// Protect all delivery routes
router.use(authenticate);
router.use(requireActiveRiderAccess);
router.get("/rider/home", getRiderHomeSummary);
router.get("/nearby-riders", getNearbyRiders);
router.get("/my-deliveries", getMyDeliveries);
router.post("/calculate-fee", calculateDeliveryFee);
router.post("/request", upload.single("itemImage"), validateFileType, requestDelivery);
router.post("/match-requests/:id/decline", declineMatchRequest);
router.post("/match-requests/:id/wait-more", waitMoreForRider);
router.post("/match-requests/:id/create-manual", createDeliveryManually);
router.post("/:id/assign-rider", assignRiderToDeliveryByAdmin);
router.post("/:id/accept", acceptDelivery);
router.post("/:id/complete", completeDelivery);
router.post("/:id/cancel", cancelDelivery);
router.get("/:id", getDeliveryById);

export default router;
