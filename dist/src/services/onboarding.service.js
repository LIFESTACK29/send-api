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
exports.getRiderOnboardingState = exports.getUserAccessState = exports.syncUserOnboardingState = void 0;
const user_model_1 = __importDefault(require("../models/user.model"));
const vehicle_model_1 = __importDefault(require("../models/vehicle.model"));
const wallet_service_1 = require("./wallet.service");
const toPercentage = (steps) => {
    const completed = steps.filter(Boolean).length;
    return Math.round((completed / steps.length) * 100);
};
const normalizeOnboardingStage = (stage) => {
    if (!stage)
        return "profile_pending";
    if (stage === "email_pending" ||
        stage === "profile_pending" ||
        stage === "vehicle_pending" ||
        stage === "approved" ||
        stage === "rejected") {
        return stage;
    }
    // Legacy stages now map to simplified onboarding.
    return "vehicle_pending";
};
const mapVerificationStatus = (riderStatus, existingStatus) => {
    if (riderStatus === "active")
        return "approved";
    if (riderStatus === "rejected")
        return "rejected";
    return "not_submitted";
};
const inferRiderStage = (params) => {
    const { user, hasVehicle } = params;
    if (!user.isOnboarded)
        return "email_pending";
    if (user.riderStatus === "rejected")
        return "rejected";
    if (!user.profileImageUrl)
        return "profile_pending";
    if (!hasVehicle)
        return "vehicle_pending";
    return "approved";
};
const syncUserOnboardingState = (userId) => __awaiter(void 0, void 0, void 0, function* () {
    const user = yield user_model_1.default.findById(userId);
    if (!user)
        return null;
    if (!user.isOnboarded) {
        user.onboardingStage = "email_pending";
        user.riderStatus = user.role === "rider" ? "inactive" : user.riderStatus;
        user.verificationStatus = "not_submitted";
        yield user.save();
        return user;
    }
    if (user.role !== "rider") {
        user.onboardingStage = "approved";
        user.verificationStatus = "approved";
        yield user.save();
        return user;
    }
    const vehicles = yield vehicle_model_1.default.find({ userId });
    const hasVehicle = vehicles.length > 0;
    const isComplete = Boolean(user.profileImageUrl) && hasVehicle;
    const inferredStage = inferRiderStage({
        user,
        hasVehicle,
    });
    if (isComplete && user.riderStatus !== "rejected") {
        user.riderStatus = "active";
        yield (0, wallet_service_1.ensureWalletForUser)(userId);
    }
    else if (user.riderStatus !== "rejected") {
        user.riderStatus = "inactive";
    }
    user.onboardingStage = inferredStage;
    user.verificationStatus = mapVerificationStatus(user.riderStatus, user.verificationStatus);
    yield user.save();
    return user;
});
exports.syncUserOnboardingState = syncUserOnboardingState;
const getUserAccessState = (user) => __awaiter(void 0, void 0, void 0, function* () {
    const hydratedUser = user.onboardingStage && user.verificationStatus
        ? user
        : yield (0, exports.syncUserOnboardingState)(user._id.toString());
    if (!hydratedUser) {
        throw new Error("User not found");
    }
    if (hydratedUser.role !== "rider") {
        if (!hydratedUser.isOnboarded) {
            return {
                onboardingStage: "email_pending",
                verificationStatus: hydratedUser.verificationStatus || "not_submitted",
                onboardingRequired: true,
                canAccessHome: false,
                accessStatus: "email_verification_required",
                nextStep: "email_otp",
                currentStep: "email_otp",
            };
        }
        return {
            onboardingStage: "approved",
            verificationStatus: hydratedUser.verificationStatus || "approved",
            onboardingRequired: false,
            canAccessHome: true,
            accessStatus: "approved",
            nextStep: "home",
            currentStep: "home",
        };
    }
    const vehicles = yield vehicle_model_1.default.find({ userId: hydratedUser._id });
    const hasVehicle = vehicles.length > 0;
    const onboardingProgress = {
        emailVerified: hydratedUser.isOnboarded,
        profileCompleted: Boolean(hydratedUser.profileImageUrl),
        vehicleSelected: hasVehicle,
    };
    const stage = normalizeOnboardingStage(hydratedUser.onboardingStage);
    const onboardingComplete = stage === "approved" || stage === "rejected";
    if (!onboardingComplete) {
        const currentStep = stage === "email_pending"
            ? "email_otp"
            : stage === "profile_pending"
                ? "profile_image"
                : "vehicle_selection";
        return {
            onboardingStage: stage,
            verificationStatus: hydratedUser.verificationStatus || "not_submitted",
            onboardingRequired: true,
            canAccessHome: false,
            accessStatus: stage === "email_pending"
                ? "email_verification_required"
                : "onboarding_incomplete",
            nextStep: stage === "email_pending"
                ? "email_otp"
                : stage === "profile_pending"
                    ? "profile_image"
                    : "vehicle_selection",
            currentStep,
            riderStatus: hydratedUser.riderStatus,
            onboardingProgress,
            completionPercentage: toPercentage(Object.values(onboardingProgress)),
        };
    }
    return {
        onboardingStage: "approved",
        verificationStatus: hydratedUser.verificationStatus || "approved",
        onboardingRequired: false,
        canAccessHome: true,
        accessStatus: "approved",
        nextStep: "home",
        currentStep: "home",
        riderStatus: hydratedUser.riderStatus,
        onboardingProgress,
        completionPercentage: 100,
    };
});
exports.getUserAccessState = getUserAccessState;
const getRiderOnboardingState = (userId) => __awaiter(void 0, void 0, void 0, function* () {
    const user = yield (0, exports.syncUserOnboardingState)(userId);
    if (!user || user.role !== "rider") {
        throw new Error("Rider not found");
    }
    return (0, exports.getUserAccessState)(user);
});
exports.getRiderOnboardingState = getRiderOnboardingState;
