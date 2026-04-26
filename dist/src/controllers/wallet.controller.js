"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
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
exports.handleCallback = exports.processDeliveryPayment = exports.withdraw = exports.getBankAccount = exports.saveBankAccount = exports.resolveAccount = exports.getBanks = exports.handleWebhook = exports.getTransactions = exports.getWalletStatus = exports.getWalletBalance = exports.createWallet = void 0;
const crypto = __importStar(require("crypto"));
const wallet_model_1 = __importDefault(require("../models/wallet.model"));
const transaction_model_1 = __importDefault(require("../models/transaction.model"));
const bank_account_model_1 = __importDefault(require("../models/bank-account.model"));
const user_model_1 = __importDefault(require("../models/user.model"));
const auth_middleware_1 = require("../middlewares/auth.middleware");
const paystackService = __importStar(require("../services/paystack.service"));
const log_model_1 = __importDefault(require("../models/log.model"));
const socket_service_1 = require("../services/socket.service");
const notification_service_1 = require("../services/notification.service");
const wallet_service_1 = require("../services/wallet.service");
const PLATFORM_COMMISSION_RATE = 0.1; // 10%
const MIN_WITHDRAWAL_AMOUNT = 100000; // ₦1,000 in kobo
const maskAccountNumber = (accountNumber) => {
    if (!accountNumber)
        return "";
    if (accountNumber.length <= 4)
        return accountNumber;
    const visibleDigits = accountNumber.slice(-4);
    return `${"*".repeat(accountNumber.length - 4)}${visibleDigits}`;
};
const hasDedicatedAccount = (wallet) => Boolean((wallet === null || wallet === void 0 ? void 0 : wallet.dedicatedAccountNumber) && (wallet === null || wallet === void 0 ? void 0 : wallet.dedicatedBankName));
/**
 * @desc    Create wallet (customer gets DVA, rider/admin local wallet)
 * @route   POST /api/v1/wallet/create
 * @access  Private
 */
const createWallet = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b, _c, _d;
    try {
        const userId = (0, auth_middleware_1.getUserId)(req);
        console.log(`[Wallet] Incoming creation request for user: ${userId}`);
        if (!userId) {
            res.status(401).json({ message: "Unauthorized" });
            return;
        }
        const user = yield user_model_1.default.findById(userId);
        if (!user) {
            res.status(404).json({ message: "User not found" });
            return;
        }
        // Riders/admins use local wallet only.
        if (user.role !== "customer") {
            const wallet = yield (0, wallet_service_1.ensureWalletForUser)(userId);
            user.walletProvisioningStatus = "active";
            yield user.save();
            res.status(201).json({
                message: "Wallet created successfully",
                walletStatus: "active",
                wallet: {
                    id: wallet._id,
                    role: user.role,
                    balance: wallet.balance,
                    balanceInNaira: wallet.balance / 100,
                    accountNumber: wallet.dedicatedAccountNumber,
                    bankName: wallet.dedicatedBankName,
                    accountName: wallet.dedicatedAccountName,
                },
            });
            return;
        }
        let wallet = yield wallet_model_1.default.findOne({ userId });
        if (wallet && hasDedicatedAccount(wallet)) {
            user.walletProvisioningStatus = "active";
            yield user.save();
            res.status(200).json({
                message: "Wallet already active",
                walletStatus: "active",
                wallet: {
                    id: wallet._id,
                    role: user.role,
                    balance: wallet.balance,
                    balanceInNaira: wallet.balance / 100,
                    accountNumber: wallet.dedicatedAccountNumber,
                    bankName: wallet.dedicatedBankName,
                    accountName: wallet.dedicatedAccountName,
                },
            });
            return;
        }
        user.walletProvisioningStatus = "creating";
        yield user.save();
        try {
            const assignResponse = yield paystackService.assignDedicatedVirtualAccount({
                email: user.email,
                first_name: user.firstName,
                last_name: user.lastName,
                phone: user.phoneNumber,
                preferred_bank: "test-bank",
            });
            const dedicatedAccount = assignResponse.data;
            if (!wallet) {
                wallet = yield wallet_model_1.default.create({
                    userId,
                    paystackCustomerCode: dedicatedAccount.customer.customer_code,
                    dedicatedAccountNumber: dedicatedAccount.account_number,
                    dedicatedBankName: (_a = dedicatedAccount.bank) === null || _a === void 0 ? void 0 : _a.name,
                    dedicatedAccountName: dedicatedAccount.account_name,
                    dedicatedAccountReference: (_b = dedicatedAccount.assignment) === null || _b === void 0 ? void 0 : _b.toString(),
                });
            }
            else {
                wallet.paystackCustomerCode =
                    dedicatedAccount.customer.customer_code ||
                        wallet.paystackCustomerCode;
                wallet.dedicatedAccountNumber = dedicatedAccount.account_number;
                wallet.dedicatedBankName = (_c = dedicatedAccount.bank) === null || _c === void 0 ? void 0 : _c.name;
                wallet.dedicatedAccountName = dedicatedAccount.account_name;
                wallet.dedicatedAccountReference =
                    ((_d = dedicatedAccount.assignment) === null || _d === void 0 ? void 0 : _d.toString()) ||
                        wallet.dedicatedAccountReference;
                yield wallet.save();
            }
            user.walletProvisioningStatus = "active";
            yield user.save();
            res.status(201).json({
                message: "Wallet created successfully",
                walletStatus: "active",
                wallet: {
                    id: wallet._id,
                    role: user.role,
                    balance: wallet.balance,
                    balanceInNaira: wallet.balance / 100,
                    accountNumber: wallet.dedicatedAccountNumber,
                    bankName: wallet.dedicatedBankName,
                    accountName: wallet.dedicatedAccountName,
                },
            });
            return;
        }
        catch (dvaError) {
            user.walletProvisioningStatus = "creating";
            yield user.save();
            res.status(202).json({
                message: "Wallet is still being created. Please check again shortly.",
                walletStatus: "creating",
            });
            return;
        }
    }
    catch (error) {
        next(error);
    }
});
exports.createWallet = createWallet;
/**
 * @desc    Get wallet balance and virtual account info
 * @route   GET /api/v1/wallet/balance
 * @access  Private
 */
