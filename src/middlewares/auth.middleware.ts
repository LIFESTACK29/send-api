import { Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import User from "../models/user.model";
import { AuthRequest, AuthPayload } from "../types/user.type";
import { isTokenDenied } from "../utils/token-denylist.util";
import { getUserAccessState } from "../services/onboarding.service";

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

        // Reject tokens that have been explicitly revoked via logout
        if (decoded.jti && isTokenDenied(decoded.jti)) {
            res.status(401).json({ message: "Unauthorized — session has been revoked" });
            return;
        }

        req.user = {
            userId: decoded.userId,
            role: decoded.role,
            jti: decoded.jti,
            exp: decoded.exp,
        };

        next();
    } catch (error) {
        res.status(401).json({ message: "Unauthorized — invalid token" });
    }
};

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

        const user = await User.findById(req.user.userId);

        if (!user) {
            res.status(404).json({ message: "User not found" });
            return;
        }

        const accessState = await getUserAccessState(user);

        if (!accessState.canAccessHome) {
            res.status(403).json({
                code: "RIDER_HOME_LOCKED",
                message:
                    accessState.accessStatus === "email_verification_required"
                        ? "Email verification required"
                        : "Complete rider onboarding to continue",
                canAccessHome: accessState.canAccessHome,
                isOnboarded: user.isOnboarded,
                accessStatus: accessState.accessStatus,
            });
            return;
        }

        next();
    } catch (error) {
        res.status(500).json({ message: "Internal server error" });
    }
};

export const getUserId = (req: AuthRequest): string | null => {
    return req.user?.userId || null;
};
