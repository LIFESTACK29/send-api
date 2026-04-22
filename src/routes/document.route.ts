import { Router } from "express";
import { upload } from "../middlewares/upload.middleware";
import { authenticate } from "../middlewares/auth.middleware";
import {
    getRequiredDocuments,
    uploadDocument,
    getUserDocuments,
    getDocument,
    deleteDocument,
    verifyDocument,
    verifyRider,
} from "../controllers/document.controller";

const router = Router();

// Public routes
router.get("/required", authenticate, getRequiredDocuments);

// Rider routes - Document management
router.post("/:userId/documents", authenticate, upload.single("documentFile"), uploadDocument);
router.get("/:userId/documents", authenticate, getUserDocuments);
router.get("/:userId/documents/:documentId", authenticate, getDocument);
router.delete("/:userId/documents/:documentId", authenticate, deleteDocument);

// Admin routes - Verification
router.put("/admin/documents/:documentId/verify", authenticate, verifyDocument);
router.put("/admin/riders/:userId/verify", authenticate, verifyRider);

export default router;
