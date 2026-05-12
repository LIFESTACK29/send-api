import { Router } from "express";
import { authenticate } from "../middlewares/auth.middleware";
import {
    getRideQuote,
    requestRide,
    getRideById,
    getMyRides,
    getMyActiveRide,
    cancelRide,
    passengerUpdateStatus,
} from "../controllers/rides.controller";

const router = Router();

router.use(authenticate);

router.post("/quote", getRideQuote);
router.get("/my-rides", getMyRides);
router.get("/my-active-ride", getMyActiveRide);
router.post("/", requestRide);
router.get("/:id", getRideById);
router.post("/:id/cancel", cancelRide);
router.post("/:id/status", passengerUpdateStatus);

export default router;
