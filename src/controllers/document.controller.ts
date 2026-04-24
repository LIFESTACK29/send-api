import { Request, Response, RequestHandler } from "express";
import Document from "../models/document.model";
import User from "../models/user.model";
import Vehicle from "../models/vehicle.model";
import { AuthRequest } from "../types/user.type";
import { uploadToStorage } from "../middlewares/upload.middleware";
import { CatchAsync } from "../utils/catchasync.util";
import {
    getUserAccessState,
    syncUserOnboardingState,
} from "../services/onboarding.service";

const REQUIRED_DOCUMENTS = [
    {
        type: "DRIVING_LICENSE",
        label: "Driving License",
        description: "Valid government-issued driving license",
        required: true,
    },
    {
        type: "GOVERNMENT_ID",
        label: "Government ID",
        description: "Passport, National ID, or State ID",
        required: true,
    },
    {
        type: "INSURANCE",
        label: "Insurance Certificate",
        description: "Vehicle insurance document",
        required: true,
    },
    {
        type: "REGISTRATION",
        label: "Vehicle Registration",
        description: "Vehicle registration certificate",
        required: true,
    },
];

/**
 * @desc    Get required documents list
 * @route   GET /api/v1/riders/documents/required
 * @access  Private
 */
export const getRequiredDocuments: RequestHandler = CatchAsync(
    async (req: AuthRequest, res: Response) => {
        res.status(200).json({
            success: true,
            data: REQUIRED_DOCUMENTS,
        });
    },
);

/**
 * @desc    Upload document
 * @route   POST /api/v1/riders/:userId/documents
 * @access  Private
 */
export const uploadDocument: RequestHandler = CatchAsync(
    async (req: AuthRequest, res: Response) => {
        const { userId } = req.params;
        const { documentType, documentNumber, expiryDate } = req.body;

        if (!documentType || !documentNumber) {
            res.status(400).json({
                success: false,
                message: "Document type and number are required",
            });
            return;
        }

        if (
            ![
                "DRIVING_LICENSE",
                "GOVERNMENT_ID",
                "INSURANCE",
                "REGISTRATION",
            ].includes(documentType)
        ) {
            res.status(400).json({
                success: false,
                message: "Invalid document type",
            });
            return;
        }

        if (!req.file) {
            res.status(400).json({
                success: false,
                message: "No document file provided",
            });
            return;
        }

        // Verify user exists and is a rider
        const user = await User.findById(userId);
        if (!user || user.role !== "rider") {
            res.status(404).json({
                success: false,
                message: "Rider not found",
            });
            return;
        }

        // Check if document already exists
        const existingDoc = await Document.findOne({
            userId,
            documentType,
        });

        if (existingDoc) {
            // Update existing document
            const documentUrl = await uploadToStorage(
                req.file,
                `documents/${userId}/${documentType}`,
            );

            existingDoc.documentUrl = documentUrl;
            existingDoc.documentNumber = documentNumber;
            if (expiryDate) {
                existingDoc.expiryDate = new Date(expiryDate);
            }
            existingDoc.verificationStatus = "pending";

            await existingDoc.save();
            await syncUserOnboardingState(userId);

            res.status(200).json({
                success: true,
                message: "Document updated successfully",
                data: {
                    documentId: existingDoc._id,
                    documentType: existingDoc.documentType,
                    verificationStatus: existingDoc.verificationStatus,
                },
            });
            return;
        }

        // Upload new document
        const documentUrl = await uploadToStorage(
            req.file,
            `documents/${userId}/${documentType}`,
        );

        const newDocument = await Document.create({
            userId,
            documentType,
            documentUrl,
            documentNumber,
            expiryDate: expiryDate ? new Date(expiryDate) : undefined,
            verificationStatus: "pending",
        });
        await syncUserOnboardingState(userId);

        res.status(201).json({
            success: true,
            message: "Document uploaded successfully",
            data: {
                documentId: newDocument._id,
                documentType: newDocument.documentType,
                verificationStatus: newDocument.verificationStatus,
            },
        });
    },
);

