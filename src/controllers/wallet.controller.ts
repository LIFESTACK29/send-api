import { Request, Response, NextFunction } from "express";
import * as crypto from "crypto";
import Wallet from "../models/wallet.model";
import Transaction from "../models/transaction.model";
import BankAccount from "../models/bank-account.model";
import User from "../models/user.model";
import { AuthRequest } from "../types/user.type";
import { getUserId } from "../middlewares/auth.middleware";
import * as paystackService from "../services/paystack.service";
import Log from "../models/log.model";
import { emitToRoom } from "../services/socket.service";
import { sendPushNotification } from "../services/notification.service";
import { ensureWalletForUser } from "../services/wallet.service";
import {
    PaystackWebhookPayload,
    ChargeData,
    TransferData,
    DedicatedAccountData,
} from "../types/paystack.type";

const PLATFORM_COMMISSION_RATE = 0.1; // 10%
const MIN_WITHDRAWAL_AMOUNT = 100000; // ₦1,000 in kobo

const maskAccountNumber = (accountNumber?: string): string => {
    if (!accountNumber) return "";
    if (accountNumber.length <= 4) return accountNumber;
    const visibleDigits = accountNumber.slice(-4);
    return `${"*".repeat(accountNumber.length - 4)}${visibleDigits}`;
};

/**
 * @desc    Create wallet (local wallet only, no DVA)
 * @route   POST /api/v1/wallet/create
 * @access  Private
 */
export const createWallet = async (
    req: AuthRequest,
    res: Response,
    next: NextFunction,
): Promise<void> => {
    try {
        const userId = getUserId(req);
        console.log(`[Wallet] Incoming creation request for user: ${userId}`);
        if (!userId) {
            res.status(401).json({ message: "Unauthorized" });
            return;
        }

        const wallet = await ensureWalletForUser(userId);

        res.status(201).json({
            message: "Wallet created successfully",
            wallet: {
                id: wallet._id,
                balance: wallet.balance,
                balanceInNaira: wallet.balance / 100,
            },
        });
    } catch (error: any) {
        next(error);
    }
};

/**
 * @desc    Get wallet balance and virtual account info
 * @route   GET /api/v1/wallet/balance
 * @access  Private
 */
export const getWalletBalance = async (
    req: AuthRequest,
    res: Response,
    next: NextFunction,
): Promise<void> => {
    try {
        const userId = getUserId(req);
        if (!userId) {
            res.status(401).json({ message: "Unauthorized" });
            return;
        }

        const wallet = await Wallet.findOne({ userId });

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
    } catch (error) {
        next(error);
    }
};

/**
 * @desc    Get wallet status for dashboard rendering (without exposing full account number)
 * @route   GET /api/v1/wallet/status
 * @access  Private
 */
export const getWalletStatus = async (
    req: AuthRequest,
    res: Response,
    next: NextFunction,
): Promise<void> => {
    try {
        const userId = getUserId(req);
        if (!userId) {
            res.status(401).json({ message: "Unauthorized" });
            return;
        }

        const wallet = await Wallet.findOne({ userId });

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
                    maskedAccountNumber: maskAccountNumber(
                        wallet.dedicatedAccountNumber,
                    ),
                    last4:
                        wallet.dedicatedAccountNumber?.slice(-4) || "",
                    bankName: wallet.dedicatedBankName || "",
                    accountName: wallet.dedicatedAccountName || "",
                },
            },
        });
    } catch (error) {
        next(error);
    }
};

/**
 * @desc    Get transaction history
 * @route   GET /api/v1/wallet/transactions
 * @access  Private
 */
