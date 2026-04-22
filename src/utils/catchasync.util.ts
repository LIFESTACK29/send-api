import { Request, Response, NextFunction, RequestHandler } from "express";

/**
 * Wrapper for async route handlers to catch errors
 * Usage: export const handler = CatchAsync(async (req, res) => { ... })
 */
export const CatchAsync = (fn: RequestHandler): RequestHandler => {
    return (req: Request, res: Response, next: NextFunction) => {
        Promise.resolve(fn(req, res, next)).catch(next);
    };
};
