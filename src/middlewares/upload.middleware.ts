import {
    S3Client,
    PutObjectCommand,
    DeleteObjectCommand,
} from "@aws-sdk/client-s3";
import { Request, Response, NextFunction } from "express";
import multer from "multer";
import crypto from "crypto";
import path from "path";

const r2 = new S3Client({
    region: "auto",
    endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
        accessKeyId: process.env.R2_ACCESS_KEY_ID || "",
        secretAccessKey: process.env.R2_SECRET_ACCESS_KEY || "",
    },
});

const BUCKET = process.env.R2_BUCKET_NAME || "afrikets";
const PUBLIC_URL = process.env.R2_PUBLIC_URL || "";

const storage = multer.memoryStorage();

const fileFilter = (
    _req: Request,
    file: Express.Multer.File,
    cb: multer.FileFilterCallback,
) => {
    const allowed = ["image/jpeg", "image/png", "image/webp", "image/gif"];
    if (allowed.includes(file.mimetype)) {
        cb(null, true);
    } else {
        cb(new Error(`Unsupported file type: ${file.mimetype}`));
    }
};

export const upload = multer({
    storage,
    fileFilter,
    limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB
});

export const uploadToR2 = async (
    file: Express.Multer.File,
    folder: string = "events",
): Promise<string> => {
    const ext = path.extname(file.originalname) || ".jpg";
    const key = `${folder}/${crypto.randomUUID()}${ext}`;

    await r2.send(
        new PutObjectCommand({
            Bucket: BUCKET,
            Key: key,
            Body: file.buffer,
            ContentType: file.mimetype,
        }),
    );

    return `${PUBLIC_URL}/${key}`;
};

export const deleteFromR2 = async (publicUrl: string): Promise<void> => {
    if (!publicUrl || !PUBLIC_URL) return;
    const key = publicUrl.replace(`${PUBLIC_URL}/`, "");
    await r2.send(
        new DeleteObjectCommand({
            Bucket: BUCKET,
            Key: key,
        }),
    );
};

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

        // Upload banner
        if (files.banner && files.banner[0]) {
            req.body.coverImage = await uploadToR2(files.banner[0], "banners");
        }

        // Upload gallery images
        if (files.gallery && files.gallery.length > 0) {
            const urls = await Promise.all(
                files.gallery.map((f) => uploadToR2(f, "gallery")),
            );
            req.body.gallery = urls;
        }

        next();
    } catch (error) {
        next(error);
    }
};
