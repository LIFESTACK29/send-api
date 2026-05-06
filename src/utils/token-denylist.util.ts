import crypto from "crypto";

// In-memory denylist keyed by JWT ID (jti) → expiry unix timestamp (seconds).
// For multi-instance deployments replace this Map with a Redis SETEX call
// using the existing ioredis client in src/config/redis.ts.
const denylist = new Map<string, number>();

export function denyToken(jti: string, expiresAt: number): void {
    denylist.set(jti, expiresAt);
    scheduleCleanup();
}

export function isTokenDenied(jti: string): boolean {
    const exp = denylist.get(jti);
    if (exp === undefined) return false;
    if (Math.floor(Date.now() / 1000) > exp) {
        denylist.delete(jti);
        return false;
    }
    return true;
}

// Generate a unique JWT ID to embed in every token
export function generateJti(): string {
    return crypto.randomUUID();
}

// Prune expired entries at most once per minute
let pruneScheduled = false;
function scheduleCleanup(): void {
    if (pruneScheduled) return;
    pruneScheduled = true;
    setTimeout(() => {
        const now = Math.floor(Date.now() / 1000);
        for (const [jti, exp] of denylist.entries()) {
            if (now > exp) denylist.delete(jti);
        }
        pruneScheduled = false;
    }, 60_000);
}
