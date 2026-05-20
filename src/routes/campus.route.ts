import { Router } from "express";
import { authenticate } from "../middlewares/auth.middleware";
import { getCampuses, getCampusLocations } from "../controllers/campus.controller";

const router = Router();

router.use(authenticate);

router.get("/", getCampuses);
router.get("/locations", getCampusLocations);

export default router;
