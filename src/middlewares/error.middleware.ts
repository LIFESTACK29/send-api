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
    const message = err.message || "Internal Server Error";

    console.error(`[ERROR] ${statusCode}: ${message}`);

    res.status(statusCode).json({
        success: false,
        error: message,
    });
};

export default errorMiddleware;
