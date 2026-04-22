"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const user_controller_1 = require("../controllers/user.controller");
const auth_middleware_1 = require("../middlewares/auth.middleware");
const router = (0, express_1.Router)();
router.get("/", (req, res) => {
    res.json({
        message: "Welcome to RahaSend API - User",
    });
});
// All user routes are protected
router.get("/profile", auth_middleware_1.authenticate, user_controller_1.getProfile);
router.patch("/profile", auth_middleware_1.authenticate, user_controller_1.updateProfile);
router.patch("/push-token", auth_middleware_1.authenticate, user_controller_1.updatePushToken);
router.post("/addresses", auth_middleware_1.authenticate, user_controller_1.addAddress);
router.put("/addresses/:addressId", auth_middleware_1.authenticate, user_controller_1.editAddress);
router.delete("/addresses/:addressId", auth_middleware_1.authenticate, user_controller_1.deleteAddress);
exports.default = router;
