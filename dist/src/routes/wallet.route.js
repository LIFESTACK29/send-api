"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_middleware_1 = require("../middlewares/auth.middleware");
const wallet_controller_1 = require("../controllers/wallet.controller");
const router = (0, express_1.Router)();
// Paystack webhook — must be BEFORE authenticate middleware
router.post("/webhook", wallet_controller_1.handleWebhook);
router.get("/callback", wallet_controller_1.handleCallback);
// All routes below require authentication
router.use(auth_middleware_1.authenticate);
router.post("/create", wallet_controller_1.createWallet);
router.get("/status", wallet_controller_1.getWalletStatus);
router.get("/balance", wallet_controller_1.getWalletBalance);
router.get("/transactions", wallet_controller_1.getTransactions);
router.get("/banks", wallet_controller_1.getBanks);
router.post("/resolve-account", wallet_controller_1.resolveAccount);
router.post("/bank-account", wallet_controller_1.saveBankAccount);
router.get("/bank-account", wallet_controller_1.getBankAccount);
router.post("/withdraw", wallet_controller_1.withdraw);
exports.default = router;
