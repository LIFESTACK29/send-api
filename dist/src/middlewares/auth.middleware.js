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
exports.getUserId = exports.requireActiveRiderAccess = exports.authorizeSelfOrAdmin = exports.authorize = exports.authenticate = void 0;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const user_model_1 = __importDefault(require("../models/user.model"));
/**
 * Authenticate middleware — verifies JWT from Authorization header
 * and attaches user payload to req.user
 */
const authenticate = (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith("Bearer ")) {
            res.status(401).json({ message: "Unauthorized — no token provided" });
            return;
        }
        const token = authHeader.split(" ")[1];
        const decoded = jsonwebtoken_1.default.verify(token, process.env.JWT_SECRET);
        req.user = {
            userId: decoded.userId,
            role: decoded.role,
        };
        next();
    }
    catch (error) {
        res.status(401).json({ message: "Unauthorized — invalid token" });
        return;
    }
};
exports.authenticate = authenticate;
/**
 * Authorize middleware — restricts access to specific roles.
 * Must be used AFTER authenticate.
 */
const authorize = (...roles) => {
    return (req, res, next) => {
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
exports.authorize = authorize;
/**
 * Authorize middleware — ensures a user can only access their own :userId routes
 * unless they are an admin.
 */
const authorizeSelfOrAdmin = (paramName = "userId") => {
    return (req, res, next) => {
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
exports.authorizeSelfOrAdmin = authorizeSelfOrAdmin;
/**
 * Blocks rider-only "home" APIs until rider is fully approved by admin.
 * Customers/admin users are unaffected.
 */
const requireActiveRiderAccess = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        if (!req.user) {
            res.status(401).json({ message: "Unauthorized" });
            return;
        }
        if (req.user.role !== "rider") {
            next();
            return;
        }
        const user = yield user_model_1.default.findById(req.user.userId).select("isOnboarded riderStatus role");
        if (!user) {
            res.status(404).json({ message: "User not found" });
            return;
        }
        if (!user.isOnboarded) {
            res.status(403).json({
                message: "Email verification required",
                code: "EMAIL_VERIFICATION_REQUIRED",
                canAccessHome: false,
                nextStep: "email_otp",
            });
            return;
        }
        if (user.riderStatus !== "active") {
            const nextStep = user.riderStatus === "pending_verification"
                ? "pending_admin_approval"
                : user.riderStatus === "rejected"
                    ? "documents"
                    : "profile_image";
            res.status(403).json({
                message: user.riderStatus === "pending_verification"
                    ? "Verification is pending admin approval"
                    : user.riderStatus === "rejected"
                        ? "Verification was rejected. Please update required details."
                        : "Complete rider onboarding to continue",
                code: "RIDER_HOME_LOCKED",
                canAccessHome: false,
                riderStatus: user.riderStatus,
                nextStep,
            });
            return;
        }
        next();
    }
    catch (error) {
        res.status(500).json({ message: "Internal server error" });
    }
});
exports.requireActiveRiderAccess = requireActiveRiderAccess;
/**
 * Helper to get the authenticated user's MongoDB _id from the request.
 */
const getUserId = (req) => {
    var _a;
    return ((_a = req.user) === null || _a === void 0 ? void 0 : _a.userId) || null;
};
exports.getUserId = getUserId;
