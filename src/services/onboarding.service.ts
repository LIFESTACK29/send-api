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
    | "vehicle_selection"
    | "vehicle_details"
    | "vehicle_image"
    | "submit_verification"
    | "settings_documents"
    | "pending_admin_approval"
    | "home";

type AccessStatus =
    | "email_verification_required"
    | "onboarding_incomplete"
    | "settings_incomplete"
    | "pending_admin_approval"
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
        vehicleDetailsCompleted: boolean;
        vehicleImageUploaded: boolean;
        submittedForVerification: boolean;
    };
    settingsChecks?: {
        documentsUploaded: boolean;
        missingDocuments: string[];
    };
    completionPercentage?: number;
}

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

const toPercentage = (steps: boolean[]): number => {
    const completed = steps.filter(Boolean).length;
    return Math.round((completed / steps.length) * 100);
};

const resolveVehicleStep = (params: {
    hasVehicle: boolean;
    hasCompleteVehicleDetails: boolean;
    hasVehicleImage: boolean;
}): "vehicle_selection" | "vehicle_details" | "vehicle_image" | "submit_verification" => {
    const { hasVehicle, hasCompleteVehicleDetails, hasVehicleImage } = params;

    if (!hasVehicle) return "vehicle_selection";
    if (!hasCompleteVehicleDetails) return "vehicle_details";
    if (!hasVehicleImage) return "vehicle_image";
    return "submit_verification";
};

const mapVerificationStatus = (
    riderStatus: IUser["riderStatus"],
    existingStatus?: IUser["verificationStatus"],
): IUser["verificationStatus"] => {
    if (riderStatus === "active") return "approved";
    if (riderStatus === "pending_verification") return "pending";
    if (riderStatus === "rejected") return "rejected";
    if (existingStatus === "approved") return "approved";
    return "not_submitted";
};

const inferRiderStage = (params: {
    user: IUser;
    hasVehicle: boolean;
    hasCompleteVehicleDetails: boolean;
    hasVehicleImage: boolean;
}): OnboardingStage => {
    const { user, hasVehicle, hasCompleteVehicleDetails, hasVehicleImage } =
        params;

    if (!user.isOnboarded) return "email_pending";
    if (user.riderStatus === "active") return "approved";
    if (user.riderStatus === "pending_verification")
        return "pending_admin_approval";
    if (user.riderStatus === "rejected") return "rejected";
    if (!user.profileImageUrl) return "profile_pending";
    if (!hasVehicle || !hasCompleteVehicleDetails || !hasVehicleImage)
        return "vehicle_pending";
    return "review_pending";
};

export const getSettingsDocumentCompliance = async (userId: string) => {
    const documents = await Document.find({ userId }).select("documentType");
    const uploadedDocumentTypes = new Set(documents.map((d) => d.documentType));
    const missingDocuments = REQUIRED_DOCUMENT_TYPES.filter(
        (docType) => !uploadedDocumentTypes.has(docType),
    );

    return {
        documentsUploaded: missingDocuments.length === 0,
        missingDocuments,
    };
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

    const [vehicles, docsCompliance] = await Promise.all([
        Vehicle.find({ userId }),
        getSettingsDocumentCompliance(userId),
    ]);

    const hasVehicle = vehicles.length > 0;
    const hasCompleteVehicleDetails =
        hasVehicle && vehicles.every((v) => isVehicleDetailsComplete(v));
    const hasVehicleImage = hasVehicle && vehicles.every((v) => Boolean(v.imageUrl));

    if (user.riderStatus === "incomplete") {
        user.riderStatus = "inactive";
    }

    if (user.riderStatus === "active" && !docsCompliance.documentsUploaded) {
        user.riderStatus = "inactive";
    }

    if (
        user.riderStatus === "inactive" &&
        user.verificationStatus === "approved" &&
        docsCompliance.documentsUploaded &&
        user.isOnboarded
    ) {
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
            onboardingStage: hydratedUser.onboardingStage || "approved",
            verificationStatus: hydratedUser.verificationStatus || "approved",
            onboardingRequired: false,
            canAccessHome: true,
            accessStatus: "approved",
            nextStep: "home",
            currentStep: "home",
        };
    }

    const [vehicles, docsCompliance] = await Promise.all([
        Vehicle.find({ userId: hydratedUser._id }),
        getSettingsDocumentCompliance(hydratedUser._id.toString()),
    ]);

    const hasVehicle = vehicles.length > 0;
    const hasCompleteVehicleDetails =
        hasVehicle && vehicles.every((v) => isVehicleDetailsComplete(v));
    const hasVehicleImage = hasVehicle && vehicles.every((v) => Boolean(v.imageUrl));

    const submittedForVerification =
        hydratedUser.riderStatus === "pending_verification" ||
        hydratedUser.riderStatus === "active";

    const onboardingProgress = {
        emailVerified: hydratedUser.isOnboarded,
        profileCompleted: Boolean(hydratedUser.profileImageUrl),
        vehicleSelected: hasVehicle,
        vehicleDetailsCompleted: hasCompleteVehicleDetails,
        vehicleImageUploaded: hasVehicleImage,
        submittedForVerification,
    };

    const stage =
        hydratedUser.onboardingStage === "documents_pending"
            ? "review_pending"
            : hydratedUser.onboardingStage || "profile_pending";

    const onboardingComplete =
        stage === "approved" ||
        stage === "pending_admin_approval" ||
        stage === "rejected";

    if (!onboardingComplete) {
        const vehicleStep = resolveVehicleStep({
            hasVehicle,
            hasCompleteVehicleDetails,
            hasVehicleImage,
        });
        const currentStep: OnboardingNextStep =
            stage === "email_pending"
                ? "email_otp"
                : stage === "profile_pending"
                  ? "profile_image"
                  : stage === "vehicle_pending"
                    ? vehicleStep
                    : "submit_verification";

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
                      : stage === "vehicle_pending"
                        ? vehicleStep
                        : "submit_verification",
            currentStep,
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
            currentStep: "pending_admin_approval",
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
            currentStep: "settings_documents",
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
        currentStep: "home",
        riderStatus: hydratedUser.riderStatus,
        onboardingProgress,
        settingsChecks: docsCompliance,
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
