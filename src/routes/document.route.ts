import { Router } from "express";
import { upload } from "../middlewares/upload.middleware";
import {
    authenticate,
    authorize,
    authorizeSelfOrAdmin,
} from "../middlewares/auth.middleware";
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
router.post(
    "/:userId/documents",
    authenticate,
    authorizeSelfOrAdmin(),
    upload.single("documentFile"),
    uploadDocument,
);
router.get("/:userId/documents", authenticate, authorizeSelfOrAdmin(), getUserDocuments);
router.get(
    "/:userId/documents/:documentId",
    authenticate,
    authorizeSelfOrAdmin(),
    getDocument,
);
router.delete(
    "/:userId/documents/:documentId",
    authenticate,
    authorizeSelfOrAdmin(),
    deleteDocument,
);

// Admin routes - Verification
router.put(
    "/admin/documents/:documentId/verify",
    authenticate,
    authorize("admin"),
    verifyDocument,
);
router.put(
    "/admin/riders/:userId/verify",
    authenticate,
    authorize("admin"),
    verifyRider,
);

export default router;
