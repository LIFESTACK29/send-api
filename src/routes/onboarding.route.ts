import { Router } from "express";
import { authenticate } from "../middlewares/auth.middleware";
import { getOnboardingState } from "../controllers/onboarding.controller";

const router = Router();

router.get("/state", authenticate, getOnboardingState);

export default router;

