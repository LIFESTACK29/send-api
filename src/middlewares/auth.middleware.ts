import { Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { AuthRequest, AuthPayload } from "../types/user.type";
import {
    getUserAccessState,
    syncUserOnboardingState,
} from "../services/onboarding.service";

/**
 * Authenticate middleware — verifies JWT from Authorization header
 * and attaches user payload to req.user
 */
export const authenticate = (
    req: AuthRequest,
    res: Response,
    next: NextFunction,
): void => {
    try {
        const authHeader = req.headers.authorization;

        if (!authHeader || !authHeader.startsWith("Bearer ")) {
            res.status(401).json({ message: "Unauthorized — no token provided" });
            return;
        }

        const token = authHeader.split(" ")[1];
        const decoded = jwt.verify(
            token,
            process.env.JWT_SECRET as string,
        ) as AuthPayload;

        req.user = {
            userId: decoded.userId,
            role: decoded.role,
        };

        next();
    } catch (error) {
        res.status(401).json({ message: "Unauthorized — invalid token" });
        return;
    }
};

/**
 * Authorize middleware — restricts access to specific roles.
 * Must be used AFTER authenticate.
 */
export const authorize = (...roles: string[]) => {
    return (req: AuthRequest, res: Response, next: NextFunction): void => {
        if (!req.user) {
            res.status(401).json({ message: "Unauthorized" });
            return;
        }

        if (!roles.includes(req.user.role)) {
            res.status(403).json({ message: "Forbidden — insufficient permissions" });
            return;
        }

        next();
    };
};

/**
 * Authorize middleware — ensures a user can only access their own :userId routes
 * unless they are an admin.
 */
export const authorizeSelfOrAdmin = (paramName = "userId") => {
    return (req: AuthRequest, res: Response, next: NextFunction): void => {
        if (!req.user) {
            res.status(401).json({ message: "Unauthorized" });
            return;
        }

        const routeUserId = req.params[paramName];
        if (!routeUserId) {
            res.status(400).json({
                message: `${paramName} route parameter is required`,
            });
            return;
        }

        if (req.user.role === "admin" || req.user.userId === routeUserId) {
            next();
            return;
        }

        res.status(403).json({
            message: "Forbidden — you can only access your own resources",
        });
    };
};

/**
 * Blocks rider-only "home" APIs until rider is fully approved by admin.
 * Customers/admin users are unaffected.
 */
export const requireActiveRiderAccess = async (
    req: AuthRequest,
    res: Response,
    next: NextFunction,
): Promise<void> => {
    try {
        if (!req.user) {
            res.status(401).json({ message: "Unauthorized" });
            return;
        }

        if (req.user.role !== "rider") {
            next();
            return;
        }

        const user = await syncUserOnboardingState(req.user.userId);

        if (!user) {
            res.status(404).json({ message: "User not found" });
            return;
        }

        const accessState = await getUserAccessState(user);

        if (!accessState.canAccessHome) {
            res.status(403).json({
                code: "RIDER_HOME_LOCKED",
                message:
                    accessState.nextStep === "pending_admin_approval"
                        ? "Verification is pending admin approval"
                        : accessState.nextStep === "email_otp"
                          ? "Email verification required"
                          : "Complete rider onboarding to continue",
                canAccessHome: accessState.canAccessHome,
                riderStatus: accessState.riderStatus,
                onboardingStage: accessState.onboardingStage,
                verificationStatus: accessState.verificationStatus,
                nextStep: accessState.nextStep,
            });
            return;
        }

        next();
    } catch (error) {
        res.status(500).json({ message: "Internal server error" });
    }
};

/**
 * Helper to get the authenticated user's MongoDB _id from the request.
 */
export const getUserId = (req: AuthRequest): string | null => {
    return req.user?.userId || null;
};
