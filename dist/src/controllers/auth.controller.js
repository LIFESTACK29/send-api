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
exports.uploadProfileImage = exports.getMe = exports.login = exports.resendOtp = exports.verifyOtp = exports.register = void 0;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const user_model_1 = __importDefault(require("../models/user.model"));
const otp_model_1 = __importDefault(require("../models/otp.model"));
const email_service_1 = require("../services/email.service");
const upload_middleware_1 = require("../middlewares/upload.middleware");
const catchasync_util_1 = require("../utils/catchasync.util");
const onboarding_service_1 = require("../services/onboarding.service");
/**
 * Generate a random 6-digit OTP code
 */
const generateOtpCode = () => {
    return Math.floor(100000 + Math.random() * 900000).toString();
};
/**
 * Create OTP, save to DB, and send via email
 */
const createAndSendOtp = (userId, email) => __awaiter(void 0, void 0, void 0, function* () {
    // Remove any existing OTPs for this user
    yield otp_model_1.default.deleteMany({ userId });
    const code = generateOtpCode();
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes
    yield otp_model_1.default.create({ userId, code, expiresAt });
    yield (0, email_service_1.sendOtpEmail)(email, code);
});
/**
 * Sign a JWT token
 */
const signToken = (userId, role) => {
    return jsonwebtoken_1.default.sign({ userId, role }, process.env.JWT_SECRET, {
        expiresIn: "7d",
    });
};
const buildUserResponse = (user) => __awaiter(void 0, void 0, void 0, function* () {
    const accessState = yield (0, onboarding_service_1.getUserAccessState)(user);
    return {
        id: user._id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        phoneNumber: user.phoneNumber,
        role: user.role,
        isOnboarded: user.isOnboarded,
        riderStatus: user.riderStatus,
        onboardingStage: user.onboardingStage,
        verificationStatus: user.verificationStatus,
        profileImageUrl: user.profileImageUrl,
        verificationNotes: user.verificationNotes,
        accessState,
    };
});
/**
 * @desc    Register a new user
 * @route   POST /api/v1/auth/register
 * @access  Public
 */
const register = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { firstName, lastName, email, phoneNumber, password, role } = req.body;
        if (!firstName ||
            !lastName ||
            !email ||
            !phoneNumber ||
            !password ||
            !role) {
            res.status(400).json({ message: "All fields are required" });
            return;
        }
        // Check if role is valid
        if (!["customer", "rider", "admin"].includes(role)) {
            res.status(400).json({ message: "Invalid role" });
            return;
        }
        // Check if user already exists
        const existingUser = yield user_model_1.default.findOne({ email });
        if (existingUser) {
            // If user exists but hasn't onboarded, resend OTP
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
        // Create user
        const user = yield user_model_1.default.create({
            firstName,
            lastName,
            email,
            phoneNumber,
            password,
            role,
            isOnboarded: false,
            onboardingStage: "email_pending",
            verificationStatus: "not_submitted",
        });
        // Generate and send OTP
        yield createAndSendOtp(user._id.toString(), user.email);
        res.status(201).json({
            message: "Registration successful. Please verify your email with the OTP sent.",
            isOnboarded: false,
            userId: user._id,
        });
    }
    catch (error) {
        console.error("Error in register:", error);
        res.status(500).json({ message: "Internal server error" });
    }
});
exports.register = register;
/**
 * @desc    Verify OTP code
 * @route   POST /api/v1/auth/verify-otp
 * @access  Public
 */
const verifyOtp = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { userId, code } = req.body;
        if (!userId || !code) {
            res.status(400).json({
                message: "User ID and OTP code are required",
            });
            return;
        }
        // Find valid OTP
        const otp = yield otp_model_1.default.findOne({
            userId,
            code,
            expiresAt: { $gt: new Date() },
        });
        if (!otp) {
            res.status(400).json({ message: "Invalid or expired OTP" });
            return;
        }
        // Mark user as onboarded
        const user = yield user_model_1.default.findByIdAndUpdate(userId, { isOnboarded: true }, { new: true });
        if (!user) {
            res.status(404).json({ message: "User not found" });
            return;
        }
        const syncedUser = yield (0, onboarding_service_1.syncUserOnboardingState)(user._id.toString());
        if (!syncedUser) {
            res.status(404).json({ message: "User not found" });
            return;
        }
        // Clean up used OTP
        yield otp_model_1.default.deleteMany({ userId });
        // Generate JWT
        const token = signToken(user._id.toString(), user.role);
        res.status(200).json({
            message: "Email verified successfully",
            isOnboarded: true,
            token,
            user: yield buildUserResponse(syncedUser),
        });
    }
    catch (error) {
        console.error("Error in verifyOtp:", error);
        res.status(500).json({ message: "Internal server error" });
    }
});
exports.verifyOtp = verifyOtp;
/**
 * @desc    Resend OTP code
 * @route   POST /api/v1/auth/resend-otp
 * @access  Public
 */
