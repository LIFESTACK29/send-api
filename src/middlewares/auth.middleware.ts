import { clerkMiddleware, requireAuth, getAuth } from "@clerk/express";
import { Request } from "express";

/**
 * Clerk middleware — attaches auth info to every request.
 * Use this globally in app.ts.
 */
export { clerkMiddleware };

/**
 * Protect middleware — blocks unauthenticated requests (401).
 * Use on specific routes/routers that require auth.
 */
export { requireAuth };

/**
 * Helper to get the authenticated user's Clerk ID from the request.
 */
export const getClerkUserId = (req: Request): string | null => {
    const auth = getAuth(req);
    return auth?.userId || null;
};
