import { Request, Response, RequestHandler } from "express";
import jwt from "jsonwebtoken";
import User from "../models/user.model";
import Otp from "../models/otp.model";
import { sendOtpEmail } from "../services/email.service";
import { AuthRequest } from "../types/user.type";
import { uploadToStorage } from "../middlewares/upload.middleware";
import { CatchAsync } from "../utils/catchasync.util";

/**
 * Generate a random 6-digit OTP code
 */
const generateOtpCode = (): string => {
    return Math.floor(100000 + Math.random() * 900000).toString();
};

/**
 * Create OTP, save to DB, and send via email
 */
const createAndSendOtp = async (
    userId: string,
    email: string,
): Promise<void> => {
    // Remove any existing OTPs for this user
    await Otp.deleteMany({ userId });

    const code = generateOtpCode();
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes

    await Otp.create({ userId, code, expiresAt });
    await sendOtpEmail(email, code);
};

/**
 * Sign a JWT token
 */
const signToken = (userId: string, role: string): string => {
    return jwt.sign({ userId, role }, process.env.JWT_SECRET as string, {
        expiresIn: "7d",
    });
};

/**
 * @desc    Register a new user
 * @route   POST /api/v1/auth/register
 * @access  Public
 */
export const register: RequestHandler = async (req: Request, res: Response) => {
    try {
        const { firstName, lastName, email, phoneNumber, password, role } =
            req.body;

        if (
            !firstName ||
            !lastName ||
            !email ||
            !phoneNumber ||
            !password ||
            !role
        ) {
            res.status(400).json({ message: "All fields are required" });
            return;
        }

        // Check if role is valid
        if (!["customer", "rider", "admin"].includes(role)) {
            res.status(400).json({ message: "Invalid role" });
            return;
        }

        // Check if user already exists
        const existingUser = await User.findOne({ email });

        if (existingUser) {
            // If user exists but hasn't onboarded, resend OTP
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

        // Create user
        const user = await User.create({
            firstName,
            lastName,
            email,
            phoneNumber,
            password,
            role,
            isOnboarded: false,
        });

        // Generate and send OTP
        await createAndSendOtp(user._id.toString(), user.email);

        res.status(201).json({
            message:
                "Registration successful. Please verify your email with the OTP sent.",
            isOnboarded: false,
            userId: user._id,
        });
    } catch (error: any) {
        console.error("Error in register:", error);
        res.status(500).json({ message: "Internal server error" });
    }
};

/**
 * @desc    Verify OTP code
 * @route   POST /api/v1/auth/verify-otp
 * @access  Public
 */
export const verifyOtp: RequestHandler = async (
    req: Request,
    res: Response,
) => {
    try {
        const { userId, code } = req.body;

        if (!userId || !code) {
            res.status(400).json({
                message: "User ID and OTP code are required",
            });
            return;
        }

        // Find valid OTP
        const otp = await Otp.findOne({
            userId,
            code,
            expiresAt: { $gt: new Date() },
        });

        if (!otp) {
            res.status(400).json({ message: "Invalid or expired OTP" });
            return;
        }

        // Mark user as onboarded
        const user = await User.findByIdAndUpdate(
            userId,
            { isOnboarded: true },
            { new: true },
        );

        if (!user) {
            res.status(404).json({ message: "User not found" });
            return;
        }

        // Clean up used OTP
        await Otp.deleteMany({ userId });

        // Generate JWT
        const token = signToken(user._id.toString(), user.role);

        res.status(200).json({
            message: "Email verified successfully",
            isOnboarded: true,
            token,
            user: {
                id: user._id,
                firstName: user.firstName,
                lastName: user.lastName,
                email: user.email,
                phoneNumber: user.phoneNumber,
                role: user.role,
            },
        });
    } catch (error: any) {
        console.error("Error in verifyOtp:", error);
        res.status(500).json({ message: "Internal server error" });
    }
};

/**
 * @desc    Resend OTP code
 * @route   POST /api/v1/auth/resend-otp
 * @access  Public
 */
export const resendOtp: RequestHandler = async (
    req: Request,
    res: Response,
) => {
    try {
        const { email } = req.body;

        if (!email) {
            res.status(400).json({ message: "Email is required" });
            return;
        }

        const user = await User.findOne({ email });

        if (!user) {
            res.status(404).json({ message: "User not found" });
            return;
        }

        if (user.isOnboarded) {
            res.status(400).json({ message: "User is already verified" });
            return;
        }

        await createAndSendOtp(user._id.toString(), user.email);

        res.status(200).json({
            message: "OTP resent to your email",
        });
    } catch (error: any) {
        console.error("Error in resendOtp:", error);
        res.status(500).json({ message: "Internal server error" });
    }
};

/**
 * @desc    Login user
 * @route   POST /api/v1/auth/login
 * @access  Public
 */
export const login: RequestHandler = async (req: Request, res: Response) => {
    try {
        const { email, password } = req.body;
        console.log(email);
        if (!email || !password) {
            res.status(400).json({
                message: "Email and password are required",
            });
            return;
        }

        // Find user with password field included
        const user = await User.findOne({ email }).select("+password");

        if (!user) {
            res.status(401).json({ message: "Invalid email or password" });
            return;
        }

        // Check password
        const isMatch = await user.comparePassword(password);

        if (!isMatch) {
            res.status(401).json({ message: "Invalid email or password" });
            return;
        }

        // If not onboarded, send OTP and inform client
        if (!user.isOnboarded) {
            await createAndSendOtp(user._id.toString(), user.email);

            res.status(200).json({
                message: "Please verify your email. OTP has been sent.",
                isOnboarded: false,
                userId: user._id,
            });
            return;
        }

        // Generate JWT
        const token = signToken(user._id.toString(), user.role);

        res.status(200).json({
            message: "Login successful",
            isOnboarded: true,
            token,
            user: {
                id: user._id,
                firstName: user.firstName,
                lastName: user.lastName,
                email: user.email,
                phoneNumber: user.phoneNumber,
                role: user.role,
            },
        });
    } catch (error: any) {
        console.error("Error in login:", error);
        res.status(500).json({ message: "Internal server error" });
    }
};

/**
 * @desc    Get current user profile
 * @route   GET /api/v1/auth/me
 * @access  Private
 */
export const getMe: RequestHandler = async (
    req: AuthRequest,
    res: Response,
) => {
    try {
        const user = await User.findById(req.user?.userId);

        if (!user) {
            res.status(404).json({ message: "User not found" });
            return;
        }

        res.status(200).json({
            user: {
                id: user._id,
                firstName: user.firstName,
                lastName: user.lastName,
                email: user.email,
                phoneNumber: user.phoneNumber,
                role: user.role,
                isOnboarded: user.isOnboarded,
                // addresses: user.addresses,
            },
        });
    } catch (error: any) {
        console.error("Error in getMe:", error);
        res.status(500).json({ message: "Internal server error" });
    }
};

/**
 * @desc    Upload profile image (for riders during onboarding)
 * @route   POST /api/v1/auth/upload-profile-image
 * @access  Private
 */
export const uploadProfileImage: RequestHandler = CatchAsync(
    async (req: AuthRequest, res: Response) => {
        if (!req.file) {
            res.status(400).json({
                success: false,
                message: "No image file provided",
            });
            return;
        }

        const userId = req.user?.userId;
        if (!userId) {
            res.status(401).json({
                success: false,
                message: "Unauthorized",
            });
            return;
        }

        // Upload to S3
        const imageUrl = await uploadToStorage(req.file, `profiles/${userId}`);

        // Update user profile
        const user = await User.findByIdAndUpdate(
            userId,
            { profileImageUrl: imageUrl },
            { new: true },
        );

        if (!user) {
            res.status(404).json({
                success: false,
                message: "User not found",
            });
            return;
        }

        res.status(200).json({
            success: true,
            message: "Profile image uploaded successfully",
            data: {
                profileImageUrl: imageUrl,
            },
        });
    },
);
