import { Request } from "express";

export interface AuthPayload {
    userId: string;
    role: string;
    jti?: string;
    exp?: number;
}

export interface AuthRequest extends Request {
    user?: AuthPayload;
}
