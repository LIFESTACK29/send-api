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
exports.processUploads = exports.deleteFromR2 = exports.uploadToR2 = exports.upload = void 0;
const client_s3_1 = require("@aws-sdk/client-s3");
const multer_1 = __importDefault(require("multer"));
const crypto_1 = __importDefault(require("crypto"));
const path_1 = __importDefault(require("path"));
/* ─── R2 Client ─── */
const r2 = new client_s3_1.S3Client({
    region: "auto",
    endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
        accessKeyId: process.env.R2_ACCESS_KEY_ID || "",
        secretAccessKey: process.env.R2_SECRET_ACCESS_KEY || "",
    },
});
const BUCKET = process.env.R2_BUCKET_NAME || "afrikets";
const PUBLIC_URL = process.env.R2_PUBLIC_URL || ""; // e.g. https://cdn.afrikets.com
/* ─── Multer (memory storage — files stay in RAM, never touch disk) ─── */
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
/* ─── Upload a single file buffer to R2 ─── */
const uploadToR2 = (file_1, ...args_1) => __awaiter(void 0, [file_1, ...args_1], void 0, function* (file, folder = "events") {
    const ext = path_1.default.extname(file.originalname) || ".jpg";
    const key = `${folder}/${crypto_1.default.randomUUID()}${ext}`;
    yield r2.send(new client_s3_1.PutObjectCommand({
        Bucket: BUCKET,
        Key: key,
        Body: file.buffer,
        ContentType: file.mimetype,
    }));
    return `${PUBLIC_URL}/${key}`;
});
exports.uploadToR2 = uploadToR2;
/* ─── Delete a file from R2 by its public URL ─── */
const deleteFromR2 = (publicUrl) => __awaiter(void 0, void 0, void 0, function* () {
    if (!publicUrl || !PUBLIC_URL)
        return;
    const key = publicUrl.replace(`${PUBLIC_URL}/`, "");
    yield r2.send(new client_s3_1.DeleteObjectCommand({
        Bucket: BUCKET,
        Key: key,
    }));
});
exports.deleteFromR2 = deleteFromR2;
/* ─── Express middleware: upload files and attach URLs to req.body ─── */
const processUploads = (req, _res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const files = req.files;
        if (!files)
            return next();
        // Upload banner
        if (files.banner && files.banner[0]) {
            req.body.coverImage = yield (0, exports.uploadToR2)(files.banner[0], "banners");
        }
        // Upload gallery images
        if (files.gallery && files.gallery.length > 0) {
            const urls = yield Promise.all(files.gallery.map((f) => (0, exports.uploadToR2)(f, "gallery")));
            req.body.gallery = urls;
        }
        next();
    }
    catch (error) {
        next(error);
    }
});
exports.processUploads = processUploads;
