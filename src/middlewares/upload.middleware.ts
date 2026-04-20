import {
    S3Client,
    PutObjectCommand,
    DeleteObjectCommand,
} from "@aws-sdk/client-s3";
import { Request, Response, NextFunction } from "express";
import multer from "multer";
import crypto from "crypto";
import path from "path";

// Scaleway Object Storage configuration
const s3 = new S3Client({
    region: process.env.SCALEWAY_REGION || process.env.SCW_REGION || "fr-par",
    endpoint: `https://s3.${process.env.SCALEWAY_REGION || process.env.SCW_REGION || "fr-par"}.scw.cloud`,
    credentials: {
        accessKeyId: process.env.SCALEWAY_ACCESS_KEY || process.env.SCW_ACCESS_KEY || "",
        secretAccessKey: process.env.SCALEWAY_SECRET_KEY || process.env.SCW_SECRET_KEY || "",
    },
});

const BUCKET = process.env.SCALEWAY_BUCKET_NAME || process.env.SCW_BUCKET_NAME || "raha";
const PUBLIC_URL = process.env.SCALEWAY_PUBLIC_URL || process.env.SCW_PUBLIC_URL || "";

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
            ACL: "public-read", // Ensure the file is publicly readable on Scaleway
        }),
    );

    // If PUBLIC_URL is provided, use it, otherwise use the default Scaleway URL
    const scwRegion = process.env.SCALEWAY_REGION || process.env.SCW_REGION || "fr-par";
    const baseUrl = PUBLIC_URL || `https://${BUCKET}.s3.${scwRegion}.scw.cloud`;
    return `${baseUrl}/${key}`;
};

export const deleteFromStorage = async (publicUrl: string): Promise<void> => {
    if (!publicUrl) return;
    
    // Extract key from URL
    const scwRegion = process.env.SCALEWAY_REGION || process.env.SCW_REGION || "fr-par";
    const baseUrl = PUBLIC_URL || `https://${BUCKET}.s3.${scwRegion}.scw.cloud`;
    const key = publicUrl.replace(`${baseUrl}/`, "");
    
    await s3.send(
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

        // Example: handle banner
        if (files.banner && files.banner[0]) {
            req.body.coverImage = await uploadToStorage(files.banner[0], "banners");
        }

        next();
    } catch (error) {
        next(error);
    }
};
