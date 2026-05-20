import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

/**
 * Send OTP verification email
 */
export const sendOtpEmail = async (
    to: string,
    otpCode: string,
): Promise<void> => {
    try {
        await resend.emails.send({
            from: "RahaSend <noreply@rahasend.com>",
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
    } catch (error) {
        console.error("❌ Failed to send OTP email:", error);
        throw new Error("Failed to send verification email");
    }
};
