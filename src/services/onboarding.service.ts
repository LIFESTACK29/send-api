import User, { IUser } from "../models/user.model";
import Vehicle from "../models/vehicle.model";
import Document from "../models/document.model";
import { ensureWalletForUser } from "./wallet.service";

export type OnboardingStage =
    | "email_pending"
    | "profile_pending"
    | "personal_details_pending"
    | "vehicle_pending"
    | "documents_pending"
    | "review_pending"
    | "pending_admin_approval"
    | "approved"
    | "rejected";

type OnboardingNextStep =
    | "email_otp"
    | "profile_image"
    | "personal_details"
    | "vehicle_selection"
    | "vehicle_image"
    | "documents"
    | "submit_verification"
    | "pending_admin_approval"
    | "home";

type AccessStatus =
    | "email_verification_required"
    | "onboarding_incomplete"
    | "approved";

export interface UserAccessState {
    onboardingStage: OnboardingStage;
    verificationStatus: IUser["verificationStatus"];
    onboardingRequired: boolean;
    canAccessHome: boolean;
    accessStatus: AccessStatus;
    nextStep: OnboardingNextStep;
    currentStep: OnboardingNextStep;
    riderStatus?: IUser["riderStatus"];
    onboardingProgress?: {
        emailVerified: boolean;
        profileCompleted: boolean;
        personalDetailsCompleted: boolean;
        vehicleSelected: boolean;
        documentsUploaded: boolean;
    };
    completionPercentage?: number;
}

const toPercentage = (steps: boolean[]): number => {
    const completed = steps.filter(Boolean).length;
    return Math.round((completed / steps.length) * 100);
};

const normalizeOnboardingStage = (
    stage?: IUser["onboardingStage"],
): OnboardingStage => {
    if (!stage) return "profile_pending";
    if (
        stage === "email_pending" ||
        stage === "profile_pending" ||
        stage === "personal_details_pending" ||
        stage === "vehicle_pending" ||
        stage === "documents_pending" ||
        stage === "review_pending" ||
        stage === "pending_admin_approval" ||
        stage === "approved" ||
        stage === "rejected"
    ) {
        return stage;
    }

    // Legacy stages now map to simplified onboarding.
    return "vehicle_pending";
};

const mapVerificationStatus = (
    riderStatus: IUser["riderStatus"],
    existingStatus?: IUser["verificationStatus"],
): IUser["verificationStatus"] => {
    if (riderStatus === "active") return "approved";
    if (riderStatus === "rejected") return "rejected";
    return "not_submitted";
};

const inferRiderStage = (params: {
    user: IUser;
    hasVehicle: boolean;
    hasPersonalDetails: boolean;
    hasRequiredDocs: boolean;
    hasVehicleImage: boolean;
}): OnboardingStage => {
    const { user, hasVehicle, hasPersonalDetails, hasRequiredDocs, hasVehicleImage } = params;

    if (!user.isOnboarded) return "email_pending";
    if (user.riderStatus === "rejected") return "rejected";
    if (!user.profileImageUrl) return "profile_pending";
    if (!hasPersonalDetails) return "personal_details_pending";
    if (!hasVehicle || !hasVehicleImage) return "vehicle_pending";
    if (!hasRequiredDocs) return "documents_pending";
    if (user.riderStatus === "pending_verification") return "review_pending";
    if (user.riderStatus === "pending_admin_approval") return "pending_admin_approval";
    return "approved";
};

export const syncUserOnboardingState = async (
    userId: string,
): Promise<IUser | null> => {
    const user = await User.findById(userId);
    if (!user) return null;

    if (!user.isOnboarded) {
        user.onboardingStage = "email_pending";
        user.riderStatus = user.role === "rider" ? "inactive" : user.riderStatus;
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
        Document.find({ userId }),
    ]);

    const hasVehicle = vehicles.length > 0;
    const hasVehicleImage = vehicles.some((v) => v.imageUrl);
    const hasPersonalDetails = Boolean(
        user.ninNumber && user.stateOfResidence && user.operationalArea,
    );
    const hasRequiredDocs = ["NIN_DOCUMENT", "RIDERS_PERMIT"].every((type) =>
        documents.some((d) => d.documentType === type),
    );
    const isComplete =
        Boolean(user.profileImageUrl) &&
        hasPersonalDetails &&
        hasVehicle &&
        hasVehicleImage &&
        hasRequiredDocs;

    const inferredStage = inferRiderStage({
        user,
        hasVehicle,
        hasPersonalDetails,
        hasRequiredDocs,
        hasVehicleImage,
    });

    if (isComplete && user.riderStatus !== "rejected") {
        user.riderStatus = "active";
        await ensureWalletForUser(userId);
    } else if (user.riderStatus !== "rejected") {
        user.riderStatus = "inactive";
    }

    user.onboardingStage = inferredStage;
    user.verificationStatus = mapVerificationStatus(
        user.riderStatus,
        user.verificationStatus,
    );

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

    const [vehicles, documents] = await Promise.all([
        Vehicle.find({ userId: hydratedUser._id }),
        Document.find({ userId: hydratedUser._id }),
    ]);

    const hasVehicle = vehicles.length > 0;
    const hasVehicleImage = vehicles.some((v) => v.imageUrl);
    const hasPersonalDetails = Boolean(
        hydratedUser.ninNumber &&
        hydratedUser.stateOfResidence &&
        hydratedUser.operationalArea,
    );
    const hasRequiredDocs = ["NIN_DOCUMENT", "RIDERS_PERMIT"].every((type) =>
        documents.some((d) => d.documentType === type),
    );

    const onboardingProgress = {
        emailVerified: hydratedUser.isOnboarded,
        profileCompleted: Boolean(hydratedUser.profileImageUrl),
        personalDetailsCompleted: hasPersonalDetails,
        vehicleSelected: hasVehicle,
        vehicleImageUploaded: hasVehicleImage,
        documentsUploaded: hasRequiredDocs,
    };

    const stage = normalizeOnboardingStage(hydratedUser.onboardingStage);

    const onboardingComplete =
        stage === "approved" ||
        stage === "rejected" ||
        stage === "pending_admin_approval" ||
        stage === "review_pending";

    if (!onboardingComplete) {
        let currentStep: OnboardingNextStep;
        if (stage === "email_pending") {
            currentStep = "email_otp";
        } else if (stage === "profile_pending") {
            currentStep = "profile_image";
        } else if (stage === "personal_details_pending") {
            currentStep = "personal_details";
        } else if (stage === "vehicle_pending") {
            if (!hasVehicle) {
                currentStep = "vehicle_selection";
            } else if (!hasVehicleImage) {
                currentStep = "vehicle_image";
            } else {
                currentStep = "documents";
            }
        } else if (stage === "documents_pending") {
            currentStep = "documents";
        } else {
            currentStep = "submit_verification";
        }

        return {
            onboardingStage: stage,
            verificationStatus: hydratedUser.verificationStatus || "not_submitted",
            onboardingRequired: true,
            canAccessHome: false,
            accessStatus:
                stage === "email_pending"
                    ? "email_verification_required"
                    : "onboarding_incomplete",
            nextStep: currentStep,
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
};

export const getRiderOnboardingState = async (userId: string) => {
    const user = await syncUserOnboardingState(userId);
    if (!user || user.role !== "rider") {
        throw new Error("Rider not found");
    }

    return getUserAccessState(user);
};
