import * as admin from "firebase-admin";
import User from "../models/user.model";

const getFirebaseCredential = (): admin.ServiceAccount | null => {
    const projectId = process.env.FIREBASE_PROJECT_ID;
    const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
    const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n");

    if (!projectId || !clientEmail || !privateKey) {
        return null;
    }

    return {
        projectId,
        clientEmail,
        privateKey,
    };
};

try {
    if (!admin.apps.length) {
        const serviceAccount = getFirebaseCredential();

        if (!serviceAccount) {
            console.warn(
                "Firebase Admin not initialized: missing FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, or FIREBASE_PRIVATE_KEY in environment.",
            );
        } else {
            admin.initializeApp({
                credential: admin.credential.cert(serviceAccount),
            });
            console.log(
                `✅ Firebase Admin initialized for: ${serviceAccount.projectId}`,
            );
        }
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
        if (!admin.apps.length) {
            console.warn(
                `[Notification] Skip: Firebase Admin not initialized for user ${userId}`,
            );
            return;
        }

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
