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
exports.onboardUser = exports.getAuthStatus = void 0;
const user_model_1 = __importDefault(require("../models/user.model"));
const getAuthStatus = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { clerkId } = req.params;
        if (!clerkId) {
            res.status(400).json({ message: "Clerk ID is required" });
            return;
        }
        const user = yield user_model_1.default.findOne({ clerkId });
        if (!user) {
            res.status(200).json({ exists: false });
            return;
        }
        res.status(200).json({
            exists: true,
            user: {
                role: user.role,
                isOnboarded: user.isOnboarded,
            },
        });
        return;
    }
    catch (error) {
        console.error("Error in getAuthStatus:", error);
        res.status(500).json({ message: "Internal server error" });
        return;
    }
});
exports.getAuthStatus = getAuthStatus;
const onboardUser = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { clerkId, email, fullName, phoneNumber, role } = req.body;
        if (!clerkId || !email || !role) {
            res.status(400).json({ message: "Missing required fields" });
            return;
        }
        let user = yield user_model_1.default.findOne({ clerkId });
        if (user) {
            user.fullName = fullName || user.fullName;
            user.phoneNumber = phoneNumber || user.phoneNumber;
            user.role = role;
            user.isOnboarded = true;
            yield user.save();
        }
        else {
            user = yield user_model_1.default.create({
                clerkId,
                email,
                fullName,
                phoneNumber,
                role,
                isOnboarded: true,
            });
        }
        res.status(201).json({
            message: "User onboarded successfully",
            user: {
                role: user.role,
                isOnboarded: user.isOnboarded,
            },
        });
        return;
    }
    catch (error) {
        console.error("Error in onboardUser:", error);
        res.status(500).json({ message: "Internal server error" });
        return;
    }
});
exports.onboardUser = onboardUser;
