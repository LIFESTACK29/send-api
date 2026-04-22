import * as admin from "firebase-admin";
import * as path from "path";
import User from "../models/user.model";

// Initialize Firebase Admin
const serviceAccountPath = path.resolve(
    process.cwd(),
    "src/config/firebase-service-account.json"
);

try {
    if (!admin.apps.length) {
        const fs = require("fs");
        const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, "utf8"));

        if (serviceAccount.private_key) {
            // Replace escaped newlines with actual newlines
            serviceAccount.private_key = serviceAccount.private_key.replace(/\\n/g, "\n");
        }

        admin.initializeApp({
            credential: admin.credential.cert(serviceAccount),
        });
        console.log(`✅ Firebase Admin initialized for: ${serviceAccount.project_id}`);
    }
} catch (error) {
    console.error("❌ Error initializing Firebase Admin:", error);
}

/**
 * Send push notification to a specific user
 */
export const sendPushNotification = async (
    userId: string,
    payload: { title: string; body: string; data?: any }
) => {
    try {
        const user = await User.findById(userId);
        if (!user || !user.pushToken) {
            console.log(`[Notification] Skip: No push token for user ${userId}`);
            return;
        }

        const message = {
            token: user.pushToken,
            notification: {
                title: payload.title,
                body: payload.body,
            },
            data: payload.data ? 
                Object.fromEntries(
                    Object.entries(payload.data).map(([k, v]) => [k, String(v)])
                ) : {},
            android: {
                priority: "high" as const,
                notification: {
                    channelId: "default",
                    sound: "default",
                },
            },
            apns: {
                payload: {
                    aps: {
                        sound: "default",
                        badge: 1,
                    },
                },
            },
        };

        const response = await admin.messaging().send(message);
        console.log(`[Notification] Sent to ${userId}. Response: ${response}`);
        return response;
    } catch (error: any) {
        console.error(`[Notification] Error sending to ${userId}:`, error.message);
        if (error.code === "messaging/registration-token-not-registered") {
            console.warn(`[Notification] Token for ${userId} is invalid. Clearing it.`);
            await User.findByIdAndUpdate(userId, { $unset: { pushToken: "" } });
        }
    }
};

export default {
    sendPushNotification,
};
