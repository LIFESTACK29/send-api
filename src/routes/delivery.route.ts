import { Router } from "express";
import { requireAuth } from "../middlewares/auth.middleware";
import {
    requestDelivery,
    acceptDelivery,
} from "../controllers/delivery.controller";

const router = Router();

// Protect all delivery routes
router.use(requireAuth());

router.post("/request", requestDelivery);
router.post("/:id/accept", acceptDelivery);

export default router;
