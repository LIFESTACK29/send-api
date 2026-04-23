import User, { IUser } from "../models/user.model";
import Vehicle from "../models/vehicle.model";
import Document from "../models/document.model";

const REQUIRED_DOCUMENT_TYPES = [
    "DRIVING_LICENSE",
    "GOVERNMENT_ID",
    "INSURANCE",
    "REGISTRATION",
] as const;

type OnboardingNextStep =
    | "email_otp"
    | "profile_image"
    | "vehicle_type"
    | "vehicle_details"
    | "vehicle_image"
    | "documents"
    | "submit_verification"
    | "pending_admin_approval"
    | "home";

type AccessStatus =
    | "email_verification_required"
    | "onboarding_incomplete"
    | "pending_admin_approval"
    | "approved";

export interface RiderOnboardingState {
    onboardingRequired: boolean;
    canAccessHome: boolean;
    accessStatus: AccessStatus;
    nextStep: OnboardingNextStep;
    riderStatus: IUser["riderStatus"];
    onboardingProgress: {
        emailVerified: boolean;
        profileCompleted: boolean;
        vehicleSelected: boolean;
        vehicleDetailsCompleted: boolean;
        vehicleImageUploaded: boolean;
        documentsUploaded: boolean;
        submittedForVerification: boolean;
    };
    completionPercentage: number;
}

export interface UserAccessState {
    onboardingRequired: boolean;
    canAccessHome: boolean;
    accessStatus: AccessStatus | "approved";
    nextStep: OnboardingNextStep | "home";
    riderStatus?: IUser["riderStatus"];
    onboardingProgress?: RiderOnboardingState["onboardingProgress"];
    completionPercentage?: number;
}

const toPercentage = (steps: boolean[]): number => {
    const completed = steps.filter(Boolean).length;
    return Math.round((completed / steps.length) * 100);
};

const buildRiderOnboardingStateFromData = (params: {
    isOnboarded: boolean;
    riderStatus: IUser["riderStatus"];
    hasProfileImage: boolean;
    hasVehicle: boolean;
    hasCompleteVehicleDetails: boolean;
    hasVehicleImage: boolean;
    hasAllRequiredDocuments: boolean;
}): RiderOnboardingState => {
    const {
        isOnboarded,
        riderStatus,
        hasProfileImage,
        hasVehicle,
        hasCompleteVehicleDetails,
        hasVehicleImage,
        hasAllRequiredDocuments,
    } = params;

    const submittedForVerification =
        riderStatus === "pending_verification" || riderStatus === "active";

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

export const getRiderOnboardingState = async (
    userId: string,
): Promise<RiderOnboardingState> => {
    const user = await User.findById(userId).select(
        "isOnboarded role riderStatus profileImageUrl",
    );

    if (!user || user.role !== "rider") {
        throw new Error("Rider not found");
    }

    const [vehicles, documents] = await Promise.all([
        Vehicle.find({ userId }),
        Document.find({ userId }).select("documentType"),
    ]);

    const hasVehicle = vehicles.length > 0;
    const hasCompleteVehicleDetails =
        hasVehicle &&
        vehicles.every((v) =>
            Boolean(
                v.brand && v.get("model") && v.year && v.color && v.licensePlate,
            ),
        );
    const hasVehicleImage = hasVehicle && vehicles.every((v) => Boolean(v.imageUrl));

    const uploadedDocumentTypes = new Set(documents.map((d) => d.documentType));
    const hasAllRequiredDocuments = REQUIRED_DOCUMENT_TYPES.every((docType) =>
        uploadedDocumentTypes.has(docType),
    );

    return buildRiderOnboardingStateFromData({
        isOnboarded: user.isOnboarded,
        riderStatus: user.riderStatus,
        hasProfileImage: Boolean(user.profileImageUrl),
        hasVehicle,
        hasCompleteVehicleDetails,
        hasVehicleImage,
        hasAllRequiredDocuments,
    });
};

export const getUserAccessState = async (user: IUser): Promise<UserAccessState> => {
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

    return getRiderOnboardingState(user._id.toString());
};
