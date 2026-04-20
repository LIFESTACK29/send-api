import { Request } from "express";

export interface AuthPayload {
    userId: string;
    role: string;
}

export interface AuthRequest extends Request {
    user?: AuthPayload;
}
