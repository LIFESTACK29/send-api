"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
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
exports.sendPushNotification = void 0;
const admin = __importStar(require("firebase-admin"));
const user_model_1 = __importDefault(require("../models/user.model"));
const getFirebaseCredential = () => {
    var _a;
    const projectId = process.env.FIREBASE_PROJECT_ID;
    const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
    const privateKey = (_a = process.env.FIREBASE_PRIVATE_KEY) === null || _a === void 0 ? void 0 : _a.replace(/\\n/g, "\n");
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
            console.warn("Firebase Admin not initialized: missing FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, or FIREBASE_PRIVATE_KEY in environment.");
        }
        else {
            admin.initializeApp({
                credential: admin.credential.cert(serviceAccount),
            });
            console.log(`✅ Firebase Admin initialized for: ${serviceAccount.projectId}`);
        }
    }
}
catch (error) {
    console.error("❌ Error initializing Firebase Admin:", error);
}
/**
 * Send push notification to a specific user
 */
const sendPushNotification = (userId, payload) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        if (!admin.apps.length) {
            console.warn(`[Notification] Skip: Firebase Admin not initialized for user ${userId}`);
            return;
        }
        const user = yield user_model_1.default.findById(userId);
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
                Object.fromEntries(Object.entries(payload.data).map(([k, v]) => [k, String(v)])) : {},
            android: {
                priority: "high",
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
        const response = yield admin.messaging().send(message);
        console.log(`[Notification] Sent to ${userId}. Response: ${response}`);
        return response;
    }
    catch (error) {
        console.error(`[Notification] Error sending to ${userId}:`, error.message);
        if (error.code === "messaging/registration-token-not-registered") {
            console.warn(`[Notification] Token for ${userId} is invalid. Clearing it.`);
            yield user_model_1.default.findByIdAndUpdate(userId, { $unset: { pushToken: "" } });
        }
    }
});
exports.sendPushNotification = sendPushNotification;
exports.default = {
    sendPushNotification: exports.sendPushNotification,
};
