import { Request, Response, RequestHandler } from "express";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import User from "../models/user.model";
import Otp from "../models/otp.model";
import { sendOtpEmail } from "../services/email.service";
import { AuthRequest } from "../types/user.type";
import { uploadToStorage } from "../middlewares/upload.middleware";
import { CatchAsync } from "../utils/catchasync.util";
import { generateJti, denyToken } from "../utils/token-denylist.util";
import { getUserAccessState } from "../services/onboarding.service";

// ─── Helpers ──────────────────────────────────────────────────────────────────

const generateOtpCode = (): string =>
    Math.floor(100000 + Math.random() * 900000).toString();

const hashOtp = (code: string): string =>
    crypto.createHash("sha256").update(code).digest("hex");

const MAX_OTP_ATTEMPTS = 5;

const createAndSendOtp = async (
    userId: string,
    email: string,
): Promise<void> => {
    await Otp.deleteMany({ userId });

    const code = generateOtpCode();
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes

    // Store hashed code — plain code only lives in the email
    await Otp.create({ userId, code: hashOtp(code), expiresAt });
    await sendOtpEmail(email, code);
};

const signToken = (userId: string, role: string): string => {
    const jti = generateJti();
    return jwt.sign(
        { userId, role, jti },
        process.env.JWT_SECRET as string,
        { expiresIn: "7d" },
    );
};

const validatePasswordStrength = (password: string): string | null => {
    if (password.length < 8)
        return "Password must be at least 8 characters";
    if (!/[A-Z]/.test(password))
        return "Password must contain at least one uppercase letter";
    if (!/[0-9]/.test(password))
        return "Password must contain at least one number";
    return null;
};

