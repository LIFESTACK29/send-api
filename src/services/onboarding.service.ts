import User, { IUser } from "../models/user.model";
import Vehicle from "../models/vehicle.model";
import { ensureWalletForUser } from "./wallet.service";

export type OnboardingStage =
    | "email_pending"
    | "profile_pending"
    | "vehicle_pending"
    | "approved"
    | "rejected";

type OnboardingNextStep =
    | "email_otp"
    | "profile_image"
    | "vehicle_selection"
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
        vehicleSelected: boolean;
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
        stage === "vehicle_pending" ||
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
}): OnboardingStage => {
    const { user, hasVehicle } = params;

    if (!user.isOnboarded) return "email_pending";
    if (user.riderStatus === "rejected") return "rejected";
    if (!user.profileImageUrl) return "profile_pending";
    if (!hasVehicle) return "vehicle_pending";
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

    const vehicles = await Vehicle.find({ userId });

    const hasVehicle = vehicles.length > 0;
    const isComplete = Boolean(user.profileImageUrl) && hasVehicle;

    const inferredStage = inferRiderStage({
        user,
        hasVehicle,
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

    const vehicles = await Vehicle.find({ userId: hydratedUser._id });

    const hasVehicle = vehicles.length > 0;

    const onboardingProgress = {
        emailVerified: hydratedUser.isOnboarded,
        profileCompleted: Boolean(hydratedUser.profileImageUrl),
        vehicleSelected: hasVehicle,
    };

    const stage = normalizeOnboardingStage(hydratedUser.onboardingStage);

    const onboardingComplete = stage === "approved" || stage === "rejected";

    if (!onboardingComplete) {
        const currentStep: OnboardingNextStep =
            stage === "email_pending"
                ? "email_otp"
                : stage === "profile_pending"
                  ? "profile_image"
                  : "vehicle_selection";

        return {
            onboardingStage: stage,
            verificationStatus: hydratedUser.verificationStatus || "not_submitted",
            onboardingRequired: true,
            canAccessHome: false,
            accessStatus:
                stage === "email_pending"
                    ? "email_verification_required"
                    : "onboarding_incomplete",
            nextStep:
                stage === "email_pending"
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
};

export const getRiderOnboardingState = async (userId: string) => {
    const user = await syncUserOnboardingState(userId);
    if (!user || user.role !== "rider") {
        throw new Error("Rider not found");
    }

    return getUserAccessState(user);
};
