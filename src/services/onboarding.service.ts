import User, { IUser } from "../models/user.model";
import { ensureWalletForUser } from "./wallet.service";

type AccessStatus =
    | "email_verification_required"
    | "onboarding_incomplete"
    | "pending_admin_approval"
    | "approved";

export interface UserAccessState {
    onboardingRequired: boolean;
    canAccessHome: boolean;
    accessStatus: AccessStatus;
    isOnboarded: boolean;
}

export const getUserAccessState = async (user: IUser): Promise<UserAccessState> => {
    if (user.role !== "rider") {
        if (!user.isOnboarded) {
            return {
                onboardingRequired: true,
                canAccessHome: false,
                accessStatus: "email_verification_required",
                isOnboarded: false,
            };
        }

        return {
            onboardingRequired: false,
            canAccessHome: true,
            accessStatus: "approved",
            isOnboarded: true,
        };
    }

    // Rider-specific flow
    if (!user.isOnboarded) {
        return {
            onboardingRequired: true,
            canAccessHome: false,
            accessStatus: "email_verification_required",
            isOnboarded: false,
        };
    }

    if (!user.riderDetails) {
        return {
            onboardingRequired: true,
            canAccessHome: false,
            accessStatus: "onboarding_incomplete",
            isOnboarded: true,
        };
    }

    if (!user.riderKycApproved) {
        return {
            onboardingRequired: true,
            canAccessHome: false,
            accessStatus: "pending_admin_approval",
            isOnboarded: true,
        };
    }

    return {
        onboardingRequired: false,
        canAccessHome: true,
        accessStatus: "approved",
        isOnboarded: true,
    };
};

export const getRiderOnboardingState = async (userId: string) => {
    const user = await User.findById(userId);
    if (!user || user.role !== "rider") {
        throw new Error("Rider not found");
    }

    return getUserAccessState(user);
};