const resendOtp = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { email } = req.body;
        if (!email) {
            res.status(400).json({ message: "Email is required" });
            return;
        }
        const user = yield user_model_1.default.findOne({ email });
        if (!user) {
            res.status(404).json({ message: "User not found" });
            return;
        }
        if (user.isOnboarded) {
            res.status(400).json({ message: "User is already verified" });
            return;
        }
        yield createAndSendOtp(user._id.toString(), user.email);
        res.status(200).json({
            message: "OTP resent to your email",
        });
    }
    catch (error) {
        console.error("Error in resendOtp:", error);
        res.status(500).json({ message: "Internal server error" });
    }
});
exports.resendOtp = resendOtp;
/**
 * @desc    Login user
 * @route   POST /api/v1/auth/login
 * @access  Public
 */
const login = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { email, password } = req.body;
        if (!email || !password) {
            res.status(400).json({
                message: "Email and password are required",
            });
            return;
        }
        // Find user with password field included
        const user = yield user_model_1.default.findOne({ email }).select("+password");
        if (!user) {
            res.status(401).json({ message: "Invalid email or password" });
            return;
        }
        // Check password
        const isMatch = yield user.comparePassword(password);
        if (!isMatch) {
            res.status(401).json({ message: "Invalid email or password" });
            return;
        }
        // If not onboarded, send OTP and inform client
        if (!user.isOnboarded) {
            yield createAndSendOtp(user._id.toString(), user.email);
            res.status(200).json({
                message: "Please verify your email. OTP has been sent.",
                isOnboarded: false,
                userId: user._id,
                accessState: {
                    onboardingStage: "email_pending",
                    verificationStatus: "not_submitted",
                    onboardingRequired: true,
                    canAccessHome: false,
                    accessStatus: "email_verification_required",
                    nextStep: "email_otp",
                },
            });
            return;
        }
        // Generate JWT
        const token = signToken(user._id.toString(), user.role);
        const userResponse = yield buildUserResponse(user);
        res.status(200).json({
            message: "Login successful",
            isOnboarded: true,
            token,
            canAccessHome: userResponse.accessState.canAccessHome,
            nextStep: userResponse.accessState.nextStep,
            user: userResponse,
        });
    }
    catch (error) {
        console.error("Error in login:", error);
        res.status(500).json({ message: "Internal server error" });
    }
});
exports.login = login;
/**
 * @desc    Get current user profile
 * @route   GET /api/v1/auth/me
 * @access  Private
 */
const getMe = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    try {
        const user = yield user_model_1.default.findById((_a = req.user) === null || _a === void 0 ? void 0 : _a.userId);
        if (!user) {
            res.status(404).json({ message: "User not found" });
            return;
        }
        res.status(200).json({
            user: yield buildUserResponse(user),
        });
    }
    catch (error) {
        console.error("Error in getMe:", error);
        res.status(500).json({ message: "Internal server error" });
    }
});
exports.getMe = getMe;
/**
 * @desc    Upload profile image (for riders during onboarding)
 * @route   POST /api/v1/auth/upload-profile-image
 * @access  Private
 */
exports.uploadProfileImage = (0, catchasync_util_1.CatchAsync)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    if (!req.file) {
        res.status(400).json({
            success: false,
            message: "No image file provided",
        });
        return;
    }
    const userId = (_a = req.user) === null || _a === void 0 ? void 0 : _a.userId;
    if (!userId) {
        res.status(401).json({
            success: false,
            message: "Unauthorized",
        });
        return;
    }
    // Upload to S3
    const imageUrl = yield (0, upload_middleware_1.uploadToStorage)(req.file, `profiles/${userId}`);
    // Update user profile
    const user = yield user_model_1.default.findByIdAndUpdate(userId, { profileImageUrl: imageUrl }, { new: true });
    if (!user) {
        res.status(404).json({
            success: false,
            message: "User not found",
        });
        return;
    }
    const syncedUser = yield (0, onboarding_service_1.syncUserOnboardingState)(user._id.toString());
    const accessState = syncedUser
        ? yield (0, onboarding_service_1.getUserAccessState)(syncedUser)
        : undefined;
    res.status(200).json({
        success: true,
        message: "Profile image uploaded successfully",
        data: {
            profileImageUrl: imageUrl,
            accessState,
        },
    });
}));
