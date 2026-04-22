import { Router } from "express";
import {
    register,
    verifyOtp,
    resendOtp,
    login,
    getMe,
    uploadProfileImage,
} from "../controllers/auth.controller";
import { authenticate } from "../middlewares/auth.middleware";
import { upload } from "../middlewares/upload.middleware";

const router = Router();

router.post("/register", register);
router.post("/verify-otp", verifyOtp);
router.post("/resend-otp", resendOtp);
router.post("/login", login);
router.get("/me", authenticate, getMe);
router.post(
    "/upload-profile-image",
    authenticate,
    upload.single("profileImage"),
    uploadProfileImage,
);

export default router;
