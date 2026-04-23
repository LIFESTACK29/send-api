"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const upload_middleware_1 = require("../middlewares/upload.middleware");
const auth_middleware_1 = require("../middlewares/auth.middleware");
const document_controller_1 = require("../controllers/document.controller");
const router = (0, express_1.Router)();
// Public routes
router.get("/required", auth_middleware_1.authenticate, document_controller_1.getRequiredDocuments);
// Rider routes - Document management
router.post("/:userId/documents", auth_middleware_1.authenticate, (0, auth_middleware_1.authorizeSelfOrAdmin)(), upload_middleware_1.upload.single("documentFile"), document_controller_1.uploadDocument);
router.get("/:userId/documents", auth_middleware_1.authenticate, (0, auth_middleware_1.authorizeSelfOrAdmin)(), document_controller_1.getUserDocuments);
router.get("/:userId/documents/:documentId", auth_middleware_1.authenticate, (0, auth_middleware_1.authorizeSelfOrAdmin)(), document_controller_1.getDocument);
router.delete("/:userId/documents/:documentId", auth_middleware_1.authenticate, (0, auth_middleware_1.authorizeSelfOrAdmin)(), document_controller_1.deleteDocument);
// Admin routes - Verification
router.put("/admin/documents/:documentId/verify", auth_middleware_1.authenticate, (0, auth_middleware_1.authorize)("admin"), document_controller_1.verifyDocument);
router.put("/admin/riders/:userId/verify", auth_middleware_1.authenticate, (0, auth_middleware_1.authorize)("admin"), document_controller_1.verifyRider);
exports.default = router;
