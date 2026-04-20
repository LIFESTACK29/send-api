export interface CustomerIdentificationData {
    customer_id: number | string;
    customer_code: string;
    email: string;
    identification: {
        country: string;
        type: string;
        value?: string;
        bvn?: string;
        account_number?: string;
        bank_code?: string;
    };
    reason?: string;
}

export interface DedicatedAccountCustomer {
    id: number;
    first_name: string;
    last_name: string;
    email: string;
    customer_code: string;
    phone: string;
    metadata: Record<string, unknown>;
    risk_action: string;
    international_format_phone: string;
}

export interface DedicatedAccountBank {
    name: string;
    id: number;
    slug: string;
}

export interface DedicatedAccountAssignment {
    integration: number;
    assignee_id: number;
    assignee_type: string;
    expired: boolean;
    account_type: string;
    assigned_at: string;
    expired_at: string | null;
}

export interface DedicatedAccountDetails {
    bank: DedicatedAccountBank;
    account_name: string;
    account_number: string;
    assigned: boolean;
    currency: string;
    metadata: Record<string, unknown> | null;
    active: boolean;
    id: number;
    created_at: string;
    updated_at: string;
    assignment: DedicatedAccountAssignment;
}

export interface DedicatedAccountData {
    customer: DedicatedAccountCustomer;
    dedicated_account: DedicatedAccountDetails | null;
    identification: {
        status: string;
    };
}

export interface TransferIntegration {
    id: number;
    is_live: boolean;
    business_name: string;
    logo_path?: string;
}

export interface TransferRecipientDetails {
    authorization_code: string | null;
    account_number: string;
    account_name: string | null;
    bank_code: string;
    bank_name: string;
}

export interface TransferRecipient {
    active: boolean;
    createdAt?: string;
    created_at?: string;
    currency: string;
    description: string | null;
    domain: string;
    email: string | null;
    id: number;
    integration: number;
    metadata: Record<string, unknown> | null;
    name: string;
    recipient_code: string;
    type: string;
    updatedAt?: string;
    updated_at?: string;
    is_deleted: boolean;
    details: TransferRecipientDetails;
}

export interface TransferSession {
    provider: string | null;
    id: string | null;
}

export interface TransferData {
    amount: number;
    createdAt?: string;
    created_at?: string;
    currency: string;
    domain: string;
    failures: unknown;
    id: number;
    integration: TransferIntegration;
    reason: string;
    reference: string;
    source: string;
    source_details: unknown;
    status: "success" | "failed" | "reversed";
    titan_code: string | null;
    transfer_code: string;
    transferred_at: string | null;
    updatedAt?: string;
    updated_at?: string;
    recipient: TransferRecipient;
    session: TransferSession;
    fee_charged?: number;
    gateway_response?: string | null;
}

export interface ChargeData {
    amount: number;
    authorization: {
        authorization_code: string;
        sender_bank: string;
        sender_bank_account_number: string;
    };
    customer: DedicatedAccountCustomer;
    reference: string;
    status: "success" | "failed" | "pending";
    created_at: Date;
    paid_at: Date;
    channel: string;
}

export type PaystackEvent =
    | "customeridentification.failed"
    | "customeridentification.success"
    | "dedicatedaccount.assign.failed"
    | "dedicatedaccount.assign.success"
    | "dedicatedaccount.assignment.failed"
    | "dedicatedaccount.assignment.success"
    | "transfer.success"
    | "transfer.failed"
    | "transfer.reversed"
    | "charge.success";

export interface PaystackWebhookPayload {
    event: PaystackEvent;
    data: any; // We cast this based on event type
}
