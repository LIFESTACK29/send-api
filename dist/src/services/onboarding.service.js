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
exports.getRiderOnboardingState = exports.getUserAccessState = exports.syncUserOnboardingState = exports.getSettingsDocumentCompliance = void 0;
const user_model_1 = __importDefault(require("../models/user.model"));
const vehicle_model_1 = __importDefault(require("../models/vehicle.model"));
const document_model_1 = __importDefault(require("../models/document.model"));
const REQUIRED_DOCUMENT_TYPES = [
    "DRIVING_LICENSE",
    "GOVERNMENT_ID",
    "INSURANCE",
    "REGISTRATION",
];
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
const toPercentage = (steps) => {
    const completed = steps.filter(Boolean).length;
    return Math.round((completed / steps.length) * 100);
};
const mapVerificationStatus = (riderStatus, existingStatus) => {
    if (riderStatus === "active")
        return "approved";
    if (riderStatus === "pending_verification")
        return "pending";
    if (riderStatus === "rejected")
        return "rejected";
    if (existingStatus === "approved")
        return "approved";
    return "not_submitted";
};
const inferRiderStage = (params) => {
    const { user, hasVehicle, hasCompleteVehicleDetails, hasVehicleImage } = params;
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
    return "review_pending";
};
const getSettingsDocumentCompliance = (userId) => __awaiter(void 0, void 0, void 0, function* () {
    const documents = yield document_model_1.default.find({ userId }).select("documentType");
    const uploadedDocumentTypes = new Set(documents.map((d) => d.documentType));
    const missingDocuments = REQUIRED_DOCUMENT_TYPES.filter((docType) => !uploadedDocumentTypes.has(docType));
    return {
        documentsUploaded: missingDocuments.length === 0,
        missingDocuments,
    };
});
exports.getSettingsDocumentCompliance = getSettingsDocumentCompliance;
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
    const [vehicles, docsCompliance] = yield Promise.all([
        vehicle_model_1.default.find({ userId }),
        (0, exports.getSettingsDocumentCompliance)(userId),
    ]);
    const hasVehicle = vehicles.length > 0;
    const hasCompleteVehicleDetails = hasVehicle && vehicles.every((v) => isVehicleDetailsComplete(v));
    const hasVehicleImage = hasVehicle && vehicles.every((v) => Boolean(v.imageUrl));
    if (user.riderStatus === "incomplete") {
        user.riderStatus = "inactive";
    }
    if (user.riderStatus === "active" && !docsCompliance.documentsUploaded) {
        user.riderStatus = "inactive";
    }
    if (user.riderStatus === "inactive" &&
        user.verificationStatus === "approved" &&
        docsCompliance.documentsUploaded &&
        user.isOnboarded) {
        user.riderStatus = "active";
    }
    const inferredStage = inferRiderStage({
        user,
        hasVehicle,
        hasCompleteVehicleDetails,
        hasVehicleImage,
    });
    user.onboardingStage =
        inferredStage === "documents_pending" ? "review_pending" : inferredStage;
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
    const [vehicles, docsCompliance] = yield Promise.all([
        vehicle_model_1.default.find({ userId: hydratedUser._id }),
        (0, exports.getSettingsDocumentCompliance)(hydratedUser._id.toString()),
    ]);
    const hasVehicle = vehicles.length > 0;
    const hasCompleteVehicleDetails = hasVehicle && vehicles.every((v) => isVehicleDetailsComplete(v));
    const hasVehicleImage = hasVehicle && vehicles.every((v) => Boolean(v.imageUrl));
    const submittedForVerification = hydratedUser.riderStatus === "pending_verification" ||
        hydratedUser.riderStatus === "active";
    const onboardingProgress = {
        emailVerified: hydratedUser.isOnboarded,
        profileCompleted: Boolean(hydratedUser.profileImageUrl),
        vehicleSelected: hasVehicle,
        vehicleDetailsCompleted: hasCompleteVehicleDetails,
        vehicleImageUploaded: hasVehicleImage,
        submittedForVerification,
    };
    const stage = hydratedUser.onboardingStage === "documents_pending"
        ? "review_pending"
        : hydratedUser.onboardingStage || "profile_pending";
    const onboardingComplete = stage === "approved" ||
        stage === "pending_admin_approval" ||
        stage === "rejected";
    if (!onboardingComplete) {
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
                    : stage === "vehicle_pending"
                        ? "vehicle_details"
                        : "submit_verification",
            riderStatus: hydratedUser.riderStatus,
            onboardingProgress,
            settingsChecks: docsCompliance,
            completionPercentage: toPercentage(Object.values(onboardingProgress)),
        };
    }
    if (stage === "pending_admin_approval") {
        return {
            onboardingStage: stage,
            verificationStatus: hydratedUser.verificationStatus || "pending",
            onboardingRequired: false,
            canAccessHome: false,
            accessStatus: "pending_admin_approval",
            nextStep: "pending_admin_approval",
            riderStatus: hydratedUser.riderStatus,
            onboardingProgress,
            settingsChecks: docsCompliance,
            completionPercentage: 100,
        };
    }
    if (!docsCompliance.documentsUploaded || hydratedUser.riderStatus !== "active") {
        return {
            onboardingStage: stage === "approved" ? "approved" : stage,
            verificationStatus: hydratedUser.verificationStatus || "not_submitted",
            onboardingRequired: false,
            canAccessHome: false,
            accessStatus: "settings_incomplete",
            nextStep: "settings_documents",
            riderStatus: hydratedUser.riderStatus,
            onboardingProgress,
            settingsChecks: docsCompliance,
            completionPercentage: 100,
        };
    }
    return {
        onboardingStage: "approved",
        verificationStatus: hydratedUser.verificationStatus || "approved",
        onboardingRequired: false,
        canAccessHome: true,
        accessStatus: "approved",
        nextStep: "home",
        riderStatus: hydratedUser.riderStatus,
        onboardingProgress,
        settingsChecks: docsCompliance,
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