const getWalletBalance = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const userId = (0, auth_middleware_1.getUserId)(req);
        if (!userId) {
            res.status(401).json({ message: "Unauthorized" });
            return;
        }
        const [user, wallet] = yield Promise.all([
            user_model_1.default.findById(userId).select("role walletProvisioningStatus"),
            wallet_model_1.default.findOne({ userId }),
        ]);
        if (!user) {
            res.status(404).json({ message: "User not found" });
            return;
        }
        if (user.role === "customer" &&
            (!wallet || !hasDedicatedAccount(wallet))) {
            res.status(202).json({
                message: "Wallet is still being created. Please check again shortly.",
                walletStatus: "creating",
            });
            return;
        }
        if (!wallet) {
            res.status(404).json({
                message: "Wallet not found. Please create a wallet first.",
            });
            return;
        }
        res.status(200).json({
            wallet: {
                id: wallet._id,
                balance: wallet.balance,
                balanceInNaira: wallet.balance / 100,
                accountNumber: wallet.dedicatedAccountNumber,
                bankName: wallet.dedicatedBankName,
                accountName: wallet.dedicatedAccountName,
            },
        });
    }
    catch (error) {
        next(error);
    }
});
exports.getWalletBalance = getWalletBalance;
/**
 * @desc    Get wallet status for dashboard rendering (without exposing full account number)
 * @route   GET /api/v1/wallet/status
 * @access  Private
 */
