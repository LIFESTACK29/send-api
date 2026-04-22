"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getUserId = exports.authorize = exports.authenticate = void 0;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
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
 * Helper to get the authenticated user's MongoDB _id from the request.
 */
const getUserId = (req) => {
    var _a;
    return ((_a = req.user) === null || _a === void 0 ? void 0 : _a.userId) || null;
};
exports.getUserId = getUserId;
