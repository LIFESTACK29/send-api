import User, { IUser } from "../models/user.model";
import Vehicle from "../models/vehicle.model";
import Document from "../models/document.model";

const REQUIRED_DOCUMENT_TYPES = [
    "DRIVING_LICENSE",
    "GOVERNMENT_ID",
    "INSURANCE",
    "REGISTRATION",
] as const;

export type OnboardingStage =
    | "email_pending"
    | "profile_pending"
    | "vehicle_pending"
    | "documents_pending"
    | "review_pending"
    | "pending_admin_approval"
    | "approved"
    | "rejected";

type OnboardingNextStep =
    | "email_otp"
    | "profile_image"
    | "vehicle_details"
    | "documents"
    | "submit_verification"
    | "pending_admin_approval"
    | "home";

type AccessStatus =
    | "email_verification_required"
    | "onboarding_incomplete"
    | "pending_admin_approval"
    | "approved";

export interface UserAccessState {
    onboardingStage: OnboardingStage;
    verificationStatus: IUser["verificationStatus"];
    onboardingRequired: boolean;
    canAccessHome: boolean;
    accessStatus: AccessStatus;
    nextStep: OnboardingNextStep;
    riderStatus?: IUser["riderStatus"];
    onboardingProgress?: {
        emailVerified: boolean;
        profileCompleted: boolean;
        vehicleSelected: boolean;
        vehicleDetailsCompleted: boolean;
        vehicleImageUploaded: boolean;
        documentsUploaded: boolean;
        submittedForVerification: boolean;
    };
    completionPercentage?: number;
}

const stageToNextStep = (stage: OnboardingStage): OnboardingNextStep => {
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

const stageToAccessStatus = (stage: OnboardingStage): AccessStatus => {
    if (stage === "approved") return "approved";
    if (stage === "email_pending") return "email_verification_required";
    if (stage === "pending_admin_approval") return "pending_admin_approval";
    return "onboarding_incomplete";
};

const mapVerificationStatus = (riderStatus?: IUser["riderStatus"]) => {
    if (riderStatus === "active") return "approved" as const;
    if (riderStatus === "pending_verification") return "pending" as const;
    if (riderStatus === "rejected") return "rejected" as const;
    return "not_submitted" as const;
};

const toPercentage = (steps: boolean[]): number => {
    const completed = steps.filter(Boolean).length;
    return Math.round((completed / steps.length) * 100);
};

const getRequiredFieldsForVehicleType = (vehicleType: string): string[] => {
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

const isVehicleDetailsComplete = (vehicle: any): boolean => {
    const requiredFields = getRequiredFieldsForVehicleType(vehicle.vehicleType);
    return requiredFields.every((field) => Boolean(vehicle[field]));
};

const inferRiderStage = (params: {
    user: IUser;
    hasVehicle: boolean;
    hasCompleteVehicleDetails: boolean;
    hasVehicleImage: boolean;
    hasAllRequiredDocuments: boolean;
}): OnboardingStage => {
    const {
        user,
        hasVehicle,
        hasCompleteVehicleDetails,
        hasVehicleImage,
        hasAllRequiredDocuments,
    } = params;

    if (!user.isOnboarded) return "email_pending";
    if (user.riderStatus === "active") return "approved";
    if (user.riderStatus === "pending_verification")
        return "pending_admin_approval";
    if (user.riderStatus === "rejected") return "rejected";
    if (!user.profileImageUrl) return "profile_pending";
    if (!hasVehicle || !hasCompleteVehicleDetails || !hasVehicleImage)
        return "vehicle_pending";
    if (!hasAllRequiredDocuments) return "documents_pending";
    return "review_pending";
};

export const syncUserOnboardingState = async (
    userId: string,
): Promise<IUser | null> => {
    const user = await User.findById(userId);
    if (!user) return null;

    if (!user.isOnboarded) {
        user.onboardingStage = "email_pending";
        user.verificationStatus = "not_submitted";
        await user.save();
        return user;
    }

    if (user.role !== "rider") {
        user.onboardingStage = "approved";
        user.verificationStatus = "approved";
        await user.save();
        return user;
    }

    const [vehicles, documents] = await Promise.all([
        Vehicle.find({ userId }),
        Document.find({ userId }).select("documentType"),
    ]);

    const hasVehicle = vehicles.length > 0;
    const hasCompleteVehicleDetails =
        hasVehicle &&
        vehicles.every((v) => isVehicleDetailsComplete(v));
    const hasVehicleImage = hasVehicle && vehicles.every((v) => Boolean(v.imageUrl));

    const uploadedDocumentTypes = new Set(documents.map((d) => d.documentType));
    const hasAllRequiredDocuments = REQUIRED_DOCUMENT_TYPES.every((docType) =>
        uploadedDocumentTypes.has(docType),
    );

    user.onboardingStage = inferRiderStage({
        user,
        hasVehicle,
        hasCompleteVehicleDetails,
        hasVehicleImage,
        hasAllRequiredDocuments,
    });
    user.verificationStatus = mapVerificationStatus(user.riderStatus);

    await user.save();
    return user;
};

export const getUserAccessState = async (user: IUser): Promise<UserAccessState> => {
    const hydratedUser =
        user.onboardingStage && user.verificationStatus
            ? user
            : await syncUserOnboardingState(user._id.toString());

    if (!hydratedUser) {
        throw new Error("User not found");
    }

    if (hydratedUser.role !== "rider") {
        if (!hydratedUser.isOnboarded) {
            return {
                onboardingStage: "email_pending",
                verificationStatus:
                    hydratedUser.verificationStatus || "not_submitted",
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

    const [vehicles, documents] = await Promise.all([
        Vehicle.find({ userId: hydratedUser._id }),
        Document.find({ userId: hydratedUser._id }).select("documentType"),
    ]);

    const hasVehicle = vehicles.length > 0;
    const hasCompleteVehicleDetails =
        hasVehicle &&
        vehicles.every((v) => isVehicleDetailsComplete(v));
    const hasVehicleImage = hasVehicle && vehicles.every((v) => Boolean(v.imageUrl));

    const uploadedDocumentTypes = new Set(documents.map((d) => d.documentType));
    const hasAllRequiredDocuments = REQUIRED_DOCUMENT_TYPES.every((docType) =>
        uploadedDocumentTypes.has(docType),
    );

    const submittedForVerification =
        hydratedUser.riderStatus === "pending_verification" ||
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
        completionPercentage:
            stage === "pending_admin_approval" || stage === "approved"
                ? 100
                : toPercentage(Object.values(onboardingProgress)),
    };
};

export const getRiderOnboardingState = async (userId: string) => {
    const user = await syncUserOnboardingState(userId);
    if (!user || user.role !== "rider") {
        throw new Error("Rider not found");
    }

    return getUserAccessState(user);
};