const getWalletStatus = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b;
    try {
        const userId = (0, auth_middleware_1.getUserId)(req);
        if (!userId) {
            res.status(401).json({ message: "Unauthorized" });
            return;
        }
        const [user, wallet] = yield Promise.all([
            user_model_1.default.findById(userId).select("role walletProvisioningStatus"),
            wallet_model_1.default.findOne({ userId }),
        ]);
        if (!user) {
            res.status(404).json({ message: "User not found" });
            return;
        }
        if (user.role === "customer") {
            if (!wallet || !hasDedicatedAccount(wallet)) {
                const provisioningState = user.walletProvisioningStatus === "failed"
                    ? "failed"
                    : user.walletProvisioningStatus === "creating"
                        ? "creating"
                        : "not_created";
                res.status(200).json({
                    hasWallet: false,
                    walletStatus: provisioningState,
                    cta: provisioningState === "creating"
                        ? "wait_wallet_creation"
                        : "create_wallet",
                });
                return;
            }
            res.status(200).json({
                hasWallet: true,
                walletStatus: "active",
                wallet: {
                    id: wallet._id,
                    balance: wallet.balance,
                    balanceInNaira: wallet.balance / 100,
                    accountPreview: {
                        maskedAccountNumber: maskAccountNumber(wallet.dedicatedAccountNumber),
                        last4: ((_a = wallet.dedicatedAccountNumber) === null || _a === void 0 ? void 0 : _a.slice(-4)) || "",
                        bankName: wallet.dedicatedBankName || "",
                        accountName: wallet.dedicatedAccountName || "",
                    },
                },
            });
            return;
        }
        if (!wallet) {
            res.status(200).json({
                hasWallet: false,
                walletStatus: "not_created",
                cta: "create_wallet",
            });
            return;
        }
        res.status(200).json({
            hasWallet: true,
            walletStatus: "active",
            wallet: {
                id: wallet._id,
                balance: wallet.balance,
                balanceInNaira: wallet.balance / 100,
                accountPreview: {
                    maskedAccountNumber: maskAccountNumber(wallet.dedicatedAccountNumber),
                    last4: ((_b = wallet.dedicatedAccountNumber) === null || _b === void 0 ? void 0 : _b.slice(-4)) || "",
                    bankName: wallet.dedicatedBankName || "",
                    accountName: wallet.dedicatedAccountName || "",
                },
            },
        });
    }
    catch (error) {
        next(error);
    }
});
exports.getWalletStatus = getWalletStatus;
/**
 * @desc    Get transaction history
 * @route   GET /api/v1/wallet/transactions
 * @access  Private
 */
const getTransactions = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const userId = (0, auth_middleware_1.getUserId)(req);
        if (!userId) {
            res.status(401).json({ message: "Unauthorized" });
            return;
        }
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20;
        const skip = (page - 1) * limit;
        const [transactions, total] = yield Promise.all([
            transaction_model_1.default.find({ userId })
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limit),
            transaction_model_1.default.countDocuments({ userId }),
        ]);
        res.status(200).json({
            transactions,
            pagination: {
                page,
                limit,
                total,
                pages: Math.ceil(total / limit),
            },
        });
    }
    catch (error) {
        next(error);
    }
});
exports.getTransactions = getTransactions;
/**
 * @desc    Paystack webhook handler
 * @route   POST /api/v1/wallet/webhook
 * @access  Public (verified via Paystack signature)
 */
const handleWebhook = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    try {
        // 1. Verify Paystack signature
        const hash = crypto
            .createHmac("sha512", process.env.PAYSTACK_SECRET_KEY)
            .update(JSON.stringify(req.body))
            .digest("hex");
        const signature = req.get("x-paystack-signature");
        if (hash !== signature) {
            res.status(401).json({ message: "Invalid signature" });
            return;
        }
        const payload = req.body;
        const { event, data } = payload;
        // 2. Audit Log (as requested)
        yield log_model_1.default.create({
            event,
            payload,
            email: ((_a = data.customer) === null || _a === void 0 ? void 0 : _a.email) || data.email,
            success: !event.endsWith(".failed"),
        });
        // 3. Handle different event types
        switch (event) {
            case "charge.success":
                yield handleChargeSuccess(data);
                break;
            case "transfer.success":
                yield handleTransferSuccess(data);
                break;
            case "transfer.failed":
                yield handleTransferFailed(data);
                break;
            case "transfer.reversed":
                yield handleTransferReversed(data);
                break;
            case "dedicatedaccount.assign.success":
            case "dedicatedaccount.assignment.success":
                yield handleAccountAssignSuccess(payload.event, data);
                break;
            case "dedicatedaccount.assign.failed":
            case "dedicatedaccount.assignment.failed":
                yield handleAccountAssignFailed(data);
                break;
            default:
                console.log(`[Webhook] Unhandled event: ${event}`);
        }
        res.status(200).json({ message: "Webhook received" });
    }
    catch (error) {
        res.status(200).json({ message: "Webhook received with errors" });
    }
});
exports.handleWebhook = handleWebhook;
/**
 * Handle charge.success — credit user wallet when bank transfer lands
 */
const handleChargeSuccess = (data) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b;
    const reference = data.reference;
    // Prevent duplicate processing
    const existingTx = yield transaction_model_1.default.findOne({ reference });
    if (existingTx) {
        return;
    }
    // Find wallet by Paystack customer code
    const customerCode = (_a = data.customer) === null || _a === void 0 ? void 0 : _a.customer_code;
    if (!customerCode) {
        return;
    }
    const wallet = yield wallet_model_1.default.findOne({
        paystackCustomerCode: customerCode,
    });
    if (!wallet) {
        return;
    }
    const amountInKobo = data.amount; // Paystack sends amount in kobo
    // Credit wallet
    wallet.balance += amountInKobo;
    yield wallet.save();
    // Create transaction record
    yield transaction_model_1.default.create({
        userId: wallet.userId,
        type: "credit",
        source: "bank_transfer",
        amount: amountInKobo,
        reference,
        status: "success",
        description: `Wallet funded via bank transfer`,
        metadata: {
            channel: data.channel,
            bank: (_b = data.authorization) === null || _b === void 0 ? void 0 : _b.bank,
            paystackReference: reference,
        },
    });
});
/**
 * Handle transfer.success — mark withdrawal as successful
 */
