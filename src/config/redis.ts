import Redis from "ioredis";
import dotenv from "dotenv";

dotenv.config();

const REDIS_URL = process.env.REDIS_URL || "redis://127.0.0.1:6379";

export const redisConnection = new Redis(REDIS_URL, {
    maxRetriesPerRequest: null,
    tls: REDIS_URL.startsWith("rediss://") ? {} : undefined,
});

redisConnection.on("error", () => {});

export default redisConnection;
