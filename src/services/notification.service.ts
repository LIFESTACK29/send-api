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

        if (serviceAccount) {
            admin.initializeApp({
                credential: admin.credential.cert(serviceAccount),
            });
        }
    }
} catch (error) {
}

/**
 * Send push notification to a specific user
 */
export const sendPushNotification = async (
    userId: string,
    payload: { title: string; body: string; data?: any }
) => {
    try {
        if (!admin.apps.length) return;

        const user = await User.findById(userId);
        if (!user || !user.pushToken) {
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
        return response;
    } catch (error: any) {
        if (error.code === "messaging/registration-token-not-registered") {
            await User.findByIdAndUpdate(userId, { $unset: { pushToken: "" } });
        }
    }
};

export default {
    sendPushNotification,
};
