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
exports.sendOtpEmail = void 0;
const nodemailer_1 = __importDefault(require("nodemailer"));
const transport = nodemailer_1.default.createTransport({
    host: "sandbox.smtp.mailtrap.io",
    port: 2525,
    auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASSWORD,
    },
});
/**
 * Send OTP verification email
 */
const sendOtpEmail = (to, otpCode) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        yield transport.sendMail({
            from: '"RahaSend" <noreply@rahasend.com>',
            to,
            subject: "Your RahaSend Verification Code",
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 32px;">
                    <h2 style="color: #1a1a1a; margin-bottom: 8px;">Verify your email</h2>
                    <p style="color: #555; font-size: 15px;">
                        Use the code below to complete your registration. It expires in <strong>5 minutes</strong>.
                    </p>
                    <div style="background: #f4f4f5; border-radius: 8px; padding: 24px; text-align: center; margin: 24px 0;">
                        <span style="font-size: 32px; font-weight: 700; letter-spacing: 8px; color: #111;">
                            ${otpCode}
                        </span>
                    </div>
                    <p style="color: #888; font-size: 13px;">
                        If you did not request this, you can safely ignore this email.
                    </p>
                </div>
            `,
        });
        console.log(`✅ OTP email sent to ${to}`);
    }
    catch (error) {
        console.error("❌ Failed to send OTP email:", error);
        throw new Error("Failed to send verification email");
    }
});
exports.sendOtpEmail = sendOtpEmail;