const handleTransferSuccess = (data) => __awaiter(void 0, void 0, void 0, function* () {
    const reference = data.reference;
    const transaction = yield transaction_model_1.default.findOne({ reference });
    if (!transaction)
        return;
    transaction.status = "success";
    yield transaction.save();
});
/**
 * Handle transfer.failed — refund the user's wallet
 */
const handleTransferFailed = (data) => __awaiter(void 0, void 0, void 0, function* () {
    const reference = data.reference;
    const transaction = yield transaction_model_1.default.findOne({ reference });
    if (!transaction || transaction.status === "failed")
        return;
    transaction.status = "failed";
    yield transaction.save();
    // Refund the wallet
    const wallet = yield wallet_model_1.default.findOne({ userId: transaction.userId });
    if (wallet) {
        wallet.balance += transaction.amount;
        yield wallet.save();
    }
});
/**
 * Handle transfer.reversed — refund the user's wallet (same as failed)
 */
const handleTransferReversed = (data) => __awaiter(void 0, void 0, void 0, function* () {
    return handleTransferFailed(data);
});
/**
 * Handle DVA Assign Success
 * This is where the wallet is officially "activated" or created in our DB
 */
const handleAccountAssignSuccess = (event, data) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    const { customer, dedicated_account } = data;
    if (!dedicated_account)
        return;
    // High reliability check: Find or create wallet
    let wallet = yield wallet_model_1.default.findOne({ paystackCustomerCode: customer.customer_code });
    if (!wallet) {
        const user = yield user_model_1.default.findOne({ email: customer.email });
        if (user) {
            wallet = yield wallet_model_1.default.create({
                userId: user._id,
                paystackCustomerCode: customer.customer_code,
                dedicatedAccountNumber: dedicated_account.account_number,
                dedicatedBankName: dedicated_account.bank.name,
                dedicatedAccountName: dedicated_account.account_name,
                dedicatedAccountReference: ((_a = dedicated_account.assignment) === null || _a === void 0 ? void 0 : _a.toString()) || "assigned",
            });
        }
        else {
            return;
        }
    }
    else {
        // Update existing wallet
        wallet.dedicatedAccountNumber = dedicated_account.account_number;
        wallet.dedicatedBankName = dedicated_account.bank.name;
        wallet.dedicatedAccountName = dedicated_account.account_name;
        yield wallet.save();
    }
    yield user_model_1.default.findByIdAndUpdate(wallet.userId, {
        walletProvisioningStatus: "active",
    });
    // Broadcast to user room via Socket.io
    (0, socket_service_1.emitToRoom)(`user-${wallet.userId}`, "wallet_created", {
        message: "Your wallet has been created successfully!",
        wallet: {
            id: wallet._id,
            balance: wallet.balance,
            accountNumber: wallet.dedicatedAccountNumber,
            bankName: wallet.dedicatedBankName,
            accountName: wallet.dedicatedAccountName,
        }
    });
    // 4. Send Push Notification
    yield (0, notification_service_1.sendPushNotification)(wallet.userId.toString(), {
        title: "Wallet Created! 🎉",
        body: `Your RahaSend wallet is ready. Account: ${wallet.dedicatedAccountNumber} (${wallet.dedicatedBankName})`,
        data: {
            type: "wallet_creation",
            accountNumber: wallet.dedicatedAccountNumber,
            bankName: wallet.dedicatedBankName,
        },
    });
});
/**
 * Handle DVA Assign Failed
 */
const handleAccountAssignFailed = (data) => __awaiter(void 0, void 0, void 0, function* () {
    console.error(`[Webhook] DVA assignment failed for ${data.customer.email}`);
    yield user_model_1.default.findOneAndUpdate({ email: data.customer.email }, { walletProvisioningStatus: "failed" });
});
/**
 * @desc    List banks for withdrawal
 * @route   GET /api/v1/wallet/banks
 * @access  Private
 */
