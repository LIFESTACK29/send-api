import { Router } from "express";
import { authenticate } from "../middlewares/auth.middleware";
import {
    createWallet,
    getWalletBalance,
    getWalletStatus,
    getTransactions,
    handleWebhook,
    handleCallback,
    getBanks,
    resolveAccount,
    saveBankAccount,
    getBankAccount,
    withdraw,
} from "../controllers/wallet.controller";

const router = Router();

// Paystack webhook — must be BEFORE authenticate middleware
router.post("/webhook", handleWebhook);
router.get("/callback", handleCallback);

// All routes below require authentication
router.use(authenticate);

router.post("/create", createWallet);
router.get("/status", getWalletStatus);
router.get("/balance", getWalletBalance);
router.get("/transactions", getTransactions);
router.get("/banks", getBanks);
router.post("/resolve-account", resolveAccount);
router.post("/bank-account", saveBankAccount);
router.get("/bank-account", getBankAccount);
router.post("/withdraw", withdraw);

export default router;
