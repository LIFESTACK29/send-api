import { Router } from "express";
import {
    getAuthStatus,
    onboardUser,
    updateProfile,
    addAddress,
    editAddress,
    deleteAddress,
} from "../controllers/user.controller";
import { ClerkExpressRequireAuth } from "@clerk/clerk-sdk-node";

const router = Router();

router.get("/", (req, res) => {
    res.json({
        message: "Welcome to RahaSend API - User 123",
    });
});

router.get("/status/:clerkId", getAuthStatus);
router.post("/onboard", onboardUser);
router.patch("/profile/:clerkId", ClerkExpressRequireAuth(), updateProfile);

router.post("/addresses/:clerkId", ClerkExpressRequireAuth(), addAddress);
router.put(
    "/addresses/:clerkId/:addressId",
    ClerkExpressRequireAuth(),
    editAddress,
);
router.delete(
    "/addresses/:clerkId/:addressId",
    ClerkExpressRequireAuth(),
    deleteAddress,
);

export default router;