/**
 * @desc    Get user's documents
 * @route   GET /api/v1/riders/:userId/documents
 * @access  Private
 */
export const getUserDocuments: RequestHandler = CatchAsync(
    async (req: AuthRequest, res: Response) => {
        const { userId } = req.params;

        const documents = await Document.find({ userId }).select(
            "documentType documentNumber expiryDate verificationStatus uploadedAt rejectionReason",
        );

        res.status(200).json({
            success: true,
            data: {
                totalDocuments: documents.length,
                documents,
                missingDocuments: REQUIRED_DOCUMENTS.filter(
                    (req) =>
                        !documents.some((doc) => doc.documentType === req.type),
                ).map((d) => d.type),
            },
        });
    },
);

/**
 * @desc    Get single document
 * @route   GET /api/v1/riders/:userId/documents/:documentId
 * @access  Private
 */
export const getDocument: RequestHandler = CatchAsync(
    async (req: AuthRequest, res: Response) => {
        const { userId, documentId } = req.params;

        const document = await Document.findOne({
            _id: documentId,
            userId,
        });

        if (!document) {
            res.status(404).json({
                success: false,
                message: "Document not found",
            });
            return;
        }

        await syncUserOnboardingState(userId);

        res.status(200).json({
            success: true,
            data: document,
        });
    },
);

/**
 * @desc    Delete document
 * @route   DELETE /api/v1/riders/:userId/documents/:documentId
 * @access  Private
 */
export const deleteDocument: RequestHandler = CatchAsync(
    async (req: AuthRequest, res: Response) => {
        const { userId, documentId } = req.params;

        const document = await Document.findOneAndDelete({
            _id: documentId,
            userId,
        });

        if (!document) {
            res.status(404).json({
                success: false,
                message: "Document not found",
            });
            return;
        }

        res.status(200).json({
            success: true,
            message: "Document deleted successfully",
        });
    },
);

/**
 * @desc    Admin: Verify/Approve document
 * @route   PUT /api/v1/admin/documents/:documentId/verify
 * @access  Private (Admin Only)
 */
export const verifyDocument: RequestHandler = CatchAsync(
    async (req: AuthRequest, res: Response) => {
        const { documentId } = req.params;
        const { status, rejectionReason } = req.body;

        if (!["approved", "rejected"].includes(status)) {
            res.status(400).json({
                success: false,
                message: "Invalid verification status",
            });
            return;
        }

        const document = await Document.findByIdAndUpdate(
            documentId,
            {
                verificationStatus: status,
                rejectionReason:
                    status === "rejected" ? rejectionReason : undefined,
            },
            { new: true },
        );

        if (!document) {
            res.status(404).json({
                success: false,
                message: "Document not found",
            });
            return;
        }

        res.status(200).json({
            success: true,
            message: `Document ${status} successfully`,
            data: document,
        });
    },
);

/**
 * @desc    Admin: Verify/Approve rider
 * @route   PUT /api/v1/admin/riders/:userId/verify
 * @access  Private (Admin Only)
 */
export const verifyRider: RequestHandler = CatchAsync(
    async (req: AuthRequest, res: Response) => {
        const { userId } = req.params;
        const { status, notes } = req.body;

        if (!["active", "inactive", "rejected"].includes(status)) {
            res.status(400).json({
                success: false,
                message: "Invalid verification status",
            });
            return;
        }

        const user = await User.findByIdAndUpdate(
            userId,
            {
                riderStatus: status,
                verificationStatus:
                    status === "active"
                        ? "approved"
                        : status === "rejected"
                          ? "rejected"
                          : "not_submitted",
                onboardingStage:
                    status === "rejected" ? "rejected" : "approved",
                verificationNotes: notes,
            },
            { new: true },
        );

        if (!user) {
            res.status(404).json({
                success: false,
                message: "User not found",
            });
            return;
        }

        res.status(200).json({
            success: true,
            message: `Rider ${status} successfully`,
            data: {
                userId: user._id,
                riderStatus: user.riderStatus,
                onboardingStage: user.onboardingStage,
                verificationStatus: user.verificationStatus,
                verificationNotes: user.verificationNotes,
            },
        });
    },
);