const getBanks = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const response = yield paystackService.listBanks();
        res.status(200).json({
            banks: response.data.map((bank) => ({
                name: bank.name,
                code: bank.code,
                slug: bank.slug,
            })),
        });
    }
    catch (error) {
        next(error);
    }
});
exports.getBanks = getBanks;
/**
 * @desc    Resolve bank account number
 * @route   POST /api/v1/wallet/resolve-account
 * @access  Private
 */
const resolveAccount = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    try {
        const { accountNumber, bankCode } = req.body;
        if (!accountNumber || !bankCode) {
            res.status(400).json({
                message: "Account number and bank code are required",
            });
            return;
        }
        const response = yield paystackService.resolveAccountNumber(accountNumber, bankCode);
        res.status(200).json({
            accountName: response.data.account_name,
            accountNumber: response.data.account_number,
            bankId: response.data.bank_id,
        });
    }
    catch (error) {
        if (((_a = error.response) === null || _a === void 0 ? void 0 : _a.status) === 422) {
            res.status(422).json({
                message: "Could not resolve account. Please check the details.",
            });
            return;
        }
        next(error);
    }
});
exports.resolveAccount = resolveAccount;
/**
 * @desc    Save rider's bank account + create Paystack transfer recipient
 * @route   POST /api/v1/wallet/bank-account
 * @access  Private (Rider)
 */
const saveBankAccount = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const userId = (0, auth_middleware_1.getUserId)(req);
        if (!userId) {
            res.status(401).json({ message: "Unauthorized" });
            return;
        }
        const { accountNumber, bankCode, bankName, accountName } = req.body;
        if (!accountNumber || !bankCode || !bankName || !accountName) {
            res.status(400).json({
                message: "All bank details are required",
            });
            return;
        }
        // Create transfer recipient on Paystack
        const recipientResponse = yield paystackService.createTransferRecipient(accountName, accountNumber, bankCode);
        const recipientCode = recipientResponse.data.recipient_code;
        // Upsert bank account
        const bankAccount = yield bank_account_model_1.default.findOneAndUpdate({ userId }, {
            userId,
            bankCode,
            bankName,
            accountNumber,
            accountName,
            paystackRecipientCode: recipientCode,
        }, { upsert: true, new: true });
        res.status(200).json({
            message: "Bank account saved successfully",
            bankAccount: {
                id: bankAccount._id,
                bankName: bankAccount.bankName,
                accountNumber: bankAccount.accountNumber,
                accountName: bankAccount.accountName,
            },
        });
    }
    catch (error) {
        next(error);
    }
});
exports.saveBankAccount = saveBankAccount;
/**
 * @desc    Get rider's saved bank account
 * @route   GET /api/v1/wallet/bank-account
 * @access  Private (Rider)
 */
const getBankAccount = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const userId = (0, auth_middleware_1.getUserId)(req);
        if (!userId) {
            res.status(401).json({ message: "Unauthorized" });
            return;
        }
        const bankAccount = yield bank_account_model_1.default.findOne({ userId });
        if (!bankAccount) {
            res.status(404).json({
                message: "No bank account found. Please add one.",
            });
            return;
        }
        res.status(200).json({
            bankAccount: {
                id: bankAccount._id,
                bankName: bankAccount.bankName,
                accountNumber: bankAccount.accountNumber,
                accountName: bankAccount.accountName,
            },
        });
    }
    catch (error) {
        next(error);
    }
});
exports.getBankAccount = getBankAccount;
/**
 * @desc    Rider initiates withdrawal from wallet to bank
 * @route   POST /api/v1/wallet/withdraw
 * @access  Private (Rider)
 */
