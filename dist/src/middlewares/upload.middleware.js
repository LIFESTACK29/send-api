"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.processUploads = exports.deleteFromStorage = exports.getStorageUrl = exports.uploadToStorage = exports.validateFileType = exports.upload = void 0;
const client_s3_1 = require("@aws-sdk/client-s3");
const s3_request_presigner_1 = require("@aws-sdk/s3-request-presigner");
const multer_1 = __importDefault(require("multer"));
const crypto_1 = __importDefault(require("crypto"));
const path_1 = __importDefault(require("path"));
const s3 = new client_s3_1.S3Client({
    region: "auto",
    endpoint: `https://${process.env.CF_R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
        accessKeyId: process.env.CF_R2_ACCESS_KEY_ID || "",
        secretAccessKey: process.env.CF_R2_SECRET_ACCESS_KEY || "",
    },
});
const BUCKET = process.env.CF_R2_BUCKET_NAME || "raha";
const BASE_URL = process.env.CF_R2_PUBLIC_URL || "";
// ─── Magic-byte signatures for allowed image types ───────────────────────────
const MAGIC = [
    { mime: "image/jpeg", bytes: [0xff, 0xd8, 0xff] },
    { mime: "image/png", bytes: [0x89, 0x50, 0x4e, 0x47] },
    { mime: "image/gif", bytes: [0x47, 0x49, 0x46, 0x38] },
    // WebP: "RIFF" at 0 and "WEBP" at offset 8
    { mime: "image/webp", bytes: [0x52, 0x49, 0x46, 0x46] },
];
const ALLOWED_MIMES = MAGIC.map((m) => m.mime);
function detectMime(buf) {
    var _a, _b;
    for (const sig of MAGIC) {
        const slice = buf.slice((_a = sig.offset) !== null && _a !== void 0 ? _a : 0, ((_b = sig.offset) !== null && _b !== void 0 ? _b : 0) + sig.bytes.length);
        if (sig.bytes.every((b, i) => slice[i] === b)) {
            if (sig.mime === "image/webp") {
                // Also verify "WEBP" at offset 8
                if (buf.slice(8, 12).toString("ascii") !== "WEBP")
                    continue;
            }
            return sig.mime;
        }
    }
    return null;
}
// ─── Multer setup (MIME filter is content-type only — magic check comes after) ─
const storage = multer_1.default.memoryStorage();
const fileFilter = (_req, file, cb) => {
    // Allow declared image types through — actual content verified in validateFileType
    if (ALLOWED_MIMES.includes(file.mimetype)) {
        cb(null, true);
    }
    else {
        cb(new Error(`File type not permitted: ${file.mimetype}`));
    }
};
exports.upload = (0, multer_1.default)({
    storage,
    fileFilter,
    limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB
});
// ─── Post-multer magic-byte validation ───────────────────────────────────────
// Use this middleware immediately after upload.single() / upload.fields() in
// every route that accepts file uploads.
const validateFileType = (req, _res, next) => {
    if (!req.file)
        return next();
    const detected = detectMime(req.file.buffer);
    if (!detected || !ALLOWED_MIMES.includes(detected)) {
        next(Object.assign(new Error("Invalid file content — upload rejected"), {
            statusCode: 415,
        }));
        return;
    }
    // Overwrite the client-supplied MIME with the verified value
    req.file.mimetype = detected;
    next();
};
exports.validateFileType = validateFileType;
// ─── Upload to private S3 storage ────────────────────────────────────────────
const uploadToStorage = (file_1, ...args_1) => __awaiter(void 0, [file_1, ...args_1], void 0, function* (file, folder = "general") {
    const ext = path_1.default.extname(file.originalname) || ".jpg";
    const key = `${folder}/${crypto_1.default.randomUUID()}${ext}`;
    yield s3.send(new client_s3_1.PutObjectCommand({
        Bucket: BUCKET,
        Key: key,
        Body: file.buffer,
        ContentType: file.mimetype,
        // No ACL — files are private by default
    }));
    // Return the key so callers can generate presigned URLs on demand
    return key;
});
exports.uploadToStorage = uploadToStorage;
// ─── Presigned URL generation (valid for 1 hour) ──────────────────────────────
const SIGNED_URL_TTL = 3600; // seconds
const getStorageUrl = (keyOrLegacyUrl) => __awaiter(void 0, void 0, void 0, function* () {
    // Support legacy records that stored a full URL instead of a key
    const key = keyOrLegacyUrl.startsWith("https://")
        ? keyOrLegacyUrl.replace(`${BASE_URL}/`, "")
        : keyOrLegacyUrl;
    const command = new client_s3_1.GetObjectCommand({ Bucket: BUCKET, Key: key });
    return (0, s3_request_presigner_1.getSignedUrl)(s3, command, { expiresIn: SIGNED_URL_TTL });
});
exports.getStorageUrl = getStorageUrl;
// ─── Delete from storage ──────────────────────────────────────────────────────
const deleteFromStorage = (keyOrLegacyUrl) => __awaiter(void 0, void 0, void 0, function* () {
    if (!keyOrLegacyUrl)
        return;
    const key = keyOrLegacyUrl.startsWith("https://")
        ? keyOrLegacyUrl.replace(`${BASE_URL}/`, "")
        : keyOrLegacyUrl;
    yield s3.send(new client_s3_1.DeleteObjectCommand({ Bucket: BUCKET, Key: key }));
});
exports.deleteFromStorage = deleteFromStorage;
// ─── Multipart upload helper (kept for backward compat) ──────────────────────
const processUploads = (req, _res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const files = req.files;
        if (!files)
            return next();
        if (files.banner && files.banner[0]) {
            req.body.coverImage = yield (0, exports.uploadToStorage)(files.banner[0], "banners");
        }
        next();
    }
    catch (error) {
        next(error);
    }
});
exports.processUploads = processUploads;
