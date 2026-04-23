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
exports.getUserAccessState = exports.getRiderOnboardingState = void 0;
const user_model_1 = __importDefault(require("../models/user.model"));
const vehicle_model_1 = __importDefault(require("../models/vehicle.model"));
const document_model_1 = __importDefault(require("../models/document.model"));
const REQUIRED_DOCUMENT_TYPES = [
    "DRIVING_LICENSE",
    "GOVERNMENT_ID",
    "INSURANCE",
    "REGISTRATION",
];
const toPercentage = (steps) => {
    const completed = steps.filter(Boolean).length;
    return Math.round((completed / steps.length) * 100);
};
const buildRiderOnboardingStateFromData = (params) => {
    const { isOnboarded, riderStatus, hasProfileImage, hasVehicle, hasCompleteVehicleDetails, hasVehicleImage, hasAllRequiredDocuments, } = params;
    const submittedForVerification = riderStatus === "pending_verification" || riderStatus === "active";
    const onboardingProgress = {
        emailVerified: isOnboarded,
        profileCompleted: hasProfileImage,
        vehicleSelected: hasVehicle,
        vehicleDetailsCompleted: hasCompleteVehicleDetails,
        vehicleImageUploaded: hasVehicleImage,
        documentsUploaded: hasAllRequiredDocuments,
        submittedForVerification,
    };
    if (!isOnboarded) {
        return {
            onboardingRequired: true,
            canAccessHome: false,
            accessStatus: "email_verification_required",
            nextStep: "email_otp",
            riderStatus,
            onboardingProgress,
            completionPercentage: toPercentage(Object.values(onboardingProgress)),
        };
    }
    if (riderStatus === "active") {
        return {
            onboardingRequired: false,
            canAccessHome: true,
            accessStatus: "approved",
            nextStep: "home",
            riderStatus,
            onboardingProgress,
            completionPercentage: 100,
        };
    }
    if (riderStatus === "pending_verification") {
        return {
            onboardingRequired: true,
            canAccessHome: false,
            accessStatus: "pending_admin_approval",
            nextStep: "pending_admin_approval",
            riderStatus,
            onboardingProgress,
            completionPercentage: 100,
        };
    }
    if (!hasProfileImage) {
        return {
            onboardingRequired: true,
            canAccessHome: false,
            accessStatus: "onboarding_incomplete",
            nextStep: "profile_image",
            riderStatus,
            onboardingProgress,
            completionPercentage: toPercentage(Object.values(onboardingProgress)),
        };
    }
    if (!hasVehicle) {
        return {
            onboardingRequired: true,
            canAccessHome: false,
            accessStatus: "onboarding_incomplete",
            nextStep: "vehicle_type",
            riderStatus,
            onboardingProgress,
            completionPercentage: toPercentage(Object.values(onboardingProgress)),
        };
    }
    if (!hasCompleteVehicleDetails) {
        return {
            onboardingRequired: true,
            canAccessHome: false,
            accessStatus: "onboarding_incomplete",
            nextStep: "vehicle_details",
            riderStatus,
            onboardingProgress,
            completionPercentage: toPercentage(Object.values(onboardingProgress)),
        };
    }
    if (!hasVehicleImage) {
        return {
            onboardingRequired: true,
            canAccessHome: false,
            accessStatus: "onboarding_incomplete",
            nextStep: "vehicle_image",
            riderStatus,
            onboardingProgress,
            completionPercentage: toPercentage(Object.values(onboardingProgress)),
        };
    }
    if (!hasAllRequiredDocuments) {
        return {
            onboardingRequired: true,
            canAccessHome: false,
            accessStatus: "onboarding_incomplete",
            nextStep: "documents",
            riderStatus,
            onboardingProgress,
            completionPercentage: toPercentage(Object.values(onboardingProgress)),
        };
    }
    return {
        onboardingRequired: true,
        canAccessHome: false,
        accessStatus: "onboarding_incomplete",
        nextStep: "submit_verification",
        riderStatus,
        onboardingProgress,
        completionPercentage: toPercentage(Object.values(onboardingProgress)),
    };
};
const getRiderOnboardingState = (userId) => __awaiter(void 0, void 0, void 0, function* () {
    const user = yield user_model_1.default.findById(userId).select("isOnboarded role riderStatus profileImageUrl");
    if (!user || user.role !== "rider") {
        throw new Error("Rider not found");
    }
    const [vehicles, documents] = yield Promise.all([
        vehicle_model_1.default.find({ userId }),
        document_model_1.default.find({ userId }).select("documentType"),
    ]);
    const hasVehicle = vehicles.length > 0;
    const hasCompleteVehicleDetails = hasVehicle &&
        vehicles.every((v) => Boolean(v.brand && v.get("model") && v.year && v.color && v.licensePlate));
    const hasVehicleImage = hasVehicle && vehicles.every((v) => Boolean(v.imageUrl));
    const uploadedDocumentTypes = new Set(documents.map((d) => d.documentType));
    const hasAllRequiredDocuments = REQUIRED_DOCUMENT_TYPES.every((docType) => uploadedDocumentTypes.has(docType));
    return buildRiderOnboardingStateFromData({
        isOnboarded: user.isOnboarded,
        riderStatus: user.riderStatus,
        hasProfileImage: Boolean(user.profileImageUrl),
        hasVehicle,
        hasCompleteVehicleDetails,
        hasVehicleImage,
        hasAllRequiredDocuments,
    });
});
exports.getRiderOnboardingState = getRiderOnboardingState;
const getUserAccessState = (user) => __awaiter(void 0, void 0, void 0, function* () {
    if (!user.isOnboarded) {
        return {
            onboardingRequired: true,
            canAccessHome: false,
            accessStatus: "email_verification_required",
            nextStep: "email_otp",
            riderStatus: user.riderStatus,
        };
    }
    if (user.role !== "rider") {
        return {
            onboardingRequired: false,
            canAccessHome: true,
            accessStatus: "approved",
            nextStep: "home",
        };
    }
    return (0, exports.getRiderOnboardingState)(user._id.toString());
});
exports.getUserAccessState = getUserAccessState;
