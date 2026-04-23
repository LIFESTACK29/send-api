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
const document_model_1 = __importDefault(require("../models/document.model"));
const REQUIRED_DOCUMENT_TYPES = [
    "DRIVING_LICENSE",
    "GOVERNMENT_ID",
    "INSURANCE",
    "REGISTRATION",
];
const stageToNextStep = (stage) => {
    switch (stage) {
        case "email_pending":
            return "email_otp";
        case "profile_pending":
            return "profile_image";
        case "vehicle_pending":
            return "vehicle_details";
        case "documents_pending":
            return "documents";
        case "review_pending":
            return "submit_verification";
        case "pending_admin_approval":
            return "pending_admin_approval";
        case "approved":
            return "home";
        case "rejected":
            return "documents";
        default:
            return "profile_image";
    }
};
const stageToAccessStatus = (stage) => {
    if (stage === "approved")
        return "approved";
    if (stage === "email_pending")
        return "email_verification_required";
    if (stage === "pending_admin_approval")
        return "pending_admin_approval";
    return "onboarding_incomplete";
};
const mapVerificationStatus = (riderStatus) => {
    if (riderStatus === "active")
        return "approved";
    if (riderStatus === "pending_verification")
        return "pending";
    if (riderStatus === "rejected")
        return "rejected";
    return "not_submitted";
};
const toPercentage = (steps) => {
    const completed = steps.filter(Boolean).length;
    return Math.round((completed / steps.length) * 100);
};
const getRequiredFieldsForVehicleType = (vehicleType) => {
    switch (vehicleType) {
        case "BICYCLE":
            return ["color"];
        case "MOTORCYCLE":
            return ["color", "licensePlate"];
        case "TRICYCLE":
            return ["color", "licensePlate"];
        case "CAR":
            return ["brand", "model", "year", "color", "licensePlate"];
        default:
            return ["color"];
    }
};
const isVehicleDetailsComplete = (vehicle) => {
    const requiredFields = getRequiredFieldsForVehicleType(vehicle.vehicleType);
    return requiredFields.every((field) => Boolean(vehicle[field]));
};
const inferRiderStage = (params) => {
    const { user, hasVehicle, hasCompleteVehicleDetails, hasVehicleImage, hasAllRequiredDocuments, } = params;
    if (!user.isOnboarded)
        return "email_pending";
    if (user.riderStatus === "active")
        return "approved";
    if (user.riderStatus === "pending_verification")
        return "pending_admin_approval";
    if (user.riderStatus === "rejected")
        return "rejected";
    if (!user.profileImageUrl)
        return "profile_pending";
    if (!hasVehicle || !hasCompleteVehicleDetails || !hasVehicleImage)
        return "vehicle_pending";
    if (!hasAllRequiredDocuments)
        return "documents_pending";
    return "review_pending";
};
const syncUserOnboardingState = (userId) => __awaiter(void 0, void 0, void 0, function* () {
    const user = yield user_model_1.default.findById(userId);
    if (!user)
        return null;
    if (!user.isOnboarded) {
        user.onboardingStage = "email_pending";
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
    const [vehicles, documents] = yield Promise.all([
        vehicle_model_1.default.find({ userId }),
        document_model_1.default.find({ userId }).select("documentType"),
    ]);
    const hasVehicle = vehicles.length > 0;
    const hasCompleteVehicleDetails = hasVehicle &&
        vehicles.every((v) => isVehicleDetailsComplete(v));
    const hasVehicleImage = hasVehicle && vehicles.every((v) => Boolean(v.imageUrl));
    const uploadedDocumentTypes = new Set(documents.map((d) => d.documentType));
    const hasAllRequiredDocuments = REQUIRED_DOCUMENT_TYPES.every((docType) => uploadedDocumentTypes.has(docType));
    user.onboardingStage = inferRiderStage({
        user,
        hasVehicle,
        hasCompleteVehicleDetails,
        hasVehicleImage,
        hasAllRequiredDocuments,
    });
    user.verificationStatus = mapVerificationStatus(user.riderStatus);
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
            };
        }
        return {
            onboardingStage: hydratedUser.onboardingStage || "approved",
            verificationStatus: hydratedUser.verificationStatus || "approved",
            onboardingRequired: false,
            canAccessHome: true,
            accessStatus: "approved",
            nextStep: "home",
        };
    }
    const [vehicles, documents] = yield Promise.all([
        vehicle_model_1.default.find({ userId: hydratedUser._id }),
        document_model_1.default.find({ userId: hydratedUser._id }).select("documentType"),
    ]);
    const hasVehicle = vehicles.length > 0;
    const hasCompleteVehicleDetails = hasVehicle &&
        vehicles.every((v) => isVehicleDetailsComplete(v));
    const hasVehicleImage = hasVehicle && vehicles.every((v) => Boolean(v.imageUrl));
    const uploadedDocumentTypes = new Set(documents.map((d) => d.documentType));
    const hasAllRequiredDocuments = REQUIRED_DOCUMENT_TYPES.every((docType) => uploadedDocumentTypes.has(docType));
    const submittedForVerification = hydratedUser.riderStatus === "pending_verification" ||
        hydratedUser.riderStatus === "active";
    const onboardingProgress = {
        emailVerified: hydratedUser.isOnboarded,
        profileCompleted: Boolean(hydratedUser.profileImageUrl),
        vehicleSelected: hasVehicle,
        vehicleDetailsCompleted: hasCompleteVehicleDetails,
        vehicleImageUploaded: hasVehicleImage,
        documentsUploaded: hasAllRequiredDocuments,
        submittedForVerification,
    };
    const stage = hydratedUser.onboardingStage || "profile_pending";
    return {
        onboardingStage: stage,
        verificationStatus: hydratedUser.verificationStatus || "not_submitted",
        onboardingRequired: stage !== "approved",
        canAccessHome: stage === "approved",
        accessStatus: stageToAccessStatus(stage),
        nextStep: stageToNextStep(stage),
        riderStatus: hydratedUser.riderStatus,
        onboardingProgress,
        completionPercentage: stage === "pending_admin_approval" || stage === "approved"
            ? 100
            : toPercentage(Object.values(onboardingProgress)),
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
