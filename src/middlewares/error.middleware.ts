import { Request, Response, NextFunction } from "express";

interface AppError extends Error {
    statusCode?: number;
}

const errorMiddleware = (
    err: AppError,
    _req: Request,
    res: Response,
    _next: NextFunction,
) => {
    const statusCode = err.statusCode || 500;

    // Never leak internal details for server errors
    const clientMessage =
        statusCode < 500
            ? err.message || "An error occurred"
            : "Internal server error";

    res.status(statusCode).json({
        success: false,
        error: clientMessage,
    });
};

export default errorMiddleware;
