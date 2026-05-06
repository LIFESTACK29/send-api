import { Router } from "express";
import rateLimit from "express-rate-limit";
import {
    register,
    verifyOtp,
    resendOtp,
    login,
    adminLogin,
    getMe,
    uploadProfileImage,
    logout,
} from "../controllers/auth.controller";
import { authenticate } from "../middlewares/auth.middleware";
import { upload, validateFileType } from "../middlewares/upload.middleware";

const router = Router();

// ─── Rate limiters ────────────────────────────────────────────────────────────

const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 10,
    standardHeaders: true,
    legacyHeaders: false,
    message: { message: "Too many login attempts. Please try again in 15 minutes." },
});

const otpVerifyLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 5,
    standardHeaders: true,
    legacyHeaders: false,
    message: { message: "Too many OTP attempts. Please try again in 15 minutes." },
});

const otpResendLimiter = rateLimit({
    windowMs: 60 * 1000, // 1 minute
    max: 3,
    standardHeaders: true,
    legacyHeaders: false,
    message: { message: "Too many resend requests. Please wait before trying again." },
});

// ─── Routes ───────────────────────────────────────────────────────────────────

router.post("/register", register);
router.post("/verify-otp", otpVerifyLimiter, verifyOtp);
router.post("/resend-otp", otpResendLimiter, resendOtp);
router.post("/login", loginLimiter, login);
router.post("/admin/login", loginLimiter, adminLogin);

router.get("/me", authenticate, getMe);
router.post("/logout", authenticate, logout);

router.post(
    "/upload-profile-image",
    authenticate,
    upload.single("profileImage"),
    validateFileType,
    uploadProfileImage,
);

export default router;
