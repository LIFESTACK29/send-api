import { Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { AuthRequest, AuthPayload } from "../types/user.type";

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
 * Helper to get the authenticated user's MongoDB _id from the request.
 */
export const getUserId = (req: AuthRequest): string | null => {
    return req.user?.userId || null;
};
