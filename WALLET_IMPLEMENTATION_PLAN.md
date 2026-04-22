# Wallet Flow Implementation Plan

## Goal
Implement wallet UX where:
1. Users without wallet see a `Create Wallet` UI.
2. Wallet page does not display account number directly.
3. Clicking `Fund` opens a modal containing full account details.

## Backend Endpoints

### 1) Wallet Status (for page rendering)
**GET** `/api/v1/wallet/status`

- `200` (wallet not created):
```json
{
  "hasWallet": false,
  "walletStatus": "not_created",
  "cta": "create_wallet"
}
```

- `200` (wallet exists):
```json
{
  "hasWallet": true,
  "walletStatus": "active",
  "wallet": {
    "id": "6807e5f01b9f73e5dc123456",
    "balance": 325000,
    "balanceInNaira": 3250,
    "accountPreview": {
      "maskedAccountNumber": "******1234",
      "last4": "1234",
      "bankName": "Wema Bank",
      "accountName": "RAHASEND USER"
    }
  }
}
```

### 2) Create Wallet
**POST** `/api/v1/wallet/create`

- `201`:
```json
{
  "message": "Wallet created successfully",
  "wallet": {
    "id": "6807e5f01b9f73e5dc123456",
    "balance": 0,
    "accountNumber": "0123456789",
    "bankName": "Wema Bank",
    "accountName": "RAHASEND USER"
  }
}
```

### 3) Wallet Balance + Account Details (for fund modal)
**GET** `/api/v1/wallet/balance`

- `200`:
```json
{
  "wallet": {
    "id": "6807e5f01b9f73e5dc123456",
    "balance": 325000,
    "balanceInNaira": 3250,
    "accountNumber": "0123456789",
    "bankName": "Wema Bank",
    "accountName": "RAHASEND USER"
  }
}
```

- `404`:
```json
{
  "message": "Wallet not found. Please create a wallet first.",
  "code": "WALLET_NOT_FOUND"
}
```

### 4) Transactions
**GET** `/api/v1/wallet/transactions?page=1&limit=20`

## Frontend Flow

### A. Wallet Home Load
1. Call `GET /wallet/status` on screen focus.
2. If `hasWallet = false` show empty state with `Create Wallet`.
3. If `hasWallet = true` show balance card + actions.
4. Do not show full account number on this screen.

### B. Create Wallet Action
1. Tap `Create Wallet`.
2. Call `POST /wallet/create`.
3. On success, refetch `GET /wallet/status`.
4. Show toast: `Wallet created successfully`.

### C. Fund Wallet Action
1. Tap `Fund Wallet`.
2. Call `GET /wallet/balance`.
3. Open `Fund Wallet Modal`.
4. Show:
   - account name
   - bank name
   - full account number
5. Provide copy action and "I have sent payment" CTA.

## Suggested Frontend File Structure

```
src/features/wallet/
  components/
    WalletEmptyState.tsx
    WalletBalanceCard.tsx
    FundWalletModal.tsx
  screens/
    WalletHomeScreen.tsx
  services/
    wallet.api.ts
  store/
    useWalletStore.ts
  types/
    wallet.types.ts
```

## State Contract (TypeScript)

```ts
type WalletStatus = "loading" | "not_created" | "active" | "error";

interface WalletStoreState {
  walletStatus: WalletStatus;
  hasWallet: boolean;
  balance: number;
  balanceInNaira: number;
  accountPreview?: {
    maskedAccountNumber: string;
    last4: string;
    bankName: string;
    accountName: string;
  };
  fundingDetails?: {
    accountNumber: string;
    bankName: string;
    accountName: string;
  };
  fundModalVisible: boolean;
  loading: boolean;
  error?: string;
}
```

## Implementation Checklist

1. Add wallet API service methods for `status`, `create`, `balance`, and `transactions`.
2. Build wallet store with action-based state updates.
3. Build `WalletHomeScreen` with conditional rendering.
4. Build `WalletEmptyState` with `Create Wallet` button.
5. Build `FundWalletModal` and show full account details only there.
6. Add copy-to-clipboard action for account number.
7. Add error/loading/retry states for every request.
8. Add analytics events for `create_wallet_clicked`, `wallet_created`, `fund_modal_opened`, `account_number_copied`.
