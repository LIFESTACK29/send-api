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
exports.verifyRider = exports.verifyDocument = exports.deleteDocument = exports.getDocument = exports.getUserDocuments = exports.uploadDocument = exports.getRequiredDocuments = void 0;
const document_model_1 = __importDefault(require("../models/document.model"));
const user_model_1 = __importDefault(require("../models/user.model"));
const upload_middleware_1 = require("../middlewares/upload.middleware");
const catchasync_util_1 = require("../utils/catchasync.util");
const onboarding_service_1 = require("../services/onboarding.service");
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
exports.getRequiredDocuments = (0, catchasync_util_1.CatchAsync)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    res.status(200).json({
        success: true,
        data: REQUIRED_DOCUMENTS,
    });
}));
/**
 * @desc    Upload document
 * @route   POST /api/v1/riders/:userId/documents
 * @access  Private
 */
exports.uploadDocument = (0, catchasync_util_1.CatchAsync)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { userId } = req.params;
    const { documentType, documentNumber, expiryDate } = req.body;
    if (!documentType || !documentNumber) {
        res.status(400).json({
            success: false,
            message: "Document type and number are required",
        });
        return;
    }
    if (![
        "DRIVING_LICENSE",
        "GOVERNMENT_ID",
        "INSURANCE",
        "REGISTRATION",
    ].includes(documentType)) {
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
    const user = yield user_model_1.default.findById(userId);
    if (!user || user.role !== "rider") {
        res.status(404).json({
            success: false,
            message: "Rider not found",
        });
        return;
    }
    // Check if document already exists
    const existingDoc = yield document_model_1.default.findOne({
        userId,
        documentType,
    });
    if (existingDoc) {
        // Update existing document
        const documentUrl = yield (0, upload_middleware_1.uploadToStorage)(req.file, `documents/${userId}/${documentType}`);
        existingDoc.documentUrl = documentUrl;
        existingDoc.documentNumber = documentNumber;
        if (expiryDate) {
            existingDoc.expiryDate = new Date(expiryDate);
        }
        existingDoc.verificationStatus = "pending";
        yield existingDoc.save();
        yield (0, onboarding_service_1.syncUserOnboardingState)(userId);
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
    const documentUrl = yield (0, upload_middleware_1.uploadToStorage)(req.file, `documents/${userId}/${documentType}`);
    const newDocument = yield document_model_1.default.create({
        userId,
        documentType,
        documentUrl,
        documentNumber,
        expiryDate: expiryDate ? new Date(expiryDate) : undefined,
        verificationStatus: "pending",
    });
    yield (0, onboarding_service_1.syncUserOnboardingState)(userId);
    res.status(201).json({
        success: true,
        message: "Document uploaded successfully",
        data: {
            documentId: newDocument._id,
            documentType: newDocument.documentType,
            verificationStatus: newDocument.verificationStatus,
        },
    });
}));
/**
 * @desc    Get user's documents
 * @route   GET /api/v1/riders/:userId/documents
 * @access  Private
 */
exports.getUserDocuments = (0, catchasync_util_1.CatchAsync)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { userId } = req.params;
    const documents = yield document_model_1.default.find({ userId }).select("documentType documentNumber expiryDate verificationStatus uploadedAt rejectionReason");
    res.status(200).json({
        success: true,
        data: {
            totalDocuments: documents.length,
            documents,
            missingDocuments: REQUIRED_DOCUMENTS.filter((req) => !documents.some((doc) => doc.documentType === req.type)).map((d) => d.type),
        },
    });
}));
/**
 * @desc    Get single document
 * @route   GET /api/v1/riders/:userId/documents/:documentId
 * @access  Private
 */
exports.getDocument = (0, catchasync_util_1.CatchAsync)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { userId, documentId } = req.params;
    const document = yield document_model_1.default.findOne({
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
    yield (0, onboarding_service_1.syncUserOnboardingState)(userId);
    res.status(200).json({
        success: true,
        data: document,
    });
}));
/**
 * @desc    Delete document
 * @route   DELETE /api/v1/riders/:userId/documents/:documentId
 * @access  Private
 */
exports.deleteDocument = (0, catchasync_util_1.CatchAsync)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { userId, documentId } = req.params;
    const document = yield document_model_1.default.findOneAndDelete({
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
}));
/**
 * @desc    Admin: Verify/Approve document
 * @route   PUT /api/v1/admin/documents/:documentId/verify
 * @access  Private (Admin Only)
 */
exports.verifyDocument = (0, catchasync_util_1.CatchAsync)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { documentId } = req.params;
    const { status, rejectionReason } = req.body;
    if (!["approved", "rejected"].includes(status)) {
        res.status(400).json({
            success: false,
            message: "Invalid verification status",
        });
        return;
    }
    const document = yield document_model_1.default.findByIdAndUpdate(documentId, {
        verificationStatus: status,
        rejectionReason: status === "rejected" ? rejectionReason : undefined,
    }, { new: true });
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
}));
/**
 * @desc    Admin: Verify/Approve rider
 * @route   PUT /api/v1/admin/riders/:userId/verify
 * @access  Private (Admin Only)
 */
exports.verifyRider = (0, catchasync_util_1.CatchAsync)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { userId } = req.params;
    const { status, notes } = req.body;
    if (!["active", "inactive", "rejected"].includes(status)) {
        res.status(400).json({
            success: false,
            message: "Invalid verification status",
        });
        return;
    }
    if (status === "active") {
        const compliance = yield (0, onboarding_service_1.getSettingsDocumentCompliance)(userId);
        if (!compliance.documentsUploaded) {
            res.status(400).json({
                success: false,
                message: "Rider cannot be activated until all required documents are uploaded in settings",
                data: {
                    riderStatus: "inactive",
                    missingDocuments: compliance.missingDocuments,
                    nextStep: "settings_documents",
                },
            });
            return;
        }
    }
    const user = yield user_model_1.default.findByIdAndUpdate(userId, {
        riderStatus: status,
        verificationStatus: status === "active"
            ? "approved"
            : status === "rejected"
                ? "rejected"
                : "not_submitted",
        onboardingStage: status === "rejected" ? "rejected" : "approved",
        verificationNotes: notes,
    }, { new: true });
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
}));
