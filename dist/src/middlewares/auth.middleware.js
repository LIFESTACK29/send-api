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
const token_denylist_util_1 = require("../utils/token-denylist.util");
const onboarding_service_1 = require("../services/onboarding.service");
const authenticate = (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith("Bearer ")) {
            res.status(401).json({ message: "Unauthorized — no token provided" });
            return;
        }
        const token = authHeader.split(" ")[1];
        const decoded = jsonwebtoken_1.default.verify(token, process.env.JWT_SECRET);
        // Reject tokens that have been explicitly revoked via logout
        if (decoded.jti && (0, token_denylist_util_1.isTokenDenied)(decoded.jti)) {
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
    }
    catch (error) {
        res.status(401).json({ message: "Unauthorized — invalid token" });
    }
};
exports.authenticate = authenticate;
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
        const user = yield user_model_1.default.findById(req.user.userId);
        if (!user) {
            res.status(404).json({ message: "User not found" });
            return;
        }
        const accessState = yield (0, onboarding_service_1.getUserAccessState)(user);
        if (!accessState.canAccessHome) {
            res.status(403).json({
                code: "RIDER_HOME_LOCKED",
                message: accessState.accessStatus === "email_verification_required"
                    ? "Email verification required"
                    : "Complete rider onboarding to continue",
                canAccessHome: accessState.canAccessHome,
                isOnboarded: user.isOnboarded,
                accessStatus: accessState.accessStatus,
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
const getUserId = (req) => {
    var _a;
    return ((_a = req.user) === null || _a === void 0 ? void 0 : _a.userId) || null;
};
exports.getUserId = getUserId;
