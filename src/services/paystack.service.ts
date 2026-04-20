import axios from "axios";

const PAYSTACK_BASE_URL = "https://api.paystack.co";

const paystackApi = axios.create({
    baseURL: PAYSTACK_BASE_URL,
    headers: {
        Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
        "Content-Type": "application/json",
    },
});

/**
 * Create a Paystack customer
 */
export const createCustomer = async (
    email: string,
    firstName: string,
    lastName: string,
    phone: string,
) => {
    const { data } = await paystackApi.post("/customer", {
        email,
        first_name: firstName,
        last_name: lastName,
        phone,
    });
    return data;
};

/**
 * Assign a Dedicated Virtual Account (combined customer/DVA creation)
 */
export const assignDedicatedVirtualAccount = async (payload: {
    email: string;
    first_name: string;
    last_name: string;
    phone: string;
    preferred_bank?: string;
}) => {
    const { data } = await paystackApi.post("/dedicated_account/assign", {
        ...payload,
        preferred_bank: payload.preferred_bank || "test-bank",
        country: "NG",
    });
    return data;
};

/**
 * Create a Dedicated Virtual Account for an existing customer
 */
export const createDedicatedVirtualAccount = async (
    customerCode: string,
    preferredBank?: string,
) => {
    const { data } = await paystackApi.post("/dedicated_account", {
        customer: customerCode,
        preferred_bank: "test-bank", // Default for test/live
    });
    return data;
};

/**
 * Verify a Paystack transaction by reference
 */
export const verifyTransaction = async (reference: string) => {
    const { data } = await paystackApi.get(
        `/transaction/verify/${reference}`,
    );
    return data;
};

/**
 * List banks supported by Paystack
 */
export const listBanks = async () => {
    const { data } = await paystackApi.get("/bank", {
        params: { country: "nigeria", perPage: 100 },
    });
    return data;
};

/**
 * Resolve a bank account number to get the account name
 */
export const resolveAccountNumber = async (
    accountNumber: string,
    bankCode: string,
) => {
    const { data } = await paystackApi.get("/bank/resolve", {
        params: { account_number: accountNumber, bank_code: bankCode },
    });
    return data;
};

/**
 * Create a transfer recipient (for rider withdrawal)
 */
export const createTransferRecipient = async (
    name: string,
    accountNumber: string,
    bankCode: string,
) => {
    const { data } = await paystackApi.post("/transferrecipient", {
        type: "nuban",
        name,
        account_number: accountNumber,
        bank_code: bankCode,
        currency: "NGN",
    });
    return data;
};

/**
 * Initiate a transfer to a recipient (withdrawal)
 */
export const initiateTransfer = async (
    amount: number, // in kobo
    recipientCode: string,
    reason: string,
    reference?: string,
) => {
    const { data } = await paystackApi.post("/transfer", {
        source: "balance",
        amount,
        recipient: recipientCode,
        reason,
        reference,
    });
    return data;
};

export default {
    createCustomer,
    createDedicatedVirtualAccount,
    assignDedicatedVirtualAccount,
    verifyTransaction,
    listBanks,
    resolveAccountNumber,
    createTransferRecipient,
    initiateTransfer,
};
