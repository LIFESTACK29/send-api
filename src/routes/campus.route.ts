import { Router } from "express";
import { authenticate } from "../middlewares/auth.middleware";
import { getCampusLocations } from "../controllers/campus.controller";

const router = Router();

router.use(authenticate);

router.get("/locations", getCampusLocations);

export default router;
