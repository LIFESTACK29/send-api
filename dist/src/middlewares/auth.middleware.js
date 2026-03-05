"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getClerkUserId = exports.requireAuth = exports.clerkMiddleware = void 0;
const express_1 = require("@clerk/express");
Object.defineProperty(exports, "clerkMiddleware", { enumerable: true, get: function () { return express_1.clerkMiddleware; } });
Object.defineProperty(exports, "requireAuth", { enumerable: true, get: function () { return express_1.requireAuth; } });
/**
 * Helper to get the authenticated user's Clerk ID from the request.
 */
const getClerkUserId = (req) => {
    const auth = (0, express_1.getAuth)(req);
    return (auth === null || auth === void 0 ? void 0 : auth.userId) || null;
};
exports.getClerkUserId = getClerkUserId;
