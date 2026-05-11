import { Router } from "express";
import { authenticate } from "../middlewares/auth.middleware";
import {
    getRideQuote,
    requestRide,
    getRideById,
    getMyRides,
    cancelRide,
} from "../controllers/rides.controller";

const router = Router();

router.use(authenticate);

router.post("/quote", getRideQuote);
router.get("/my-rides", getMyRides);
router.post("/", requestRide);
router.get("/:id", getRideById);
router.post("/:id/cancel", cancelRide);

export default router;
