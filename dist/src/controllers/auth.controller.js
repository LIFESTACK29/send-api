"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.uploadProfileImage = exports.getMe = exports.logout = exports.adminLogin = exports.login = exports.resendOtp = exports.verifyOtp = exports.register = void 0;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const crypto_1 = __importDefault(require("crypto"));
const user_model_1 = __importDefault(require("../models/user.model"));
const otp_model_1 = __importDefault(require("../models/otp.model"));
const email_service_1 = require("../services/email.service");
const upload_middleware_1 = require("../middlewares/upload.middleware");
const catchasync_util_1 = require("../utils/catchasync.util");
const token_denylist_util_1 = require("../utils/token-denylist.util");
const onboarding_service_1 = require("../services/onboarding.service");
// ─── Helpers ──────────────────────────────────────────────────────────────────
const generateOtpCode = () => Math.floor(100000 + Math.random() * 900000).toString();
const hashOtp = (code) => crypto_1.default.createHash("sha256").update(code).digest("hex");
const MAX_OTP_ATTEMPTS = 5;
const createAndSendOtp = (userId, email) => __awaiter(void 0, void 0, void 0, function* () {
    yield otp_model_1.default.deleteMany({ userId });
    const code = generateOtpCode();
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes
    // Store hashed code — plain code only lives in the email
    yield otp_model_1.default.create({ userId, code: hashOtp(code), expiresAt });
    yield (0, email_service_1.sendOtpEmail)(email, code);
});
const signToken = (userId, role) => {
    const jti = (0, token_denylist_util_1.generateJti)();
    return jsonwebtoken_1.default.sign({ userId, role, jti }, process.env.JWT_SECRET, { expiresIn: "7d" });
};
const validatePasswordStrength = (password) => {
    if (password.length < 8)
        return "Password must be at least 8 characters";
    if (!/[A-Z]/.test(password))
        return "Password must contain at least one uppercase letter";
    if (!/[0-9]/.test(password))
        return "Password must contain at least one number";
    return null;
};
const buildUserResponse = (user) => __awaiter(void 0, void 0, void 0, function* () {
    const accessState = yield (0, onboarding_service_1.getUserAccessState)(user);
    const response = {
        id: user._id,
        firstName: user.firstName,
        lastName: user.lastName,
        middleName: user.middleName,
        email: user.email,
        phoneNumber: user.phoneNumber,
        role: user.role,
        isOnboarded: user.isOnboarded,
        accessState,
    };
    // Include rider details if user is a rider
    if (user.role === "rider" && user.riderDetails) {
        response.riderDetails = {
            nin: user.riderDetails.nin,
            vehicleType: user.riderDetails.vehicleType,
            submittedAt: user.riderDetails.submittedAt,
        };
    }
    return response;
});
// ─── Register ─────────────────────────────────────────────────────────────────
exports.register = (0, catchasync_util_1.CatchAsync)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { firstName, lastName, email, phoneNumber, password, role } = req.body;
    if (!firstName || !lastName || !email || !phoneNumber || !password || !role) {
        res.status(400).json({ message: "All fields are required" });
        return;
    }
    // admin accounts are never created via public registration
    if (!["customer", "rider"].includes(role)) {
        res.status(400).json({ message: "Invalid role" });
        return;
    }
    const passwordError = validatePasswordStrength(password);
    if (passwordError) {
        res.status(400).json({ message: passwordError });
        return;
    }
    const existingUser = yield user_model_1.default.findOne({ email });
    if (existingUser) {
        if (!existingUser.isOnboarded) {
            yield createAndSendOtp(existingUser._id.toString(), existingUser.email);
            res.status(200).json({
                message: "OTP resent to your email",
                isOnboarded: false,
                userId: existingUser._id,
            });
            return;
        }
        res.status(409).json({ message: "User already exists" });
        return;
    }
    const user = yield user_model_1.default.create({
        firstName,
        lastName,
        email,
        phoneNumber,
        password,
        role,
        isOnboarded: false,
    });
    yield createAndSendOtp(user._id.toString(), user.email);
    res.status(201).json({
        message: "Registration successful. Please verify your email with the OTP sent.",
        isOnboarded: false,
        userId: user._id,
    });
}));
// ─── Verify OTP ───────────────────────────────────────────────────────────────
exports.verifyOtp = (0, catchasync_util_1.CatchAsync)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { userId, code } = req.body;
    if (!userId || !code) {
        res.status(400).json({
            message: "User ID and OTP code are required",
        });
        return;
    }
    // Find OTP by userId first so we can track attempts
    const otp = yield otp_model_1.default.findOne({
        userId,
        expiresAt: { $gt: new Date() },
    });
    if (!otp) {
        res.status(400).json({ message: "Invalid or expired OTP" });
        return;
    }
    if (otp.attempts >= MAX_OTP_ATTEMPTS) {
        yield otp_model_1.default.deleteMany({ userId });
        res.status(400).json({
            message: "Too many failed attempts. Please request a new OTP.",
        });
        return;
    }
    if (otp.code !== hashOtp(code)) {
        otp.attempts = (otp.attempts || 0) + 1;
        yield otp.save();
        res.status(400).json({ message: "Invalid or expired OTP" });
        return;
    }
    const user = yield user_model_1.default.findByIdAndUpdate(userId, { isOnboarded: true }, { new: true });
    if (!user) {
        res.status(404).json({ message: "User not found" });
        return;
    }
    yield otp_model_1.default.deleteMany({ userId });
    const token = signToken(user._id.toString(), user.role);
    const userResponse = yield buildUserResponse(user);
    res.status(200).json({
        message: "Email verified successfully",
        isOnboarded: true,
        token,
        user: userResponse,
    });
}));
// ─── Resend OTP ───────────────────────────────────────────────────────────────
exports.resendOtp = (0, catchasync_util_1.CatchAsync)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { email } = req.body;
    if (!email) {
        res.status(400).json({ message: "Email is required" });
        return;
    }
    // Always return the same response — never reveal whether the email exists
    const user = yield user_model_1.default.findOne({ email });
    if (user && !user.isOnboarded) {
        yield createAndSendOtp(user._id.toString(), user.email);
    }
    res.status(200).json({
        message: "If your email is registered and pending verification, a new OTP has been sent.",
    });
}));
// ─── Login ────────────────────────────────────────────────────────────────────
exports.login = (0, catchasync_util_1.CatchAsync)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { email, password } = req.body;
    if (!email || !password) {
        res.status(400).json({ message: "Email and password are required" });
        return;
    }
    const user = yield user_model_1.default.findOne({ email }).select("+password");
    if (!user) {
        res.status(401).json({ message: "Invalid email or password" });
        return;
    }
    const isMatch = yield user.comparePassword(password);
    if (!isMatch) {
        res.status(401).json({ message: "Invalid email or password" });
        return;
    }
    if (!user.isOnboarded) {
        yield createAndSendOtp(user._id.toString(), user.email);
        res.status(200).json({
            message: "Please verify your email. OTP has been sent.",
            isOnboarded: false,
            userId: user._id,
            accessState: {
                onboardingRequired: true,
                canAccessHome: false,
                accessStatus: "email_verification_required",
                isOnboarded: false,
            },
        });
        return;
    }
    const token = signToken(user._id.toString(), user.role);
    const userResponse = yield buildUserResponse(user);
    res.status(200).json({
        message: "Login successful",
        isOnboarded: true,
        token,
        canAccessHome: userResponse.accessState.canAccessHome,
        user: userResponse,
    });
}));
// ─── Admin Login ──────────────────────────────────────────────────────────────
exports.adminLogin = (0, catchasync_util_1.CatchAsync)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { email, password } = req.body;
    if (!email || !password) {
        res.status(400).json({ message: "Email and password are required" });
        return;
    }
    const user = yield user_model_1.default.findOne({ email }).select("+password");
    if (!user) {
        res.status(401).json({ message: "Invalid email or password" });
        return;
    }
    const isMatch = yield user.comparePassword(password);
    if (!isMatch) {
        res.status(401).json({ message: "Invalid email or password" });
        return;
    }
    if (user.role !== "admin" && user.role !== "operations") {
        res.status(403).json({ message: "Forbidden" });
        return;
    }
    if (!user.isOnboarded) {
        yield createAndSendOtp(user._id.toString(), user.email);
        res.status(200).json({
            message: "Please verify your email. OTP has been sent.",
            isOnboarded: false,
            userId: user._id,
            accessState: {
                onboardingRequired: true,
                canAccessHome: false,
                accessStatus: "email_verification_required",
                isOnboarded: false,
            },
        });
        return;
    }
    const token = signToken(user._id.toString(), user.role);
    const userResponse = yield buildUserResponse(user);
    res.status(200).json({
        message: "Admin login successful",
        token,
        user: userResponse,
    });
}));
// ─── Logout ───────────────────────────────────────────────────────────────────
exports.logout = (0, catchasync_util_1.CatchAsync)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b;
    const jti = (_a = req.user) === null || _a === void 0 ? void 0 : _a.jti;
    const exp = (_b = req.user) === null || _b === void 0 ? void 0 : _b.exp;
    if (jti && exp) {
        (0, token_denylist_util_1.denyToken)(jti, exp);
    }
    res.status(200).json({ message: "Logged out successfully" });
}));
// ─── Get current user ─────────────────────────────────────────────────────────
exports.getMe = (0, catchasync_util_1.CatchAsync)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    const user = yield user_model_1.default.findById((_a = req.user) === null || _a === void 0 ? void 0 : _a.userId);
    if (!user) {
        res.status(404).json({ message: "User not found" });
        return;
    }
    res.status(200).json({ user: yield buildUserResponse(user) });
}));
// ─── Upload profile image ─────────────────────────────────────────────────────
exports.uploadProfileImage = (0, catchasync_util_1.CatchAsync)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    if (!req.file) {
        res.status(400).json({ success: false, message: "No image file provided" });
        return;
    }
    const userId = (_a = req.user) === null || _a === void 0 ? void 0 : _a.userId;
    if (!userId) {
        res.status(401).json({ success: false, message: "Unauthorized" });
        return;
    }
    const imageKey = yield (0, upload_middleware_1.uploadToStorage)(req.file, `profiles/${userId}`);
    const user = yield user_model_1.default.findByIdAndUpdate(userId, { profileImageUrl: imageKey }, { new: true });
    if (!user) {
        res.status(404).json({ success: false, message: "User not found" });
        return;
    }
    const accessState = yield (0, onboarding_service_1.getUserAccessState)(user);
    res.status(200).json({
        success: true,
        message: "Profile image uploaded successfully",
        data: { profileImageUrl: imageKey, accessState },
    });
}));
