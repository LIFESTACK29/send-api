import { Router } from "express";
import { authenticate, authorize } from "../middlewares/auth.middleware";
import {
    getAllRidersForAdmin,
    getRiderVerificationDetail,
    verifyRider,
} from "../controllers/document.controller";

const router = Router();

router.get("/riders", authenticate, authorize("admin"), getAllRidersForAdmin);
router.get("/riders/:userId", authenticate, authorize("admin"), getRiderVerificationDetail);
router.put("/riders/:userId/verify", authenticate, authorize("admin"), verifyRider);

export default router;