/**
 * @desc    Admin: Get all riders with verification and document summary
 * @route   GET /api/v1/admin/riders
 * @access  Private (Admin Only)
 */
export const getAllRidersForAdmin: RequestHandler = CatchAsync(
    async (req: AuthRequest, res: Response) => {
        const riders = await User.find({ role: "rider" })
            .select(
                "firstName lastName email phoneNumber riderStatus onboardingStage verificationStatus verificationNotes profileImageUrl createdAt updatedAt",
            )
            .sort({ updatedAt: -1 });

        const riderIds = riders.map((rider) => rider._id);
        const vehicles = await Vehicle.find({ userId: { $in: riderIds } }).select(
            "userId imageUrl",
        );

        const vehiclesByUser = new Map<string, any[]>();
        vehicles.forEach((vehicle) => {
            const key = vehicle.userId.toString();
            if (!vehiclesByUser.has(key)) vehiclesByUser.set(key, []);
            vehiclesByUser.get(key)?.push(vehicle);
        });

        const formatted = await Promise.all(
            riders.map(async (rider) => {
                const userId = rider._id.toString();
                const riderVehicles = vehiclesByUser.get(userId) || [];
                const accessState = await getUserAccessState(rider as any);

                return {
                    id: rider._id,
                    firstName: rider.firstName,
                    lastName: rider.lastName,
                    email: rider.email,
                    phoneNumber: rider.phoneNumber,
                    riderStatus: rider.riderStatus,
                    onboardingStage: rider.onboardingStage,
                    verificationStatus: rider.verificationStatus,
                    verificationNotes: rider.verificationNotes,
                    hasProfileImage: Boolean(rider.profileImageUrl),
                    hasVehicle: riderVehicles.length > 0,
                    hasVehicleImage: riderVehicles.some((v) => Boolean(v.imageUrl)),
                    accessState,
                    createdAt: rider.createdAt,
                    updatedAt: rider.updatedAt,
                };
            }),
        );

        res.status(200).json({
            success: true,
            data: {
                totalRiders: formatted.length,
                riders: formatted,
            },
        });
    },
);

/**
 * @desc    Admin: Get single rider verification details
 * @route   GET /api/v1/admin/riders/:userId
 * @access  Private (Admin Only)
 */
export const getRiderVerificationDetail: RequestHandler = CatchAsync(
    async (req: AuthRequest, res: Response) => {
        const { userId } = req.params;

        const rider = await User.findOne({ _id: userId, role: "rider" }).select(
            "firstName lastName email phoneNumber riderStatus onboardingStage verificationStatus verificationNotes profileImageUrl createdAt updatedAt",
        );

        if (!rider) {
            res.status(404).json({
                success: false,
                message: "Rider not found",
            });
            return;
        }

        const [vehicles, accessState] = await Promise.all([
            Vehicle.find({ userId }).select(
                "vehicleType brand model year color licensePlate registrationNumber imageUrl verificationStatus createdAt updatedAt",
            ),
            getUserAccessState(rider as any),
        ]);

        res.status(200).json({
            success: true,
            data: {
                rider: {
                    id: rider._id,
                    firstName: rider.firstName,
                    lastName: rider.lastName,
                    email: rider.email,
                    phoneNumber: rider.phoneNumber,
                    riderStatus: rider.riderStatus,
                    onboardingStage: rider.onboardingStage,
                    verificationStatus: rider.verificationStatus,
                    verificationNotes: rider.verificationNotes,
                    profileImageUrl: rider.profileImageUrl,
                    accessState,
                    createdAt: rider.createdAt,
                    updatedAt: rider.updatedAt,
                },
                vehicles,
            },
        });
    },
);
