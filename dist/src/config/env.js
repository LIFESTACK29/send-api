"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
const PLACEHOLDER_SECRET = "your_jwt_secret_key_here";
const MIN_SECRET_BYTES = 32;
function validateEnv() {
    const missing = [];
    const required = [
        "MONGO_URI",
        "JWT_SECRET",
        "PAYSTACK_SECRET_KEY",
        "RESEND_API_KEY",
        "FIREBASE_PROJECT_ID",
        "FIREBASE_CLIENT_EMAIL",
        "FIREBASE_PRIVATE_KEY",
        "CF_R2_ACCOUNT_ID",
        "CF_R2_ACCESS_KEY_ID",
        "CF_R2_SECRET_ACCESS_KEY",
        "CF_R2_BUCKET_NAME",
    ];
    for (const key of required) {
        if (!process.env[key])
            missing.push(key);
    }
    if (missing.length > 0) {
        throw new Error(`FATAL: Missing required environment variables: ${missing.join(", ")}\n` +
            "Copy .env.example to .env and fill in real values.");
    }
    const secret = process.env.JWT_SECRET;
    if (secret === PLACEHOLDER_SECRET) {
        throw new Error("FATAL: JWT_SECRET is still the default placeholder.\n" +
            "Generate a secure secret with:\n" +
            '  node -e "console.log(require(\'crypto\').randomBytes(64).toString(\'hex\'))"');
    }
    if (Buffer.byteLength(secret, "utf8") < MIN_SECRET_BYTES) {
        throw new Error(`FATAL: JWT_SECRET is too short (minimum ${MIN_SECRET_BYTES} bytes). ` +
            "Generate a secure secret with:\n" +
            '  node -e "console.log(require(\'crypto\').randomBytes(64).toString(\'hex\'))"');
    }
}
validateEnv();