const buildUserResponse = async (user: any) => {
    const accessState = await getUserAccessState(user);
    const response: any = {
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
};

// ─── Register ─────────────────────────────────────────────────────────────────

export const register: RequestHandler = CatchAsync(
    async (req: Request, res: Response) => {
        const { firstName, lastName, email, phoneNumber, password, role } =
            req.body;

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

        const existingUser = await User.findOne({ email });

        if (existingUser) {
            if (!existingUser.isOnboarded) {
                await createAndSendOtp(
                    existingUser._id.toString(),
                    existingUser.email,
                );
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

        const user = await User.create({
            firstName,
            lastName,
            email,
            phoneNumber,
            password,
            role,
            isOnboarded: false,
        });

        await createAndSendOtp(user._id.toString(), user.email);

        res.status(201).json({
            message:
                "Registration successful. Please verify your email with the OTP sent.",
            isOnboarded: false,
            userId: user._id,
        });
    }
);

// ─── Verify OTP ───────────────────────────────────────────────────────────────

export const verifyOtp: RequestHandler = CatchAsync(
    async (req: Request, res: Response) => {
        const { userId, code } = req.body;

        if (!userId || !code) {
            res.status(400).json({
                message: "User ID and OTP code are required",
            });
            return;
        }

        // Find OTP by userId first so we can track attempts
        const otp = await Otp.findOne({
            userId,
            expiresAt: { $gt: new Date() },
        });

        if (!otp) {
            res.status(400).json({ message: "Invalid or expired OTP" });
            return;
        }

        if (otp.attempts >= MAX_OTP_ATTEMPTS) {
            await Otp.deleteMany({ userId });
            res.status(400).json({
                message:
                    "Too many failed attempts. Please request a new OTP.",
            });
            return;
        }

        if (otp.code !== hashOtp(code)) {
            otp.attempts = (otp.attempts || 0) + 1;
            await otp.save();
            res.status(400).json({ message: "Invalid or expired OTP" });
            return;
        }

        const user = await User.findByIdAndUpdate(
            userId,
            { isOnboarded: true },
            { new: true },
        );

        if (!user) {
            res.status(404).json({ message: "User not found" });
            return;
        }

        await Otp.deleteMany({ userId });

        const token = signToken(user._id.toString(), user.role);
        const userResponse = await buildUserResponse(user);

        res.status(200).json({
            message: "Email verified successfully",
            isOnboarded: true,
            token,
            user: userResponse,
        });
    }
);

// ─── Resend OTP ───────────────────────────────────────────────────────────────

export const resendOtp: RequestHandler = CatchAsync(
    async (req: Request, res: Response) => {
        const { email } = req.body;

        if (!email) {
            res.status(400).json({ message: "Email is required" });
            return;
        }

        // Always return the same response — never reveal whether the email exists
        const user = await User.findOne({ email });
        if (user && !user.isOnboarded) {
            await createAndSendOtp(user._id.toString(), user.email);
        }

        res.status(200).json({
            message:
                "If your email is registered and pending verification, a new OTP has been sent.",
        });
    }
);

// ─── Login ────────────────────────────────────────────────────────────────────

export const login: RequestHandler = CatchAsync(
    async (req: Request, res: Response) => {
        const { email, password } = req.body;
        if (!email || !password) {
            res.status(400).json({ message: "Email and password are required" });
            return;
        }

        const user = await User.findOne({ email }).select("+password");

        if (!user) {
            res.status(401).json({ message: "Invalid email or password" });
            return;
        }

        const isMatch = await user.comparePassword(password);
        if (!isMatch) {
            res.status(401).json({ message: "Invalid email or password" });
            return;
        }

        if (!user.isOnboarded) {
            await createAndSendOtp(user._id.toString(), user.email);
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
        const userResponse = await buildUserResponse(user);

        res.status(200).json({
            message: "Login successful",
            isOnboarded: true,
            token,
            canAccessHome: userResponse.accessState.canAccessHome,
            user: userResponse,
        });
    }
);

// ─── Admin Login ──────────────────────────────────────────────────────────────

export const adminLogin: RequestHandler = CatchAsync(
    async (req: Request, res: Response) => {
        const { email, password } = req.body;
        if (!email || !password) {
            res.status(400).json({ message: "Email and password are required" });
            return;
        }

        const user = await User.findOne({ email }).select("+password");
        if (!user) {
            res.status(401).json({ message: "Invalid email or password" });
            return;
        }

        const isMatch = await user.comparePassword(password);
        if (!isMatch) {
            res.status(401).json({ message: "Invalid email or password" });
            return;
        }

        if (user.role !== "admin" && user.role !== "operations") {
            res.status(403).json({ message: "Forbidden" });
            return;
        }

        if (!user.isOnboarded) {
            await createAndSendOtp(user._id.toString(), user.email);
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
        const userResponse = await buildUserResponse(user);

        res.status(200).json({
            message: "Admin login successful",
            token,
            user: userResponse,
        });
    }
);

// ─── Logout ───────────────────────────────────────────────────────────────────

export const logout: RequestHandler = CatchAsync(
    async (req: AuthRequest, res: Response) => {
        const jti = req.user?.jti;
        const exp = req.user?.exp;

        if (jti && exp) {
            denyToken(jti, exp);
        }

        res.status(200).json({ message: "Logged out successfully" });
    }
);

// ─── Get current user ─────────────────────────────────────────────────────────

export const getMe: RequestHandler = CatchAsync(
    async (req: AuthRequest, res: Response) => {
        const user = await User.findById(req.user?.userId);

        if (!user) {
            res.status(404).json({ message: "User not found" });
            return;
        }

        res.status(200).json({ user: await buildUserResponse(user) });
    }
);

// ─── Upload profile image ─────────────────────────────────────────────────────

export const uploadProfileImage: RequestHandler = CatchAsync(
    async (req: AuthRequest, res: Response) => {
        if (!req.file) {
            res.status(400).json({ success: false, message: "No image file provided" });
            return;
        }

        const userId = req.user?.userId;
        if (!userId) {
            res.status(401).json({ success: false, message: "Unauthorized" });
            return;
        }

        const imageKey = await uploadToStorage(req.file, `profiles/${userId}`);

        const user = await User.findByIdAndUpdate(
            userId,
            { profileImageUrl: imageKey },
            { new: true },
        );

        if (!user) {
            res.status(404).json({ success: false, message: "User not found" });
            return;
        }

        const accessState = await getUserAccessState(user);

        res.status(200).json({
            success: true,
            message: "Profile image uploaded successfully",
            data: { profileImageUrl: imageKey, accessState },
        });
    }
);
