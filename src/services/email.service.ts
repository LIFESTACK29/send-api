import nodemailer from "nodemailer";

const transport = nodemailer.createTransport({
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
export const sendOtpEmail = async (
    to: string,
    otpCode: string,
): Promise<void> => {
    try {
        await transport.sendMail({
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
    } catch (error) {
        console.error("❌ Failed to send OTP email:", error);
        throw new Error("Failed to send verification email");
    }
};