export const getTransactions = async (
    req: AuthRequest,
    res: Response,
    next: NextFunction,
): Promise<void> => {
    try {
        const userId = getUserId(req);
        if (!userId) {
            res.status(401).json({ message: "Unauthorized" });
            return;
        }

        const page = parseInt(req.query.page as string) || 1;
        const limit = parseInt(req.query.limit as string) || 20;
        const skip = (page - 1) * limit;

        const [transactions, total] = await Promise.all([
            Transaction.find({ userId })
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limit),
            Transaction.countDocuments({ userId }),
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
    } catch (error) {
        next(error);
    }
};

/**
 * @desc    Paystack webhook handler
 * @route   POST /api/v1/wallet/webhook
 * @access  Public (verified via Paystack signature)
 */
export const handleWebhook = async (
    req: Request,
    res: Response,
    next: NextFunction,
): Promise<void> => {
    try {
        // 1. Verify Paystack signature
        const hash = crypto
            .createHmac("sha512", process.env.PAYSTACK_SECRET_KEY as string)
            .update(JSON.stringify(req.body))
            .digest("hex");

        const signature = req.get("x-paystack-signature");
        if (hash !== signature) {
            res.status(401).json({ message: "Invalid signature" });
            return;
        }

        const payload = req.body as unknown as PaystackWebhookPayload;
        const { event, data } = payload;
        // 2. Audit Log (as requested)
        await Log.create({
            event,
            payload,
            email: data.customer?.email || data.email,
            success: !event.endsWith(".failed"),
        });

        // 3. Handle different event types
        switch (event) {
            case "charge.success":
                await handleChargeSuccess(data as ChargeData);
                break;

            case "transfer.success":
                await handleTransferSuccess(data as TransferData);
                break;

            case "transfer.failed":
                await handleTransferFailed(data as TransferData);
                break;

            case "transfer.reversed":
                await handleTransferReversed(data as TransferData);
                break;

            case "dedicatedaccount.assign.success":
            case "dedicatedaccount.assignment.success":
                await handleAccountAssignSuccess(payload.event, data as DedicatedAccountData);
                break;

            case "dedicatedaccount.assign.failed":
            case "dedicatedaccount.assignment.failed":
                await handleAccountAssignFailed(data as DedicatedAccountData);
                break;

            default:
                console.log(`[Webhook] Unhandled event: ${event}`);
        }

        res.status(200).json({ message: "Webhook received" });
    } catch (error) {
        res.status(200).json({ message: "Webhook received with errors" });
    }
};

/**
 * Handle charge.success — credit user wallet when bank transfer lands
 */
const handleChargeSuccess = async (data: any) => {
    const reference = data.reference;

    // Prevent duplicate processing
    const existingTx = await Transaction.findOne({ reference });
    if (existingTx) {
        return;
    }

    // Find wallet by Paystack customer code
    const customerCode = data.customer?.customer_code;
    if (!customerCode) {
        return;
    }

    const wallet = await Wallet.findOne({
        paystackCustomerCode: customerCode,
    });

    if (!wallet) {
        return;
    }

    const amountInKobo = data.amount; // Paystack sends amount in kobo

    // Credit wallet
    wallet.balance += amountInKobo;
    await wallet.save();

    // Create transaction record
    await Transaction.create({
        userId: wallet.userId,
        type: "credit",
        source: "bank_transfer",
        amount: amountInKobo,
        reference,
        status: "success",
        description: `Wallet funded via bank transfer`,
        metadata: {
            channel: data.channel,
            bank: data.authorization?.bank,
            paystackReference: reference,
        },
    });

};

/**
 * Handle transfer.success — mark withdrawal as successful
 */
const handleTransferSuccess = async (data: TransferData) => {
    const reference = data.reference;

    const transaction = await Transaction.findOne({ reference });
    if (!transaction) return;

    transaction.status = "success";
    await transaction.save();

};

/**
 * Handle transfer.failed — refund the user's wallet
 */
const handleTransferFailed = async (data: TransferData) => {
    const reference = data.reference;

    const transaction = await Transaction.findOne({ reference });
    if (!transaction || transaction.status === "failed") return;

    transaction.status = "failed";
    await transaction.save();

    // Refund the wallet
    const wallet = await Wallet.findOne({ userId: transaction.userId });
    if (wallet) {
        wallet.balance += transaction.amount;
        await wallet.save();
    }
};

/**
 * Handle transfer.reversed — refund the user's wallet (same as failed)
 */
const handleTransferReversed = async (data: TransferData) => {
    return handleTransferFailed(data);
};

/**
 * Handle DVA Assign Success
 * This is where the wallet is officially "activated" or created in our DB
 */
const handleAccountAssignSuccess = async (event: string, data: DedicatedAccountData) => {
    const { customer, dedicated_account } = data;
    if (!dedicated_account) return;

    // High reliability check: Find or create wallet
    let wallet = await Wallet.findOne({ paystackCustomerCode: customer.customer_code });

    if (!wallet) {
        // Fallback: Find user by email if wallet doesn't exist yet
        const user = await User.findOne({ email: customer.email });
        if (user) {
            wallet = await Wallet.create({
                userId: user._id,
                paystackCustomerCode: customer.customer_code,
                dedicatedAccountNumber: dedicated_account.account_number,
                dedicatedBankName: dedicated_account.bank.name,
                dedicatedAccountName: dedicated_account.account_name,
                dedicatedAccountReference: dedicated_account.assignment?.toString() || "assigned",
            });
        } else {
            return;
        }
    } else {
        // Update existing wallet
        wallet.dedicatedAccountNumber = dedicated_account.account_number;
        wallet.dedicatedBankName = dedicated_account.bank.name;
        wallet.dedicatedAccountName = dedicated_account.account_name;
        await wallet.save();
    }

    // Broadcast to user room via Socket.io
    emitToRoom(`user-${wallet.userId}`, "wallet_created", {
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
    await sendPushNotification(wallet.userId.toString(), {
        title: "Wallet Created! 🎉",
        body: `Your RahaSend wallet is ready. Account: ${wallet.dedicatedAccountNumber} (${wallet.dedicatedBankName})`,
        data: {
            type: "wallet_creation",
            accountNumber: wallet.dedicatedAccountNumber,
            bankName: wallet.dedicatedBankName,
        },
    });
};

/**
 * Handle DVA Assign Failed
 */
const handleAccountAssignFailed = async (data: DedicatedAccountData) => {
    console.error(
        `[Webhook] DVA assignment failed for ${data.customer.email}`,
    );
};

/**
 * @desc    List banks for withdrawal
 * @route   GET /api/v1/wallet/banks
 * @access  Private
 */
export const getBanks = async (
    req: AuthRequest,
    res: Response,
    next: NextFunction,
): Promise<void> => {
    try {
        const response = await paystackService.listBanks();

        res.status(200).json({
            banks: response.data.map((bank: any) => ({
                name: bank.name,
                code: bank.code,
                slug: bank.slug,
            })),
        });
    } catch (error: any) {
        next(error);
    }
};

/**
 * @desc    Resolve bank account number
 * @route   POST /api/v1/wallet/resolve-account
 * @access  Private
 */
export const resolveAccount = async (
    req: AuthRequest,
    res: Response,
    next: NextFunction,
): Promise<void> => {
    try {
        const { accountNumber, bankCode } = req.body;

        if (!accountNumber || !bankCode) {
            res.status(400).json({
                message: "Account number and bank code are required",
            });
            return;
        }

        const response = await paystackService.resolveAccountNumber(
            accountNumber,
            bankCode,
        );

        res.status(200).json({
            accountName: response.data.account_name,
            accountNumber: response.data.account_number,
            bankId: response.data.bank_id,
        });
    } catch (error: any) {
        if (error.response?.status === 422) {
            res.status(422).json({
                message: "Could not resolve account. Please check the details.",
            });
            return;
        }
        next(error);
    }
};

/**
 * @desc    Save rider's bank account + create Paystack transfer recipient
 * @route   POST /api/v1/wallet/bank-account
 * @access  Private (Rider)
 */
export const saveBankAccount = async (
    req: AuthRequest,
    res: Response,
    next: NextFunction,
): Promise<void> => {
    try {
        const userId = getUserId(req);
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
        const recipientResponse =
            await paystackService.createTransferRecipient(
                accountName,
                accountNumber,
                bankCode,
            );

        const recipientCode = recipientResponse.data.recipient_code;

        // Upsert bank account
        const bankAccount = await BankAccount.findOneAndUpdate(
            { userId },
            {
                userId,
                bankCode,
                bankName,
                accountNumber,
                accountName,
                paystackRecipientCode: recipientCode,
            },
            { upsert: true, new: true },
        );

        res.status(200).json({
            message: "Bank account saved successfully",
            bankAccount: {
                id: bankAccount._id,
                bankName: bankAccount.bankName,
                accountNumber: bankAccount.accountNumber,
                accountName: bankAccount.accountName,
            },
        });
    } catch (error: any) {
        next(error);
    }
};

/**
 * @desc    Get rider's saved bank account
 * @route   GET /api/v1/wallet/bank-account
 * @access  Private (Rider)
 */
export const getBankAccount = async (
    req: AuthRequest,
    res: Response,
    next: NextFunction,
): Promise<void> => {
    try {
        const userId = getUserId(req);
        if (!userId) {
            res.status(401).json({ message: "Unauthorized" });
            return;
        }

        const bankAccount = await BankAccount.findOne({ userId });

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
    } catch (error) {
        next(error);
    }
};

/**
 * @desc    Rider initiates withdrawal from wallet to bank
 * @route   POST /api/v1/wallet/withdraw
 * @access  Private (Rider)
 */
export const withdraw = async (
    req: AuthRequest,
    res: Response,
    next: NextFunction,
): Promise<void> => {
    try {
        const userId = getUserId(req);
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
        const wallet = await Wallet.findOne({ userId });
        if (!wallet) {
            res.status(404).json({ message: "Wallet not found" });
            return;
        }

        if (wallet.balance < amount) {
            res.status(400).json({ message: "Insufficient balance" });
            return;
        }

        // Get bank account
        const bankAccount = await BankAccount.findOne({ userId });
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
        await wallet.save();

        // Create pending transaction
        const transaction = await Transaction.create({
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
            await paystackService.initiateTransfer(
                amount,
                bankAccount.paystackRecipientCode,
                `RahaSend withdrawal - ${reference}`,
                reference,
            );
        } catch (transferError: any) {
            // If transfer fails, refund wallet and mark tx as failed
            wallet.balance += amount;
            await wallet.save();

            transaction.status = "failed";
            await transaction.save();

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
    } catch (error) {
        next(error);
    }
};

/**
 * Process payment for a completed delivery
 * Debits customer, credits rider (minus platform commission)
 */
export const processDeliveryPayment = async (
    customerId: string,
    riderId: string,
    deliveryId: string,
    feeInNaira: number,
): Promise<{ success: boolean; message: string }> => {
    const feeInKobo = Math.round(feeInNaira * 100);

    // 1. Get customer wallet
    const customerWallet = await Wallet.findOne({ userId: customerId });
    if (!customerWallet) {
        return { success: false, message: "Customer wallet not found" };
    }

    if (customerWallet.balance < feeInKobo) {
        return { success: false, message: "Insufficient balance in customer wallet" };
    }

    // 2. Get or create rider wallet
    let riderWallet = await Wallet.findOne({ userId: riderId });
    if (!riderWallet) {
        return { success: false, message: "Rider wallet not found" };
    }

    // 3. Calculate amounts
    const platformFee = Math.round(feeInKobo * PLATFORM_COMMISSION_RATE);
    const riderEarning = feeInKobo - platformFee;

    // 4. Debit customer
    customerWallet.balance -= feeInKobo;
    await customerWallet.save();

    const debitReference = `DEL-D-${deliveryId}-${Date.now()}`;
    await Transaction.create({
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
    await riderWallet.save();

    const creditReference = `DEL-C-${deliveryId}-${Date.now()}`;
    await Transaction.create({
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
};

/**
 * @desc    Paystack callback handler (Redirects)
 * @route   GET /api/v1/wallet/callback
 * @access  Public
 */
export const handleCallback = async (
    req: Request,
    res: Response,
): Promise<void> => {
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
};
