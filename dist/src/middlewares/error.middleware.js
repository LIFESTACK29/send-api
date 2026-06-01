"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const errorMiddleware = (err, _req, res, _next) => {
    const statusCode = err.statusCode || 500;
    // Never leak internal details for server errors
    const clientMessage = statusCode < 500
        ? err.message || "An error occurred"
        : "Internal server error";
    res.status(statusCode).json({
        success: false,
        error: clientMessage,
    });
};
exports.default = errorMiddleware;
