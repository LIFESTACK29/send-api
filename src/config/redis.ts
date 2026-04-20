import Redis from "ioredis";
import dotenv from "dotenv";

dotenv.config();

const REDIS_URL = process.env.REDIS_URL || "redis://127.0.0.1:6379";

export const redisConnection = new Redis(REDIS_URL, {
    maxRetriesPerRequest: null,
    tls: REDIS_URL.startsWith("rediss://") ? {} : undefined,
});

redisConnection.on("connect", () => {
    console.log("✅ Connected to Redis");
});

redisConnection.on("error", (err) => {
    console.error("❌ Redis connection error:", err);
});

export default redisConnection;