const withdraw = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const userId = (0, auth_middleware_1.getUserId)(req);
        if (!userId) {
            res.status(401).json({ message: "Unauthorized" });
            return;
        }
        const { amount } = req.body; // amount in kobo
        if (!amount || amount <= 0) {
            res.status(400).json({ message: "Valid amount is required" });
            return;
        }
        if (amount < MIN_WITHDRAWAL_AMOUNT) {
            res.status(400).json({
                message: `Minimum withdrawal amount is ₦${MIN_WITHDRAWAL_AMOUNT / 100}`,
            });
            return;
        }
        // Check wallet balance
        const wallet = yield wallet_model_1.default.findOne({ userId });
        if (!wallet) {
            res.status(404).json({ message: "Wallet not found" });
            return;
        }
        if (wallet.balance < amount) {
            res.status(400).json({ message: "Insufficient balance" });
            return;
        }
        // Get bank account
        const bankAccount = yield bank_account_model_1.default.findOne({ userId });
        if (!bankAccount) {
            res.status(400).json({
                message: "Please add a bank account first",
            });
            return;
        }
        // Generate unique reference
        const reference = `WD-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
        // Debit wallet first
        wallet.balance -= amount;
        yield wallet.save();
        // Create pending transaction
        const transaction = yield transaction_model_1.default.create({
            userId,
            type: "debit",
            source: "withdrawal",
            amount,
            reference,
            status: "pending",
            description: `Withdrawal to ${bankAccount.bankName} - ${bankAccount.accountNumber}`,
            metadata: {
                bankName: bankAccount.bankName,
                accountNumber: bankAccount.accountNumber,
                accountName: bankAccount.accountName,
            },
        });
        // Initiate Paystack transfer
        try {
            yield paystackService.initiateTransfer(amount, bankAccount.paystackRecipientCode, `RahaSend withdrawal - ${reference}`, reference);
        }
        catch (transferError) {
            // If transfer fails, refund wallet and mark tx as failed
            wallet.balance += amount;
            yield wallet.save();
            transaction.status = "failed";
            yield transaction.save();
            res.status(500).json({
                message: "Withdrawal failed. Your wallet has been refunded.",
            });
            return;
        }
        res.status(200).json({
            message: "Withdrawal initiated successfully",
            transaction: {
                id: transaction._id,
                amount: transaction.amount,
                amountInNaira: transaction.amount / 100,
                reference: transaction.reference,
                status: transaction.status,
            },
        });
    }
    catch (error) {
        next(error);
    }
});
exports.withdraw = withdraw;
/**
 * Process payment for a completed delivery
 * Debits customer, credits rider (minus platform commission)
 */
const processDeliveryPayment = (customerId, riderId, deliveryId, feeInNaira) => __awaiter(void 0, void 0, void 0, function* () {
    const feeInKobo = Math.round(feeInNaira * 100);
    // 1. Get customer wallet
    const customerWallet = yield wallet_model_1.default.findOne({ userId: customerId });
    if (!customerWallet) {
        return { success: false, message: "Customer wallet not found" };
    }
    if (customerWallet.balance < feeInKobo) {
        return { success: false, message: "Insufficient balance in customer wallet" };
    }
    // 2. Get or create rider wallet
    let riderWallet = yield wallet_model_1.default.findOne({ userId: riderId });
    if (!riderWallet) {
        return { success: false, message: "Rider wallet not found" };
    }
    // 3. Calculate amounts
    const platformFee = Math.round(feeInKobo * PLATFORM_COMMISSION_RATE);
    const riderEarning = feeInKobo - platformFee;
    // 4. Debit customer
    customerWallet.balance -= feeInKobo;
    yield customerWallet.save();
    const debitReference = `DEL-D-${deliveryId}-${Date.now()}`;
    yield transaction_model_1.default.create({
        userId: customerId,
        type: "debit",
        source: "delivery_fee",
        amount: feeInKobo,
        reference: debitReference,
        status: "success",
        description: `Delivery fee for order`,
        metadata: { deliveryId, platformFee },
    });
    // 5. Credit rider
    riderWallet.balance += riderEarning;
    yield riderWallet.save();
    const creditReference = `DEL-C-${deliveryId}-${Date.now()}`;
    yield transaction_model_1.default.create({
        userId: riderId,
        type: "credit",
        source: "delivery_earning",
        amount: riderEarning,
        reference: creditReference,
        status: "success",
        description: `Earning from delivery`,
        metadata: { deliveryId, platformFee, totalFee: feeInKobo },
    });
    return { success: true, message: "Payment processed successfully" };
});
exports.processDeliveryPayment = processDeliveryPayment;
/**
 * @desc    Paystack callback handler (Redirects)
 * @route   GET /api/v1/wallet/callback
 * @access  Public
 */
const handleCallback = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { trxref, reference } = req.query;
    // Since most DVA work happens via webhooks, we just show a success message or redirect to app
    res.send(`
        <html>
            <body style="font-family: sans-serif; display: flex; align-items: center; justify-content: center; height: 100vh; flex-direction: column;">
                <h2 style="color: #f96007;">Payment Processing</h2>
                <p>You can now return to the RahaSend app.</p>
                <script>
                    setTimeout(() => window.close(), 3000);
                </script>
            </body>
        </html>
    `);
});
exports.handleCallback = handleCallback;
