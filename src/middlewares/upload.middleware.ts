import {
    S3Client,
    PutObjectCommand,
    DeleteObjectCommand,
    GetObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { Request, Response, NextFunction } from "express";
import multer from "multer";
import crypto from "crypto";
import path from "path";

const s3 = new S3Client({
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
const MAGIC: Array<{ mime: string; bytes: number[]; offset?: number }> = [
    { mime: "image/jpeg", bytes: [0xff, 0xd8, 0xff] },
    { mime: "image/png",  bytes: [0x89, 0x50, 0x4e, 0x47] },
    { mime: "image/gif",  bytes: [0x47, 0x49, 0x46, 0x38] },
    // WebP: "RIFF" at 0 and "WEBP" at offset 8
    { mime: "image/webp", bytes: [0x52, 0x49, 0x46, 0x46] },
];
const ALLOWED_MIMES = MAGIC.map((m) => m.mime);

function detectMime(buf: Buffer): string | null {
    for (const sig of MAGIC) {
        const slice = buf.slice(sig.offset ?? 0, (sig.offset ?? 0) + sig.bytes.length);
        if (sig.bytes.every((b, i) => slice[i] === b)) {
            if (sig.mime === "image/webp") {
                // Also verify "WEBP" at offset 8
                if (buf.slice(8, 12).toString("ascii") !== "WEBP") continue;
            }
            return sig.mime;
        }
    }
    return null;
}

// ─── Multer setup (MIME filter is content-type only — magic check comes after) ─
const storage = multer.memoryStorage();

const fileFilter = (
    _req: Request,
    file: Express.Multer.File,
    cb: multer.FileFilterCallback,
) => {
    // Allow declared image types through — actual content verified in validateFileType
    if (ALLOWED_MIMES.includes(file.mimetype)) {
        cb(null, true);
    } else {
        cb(new Error(`File type not permitted: ${file.mimetype}`));
    }
};

export const upload = multer({
    storage,
    fileFilter,
    limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB
});

// ─── Post-multer magic-byte validation ───────────────────────────────────────
// Use this middleware immediately after upload.single() / upload.fields() in
// every route that accepts file uploads.
export const validateFileType = (
    req: Request,
    _res: Response,
    next: NextFunction,
): void => {
    if (!req.file) return next();

    const detected = detectMime(req.file.buffer);
    if (!detected || !ALLOWED_MIMES.includes(detected)) {
        next(
            Object.assign(new Error("Invalid file content — upload rejected"), {
                statusCode: 415,
            }),
        );
        return;
    }

    // Overwrite the client-supplied MIME with the verified value
    req.file.mimetype = detected;
    next();
};

// ─── Upload to private S3 storage ────────────────────────────────────────────
export const uploadToStorage = async (
    file: Express.Multer.File,
    folder: string = "general",
): Promise<string> => {
    const ext = path.extname(file.originalname) || ".jpg";
    const key = `${folder}/${crypto.randomUUID()}${ext}`;

    await s3.send(
        new PutObjectCommand({
            Bucket: BUCKET,
            Key: key,
            Body: file.buffer,
            ContentType: file.mimetype,
            // No ACL — files are private by default
        }),
    );

    // Return the key so callers can generate presigned URLs on demand
    return key;
};

// ─── Presigned URL generation (valid for 1 hour) ──────────────────────────────
const SIGNED_URL_TTL = 3600; // seconds

export const getStorageUrl = async (keyOrLegacyUrl: string): Promise<string> => {
    // Support legacy records that stored a full URL instead of a key
    const key = keyOrLegacyUrl.startsWith("https://")
        ? keyOrLegacyUrl.replace(`${BASE_URL}/`, "")
        : keyOrLegacyUrl;

    const command = new GetObjectCommand({ Bucket: BUCKET, Key: key });
    return getSignedUrl(s3, command, { expiresIn: SIGNED_URL_TTL });
};

// ─── Delete from storage ──────────────────────────────────────────────────────
export const deleteFromStorage = async (keyOrLegacyUrl: string): Promise<void> => {
    if (!keyOrLegacyUrl) return;

    const key = keyOrLegacyUrl.startsWith("https://")
        ? keyOrLegacyUrl.replace(`${BASE_URL}/`, "")
        : keyOrLegacyUrl;

    await s3.send(new DeleteObjectCommand({ Bucket: BUCKET, Key: key }));
};

// ─── Multipart upload helper (kept for backward compat) ──────────────────────
export const processUploads = async (
    req: Request,
    _res: Response,
    next: NextFunction,
) => {
    try {
        const files = req.files as
            | { [fieldname: string]: Express.Multer.File[] }
            | undefined;

        if (!files) return next();

        if (files.banner && files.banner[0]) {
            req.body.coverImage = await uploadToStorage(files.banner[0], "banners");
        }

        next();
    } catch (error) {
        next(error);
    }
};
