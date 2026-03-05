"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const user_controller_1 = require("../controllers/user.controller");
const router = (0, express_1.Router)();
router.get("/status/:clerkId", user_controller_1.getAuthStatus);
router.post("/onboard", user_controller_1.onboardUser);
exports.default = router;
