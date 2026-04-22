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
exports.processUploads = exports.deleteFromStorage = exports.uploadToStorage = exports.upload = void 0;
const client_s3_1 = require("@aws-sdk/client-s3");
const multer_1 = __importDefault(require("multer"));
const crypto_1 = __importDefault(require("crypto"));
const path_1 = __importDefault(require("path"));
// Scaleway Object Storage configuration
const s3 = new client_s3_1.S3Client({
    region: process.env.SCALEWAY_REGION || process.env.SCW_REGION || "fr-par",
    endpoint: `https://s3.${process.env.SCALEWAY_REGION || process.env.SCW_REGION || "fr-par"}.scw.cloud`,
    credentials: {
        accessKeyId: process.env.SCALEWAY_ACCESS_KEY || process.env.SCW_ACCESS_KEY || "",
        secretAccessKey: process.env.SCALEWAY_SECRET_KEY || process.env.SCW_SECRET_KEY || "",
    },
});
const BUCKET = process.env.SCALEWAY_BUCKET_NAME || process.env.SCW_BUCKET_NAME || "raha";
const PUBLIC_URL = process.env.SCALEWAY_PUBLIC_URL || process.env.SCW_PUBLIC_URL || "";
const storage = multer_1.default.memoryStorage();
const fileFilter = (_req, file, cb) => {
    const allowed = ["image/jpeg", "image/png", "image/webp", "image/gif"];
    if (allowed.includes(file.mimetype)) {
        cb(null, true);
    }
    else {
        cb(new Error(`Unsupported file type: ${file.mimetype}`));
    }
};
exports.upload = (0, multer_1.default)({
    storage,
    fileFilter,
    limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB
});
const uploadToStorage = (file_1, ...args_1) => __awaiter(void 0, [file_1, ...args_1], void 0, function* (file, folder = "general") {
    const ext = path_1.default.extname(file.originalname) || ".jpg";
    const key = `${folder}/${crypto_1.default.randomUUID()}${ext}`;
    yield s3.send(new client_s3_1.PutObjectCommand({
        Bucket: BUCKET,
        Key: key,
        Body: file.buffer,
        ContentType: file.mimetype,
        ACL: "public-read", // Ensure the file is publicly readable on Scaleway
    }));
    // If PUBLIC_URL is provided, use it, otherwise use the default Scaleway URL
    const scwRegion = process.env.SCALEWAY_REGION || process.env.SCW_REGION || "fr-par";
    const baseUrl = PUBLIC_URL || `https://${BUCKET}.s3.${scwRegion}.scw.cloud`;
    return `${baseUrl}/${key}`;
});
exports.uploadToStorage = uploadToStorage;
const deleteFromStorage = (publicUrl) => __awaiter(void 0, void 0, void 0, function* () {
    if (!publicUrl)
        return;
    // Extract key from URL
    const scwRegion = process.env.SCALEWAY_REGION || process.env.SCW_REGION || "fr-par";
    const baseUrl = PUBLIC_URL || `https://${BUCKET}.s3.${scwRegion}.scw.cloud`;
    const key = publicUrl.replace(`${baseUrl}/`, "");
    yield s3.send(new client_s3_1.DeleteObjectCommand({
        Bucket: BUCKET,
        Key: key,
    }));
});
exports.deleteFromStorage = deleteFromStorage;
const processUploads = (req, _res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const files = req.files;
        if (!files)
            return next();
        // Example: handle banner
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
