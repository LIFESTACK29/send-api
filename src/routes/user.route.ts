import { Router } from "express";
import {
    getProfile,
    updateProfile,
    addAddress,
    editAddress,
    deleteAddress,
} from "../controllers/user.controller";
import { authenticate } from "../middlewares/auth.middleware";

const router = Router();

router.get("/", (req, res) => {
    res.json({
        message: "Welcome to RahaSend API - User",
    });
});

// All user routes are protected
router.get("/profile", authenticate, getProfile);
router.patch("/profile", authenticate, updateProfile);

router.post("/addresses", authenticate, addAddress);
router.put("/addresses/:addressId", authenticate, editAddress);
router.delete("/addresses/:addressId", authenticate, deleteAddress);

export default router;
