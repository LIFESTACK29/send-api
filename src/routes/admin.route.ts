import { Router } from "express";
import { authenticate, authorize } from "../middlewares/auth.middleware";
import {
    getAllRidersForAdmin,
    getRiderVerificationDetail,
    verifyRider,
} from "../controllers/document.controller";

const router = Router();

router.use(authenticate, authorize("admin"));

router.get("/riders", getAllRidersForAdmin);
router.get("/riders/:userId", getRiderVerificationDetail);
router.put("/riders/:userId/verify", verifyRider);

export default router;
