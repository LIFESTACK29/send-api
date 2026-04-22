"use strict";
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
exports.initiateTransfer = exports.createTransferRecipient = exports.resolveAccountNumber = exports.listBanks = exports.verifyTransaction = exports.createDedicatedVirtualAccount = exports.assignDedicatedVirtualAccount = exports.createCustomer = void 0;
const axios_1 = __importDefault(require("axios"));
const PAYSTACK_BASE_URL = "https://api.paystack.co";
const paystackApi = axios_1.default.create({
    baseURL: PAYSTACK_BASE_URL,
    headers: {
        Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
        "Content-Type": "application/json",
    },
});
/**
 * Create a Paystack customer
 */
const createCustomer = (email, firstName, lastName, phone) => __awaiter(void 0, void 0, void 0, function* () {
    const { data } = yield paystackApi.post("/customer", {
        email,
        first_name: firstName,
        last_name: lastName,
        phone,
    });
    return data;
});
exports.createCustomer = createCustomer;
/**
 * Assign a Dedicated Virtual Account (combined customer/DVA creation)
 */
const assignDedicatedVirtualAccount = (payload) => __awaiter(void 0, void 0, void 0, function* () {
    const { data } = yield paystackApi.post("/dedicated_account/assign", Object.assign(Object.assign({}, payload), { preferred_bank: payload.preferred_bank || "test-bank", country: "NG" }));
    return data;
});
exports.assignDedicatedVirtualAccount = assignDedicatedVirtualAccount;
/**
 * Create a Dedicated Virtual Account for an existing customer
 */
const createDedicatedVirtualAccount = (customerCode, preferredBank) => __awaiter(void 0, void 0, void 0, function* () {
    const { data } = yield paystackApi.post("/dedicated_account", {
        customer: customerCode,
        preferred_bank: "test-bank", // Default for test/live
    });
    return data;
});
exports.createDedicatedVirtualAccount = createDedicatedVirtualAccount;
/**
 * Verify a Paystack transaction by reference
 */
const verifyTransaction = (reference) => __awaiter(void 0, void 0, void 0, function* () {
    const { data } = yield paystackApi.get(`/transaction/verify/${reference}`);
    return data;
});
exports.verifyTransaction = verifyTransaction;
/**
 * List banks supported by Paystack
 */
const listBanks = () => __awaiter(void 0, void 0, void 0, function* () {
    const { data } = yield paystackApi.get("/bank", {
        params: { country: "nigeria", perPage: 100 },
    });
    return data;
});
exports.listBanks = listBanks;
/**
 * Resolve a bank account number to get the account name
 */
const resolveAccountNumber = (accountNumber, bankCode) => __awaiter(void 0, void 0, void 0, function* () {
    const { data } = yield paystackApi.get("/bank/resolve", {
        params: { account_number: accountNumber, bank_code: bankCode },
    });
    return data;
});
exports.resolveAccountNumber = resolveAccountNumber;
/**
 * Create a transfer recipient (for rider withdrawal)
 */
const createTransferRecipient = (name, accountNumber, bankCode) => __awaiter(void 0, void 0, void 0, function* () {
    const { data } = yield paystackApi.post("/transferrecipient", {
        type: "nuban",
        name,
        account_number: accountNumber,
        bank_code: bankCode,
        currency: "NGN",
    });
    return data;
});
exports.createTransferRecipient = createTransferRecipient;
/**
 * Initiate a transfer to a recipient (withdrawal)
 */
const initiateTransfer = (amount, // in kobo
recipientCode, reason, reference) => __awaiter(void 0, void 0, void 0, function* () {
    const { data } = yield paystackApi.post("/transfer", {
        source: "balance",
        amount,
        recipient: recipientCode,
        reason,
        reference,
    });
    return data;
});
exports.initiateTransfer = initiateTransfer;
exports.default = {
    createCustomer: exports.createCustomer,
    createDedicatedVirtualAccount: exports.createDedicatedVirtualAccount,
    assignDedicatedVirtualAccount: exports.assignDedicatedVirtualAccount,
    verifyTransaction: exports.verifyTransaction,
    listBanks: exports.listBanks,
    resolveAccountNumber: exports.resolveAccountNumber,
    createTransferRecipient: exports.createTransferRecipient,
    initiateTransfer: exports.initiateTransfer,
};
