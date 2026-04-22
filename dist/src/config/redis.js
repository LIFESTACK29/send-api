"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.redisConnection = void 0;
const ioredis_1 = __importDefault(require("ioredis"));
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
const REDIS_URL = process.env.REDIS_URL || "redis://127.0.0.1:6379";
exports.redisConnection = new ioredis_1.default(REDIS_URL, {
    maxRetriesPerRequest: null,
    tls: REDIS_URL.startsWith("rediss://") ? {} : undefined,
});
exports.redisConnection.on("connect", () => {
    console.log("✅ Connected to Redis");
});
exports.redisConnection.on("error", (err) => {
    console.error("❌ Redis connection error:", err);
});
exports.default = exports.redisConnection;
