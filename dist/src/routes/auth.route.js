"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const express_rate_limit_1 = __importDefault(require("express-rate-limit"));
const auth_controller_1 = require("../controllers/auth.controller");
const auth_middleware_1 = require("../middlewares/auth.middleware");
const upload_middleware_1 = require("../middlewares/upload.middleware");
const router = (0, express_1.Router)();
// ─── Rate limiters ────────────────────────────────────────────────────────────
const loginLimiter = (0, express_rate_limit_1.default)({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 10,
    standardHeaders: true,
    legacyHeaders: false,
    message: { message: "Too many login attempts. Please try again in 15 minutes." },
});
const otpVerifyLimiter = (0, express_rate_limit_1.default)({
    windowMs: 15 * 60 * 1000,
    max: 5,
    standardHeaders: true,
    legacyHeaders: false,
    message: { message: "Too many OTP attempts. Please try again in 15 minutes." },
});
const otpResendLimiter = (0, express_rate_limit_1.default)({
    windowMs: 60 * 1000, // 1 minute
    max: 3,
    standardHeaders: true,
    legacyHeaders: false,
    message: { message: "Too many resend requests. Please wait before trying again." },
});
// ─── Routes ───────────────────────────────────────────────────────────────────
router.post("/register", auth_controller_1.register);
router.post("/verify-otp", otpVerifyLimiter, auth_controller_1.verifyOtp);
router.post("/resend-otp", otpResendLimiter, auth_controller_1.resendOtp);
router.post("/login", loginLimiter, auth_controller_1.login);
router.post("/admin/login", loginLimiter, auth_controller_1.adminLogin);
router.get("/me", auth_middleware_1.authenticate, auth_controller_1.getMe);
router.post("/logout", auth_middleware_1.authenticate, auth_controller_1.logout);
router.post("/upload-profile-image", auth_middleware_1.authenticate, upload_middleware_1.upload.single("profileImage"), upload_middleware_1.validateFileType, auth_controller_1.uploadProfileImage);
exports.default = router;
