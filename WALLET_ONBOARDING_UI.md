# Prompt for AI - Generate Wallet Flow UI (Expo React Native)

Copy and paste this entire prompt into ChatGPT, Claude, or your preferred AI tool.

---

## PROMPT START

I'm building a wallet flow for my Expo React Native app. I want the wallet experience to follow the same structure and quality as my onboarding flow.

### PROJECT CONTEXT

**Tech Stack:**
- React Native with Expo
- TypeScript
- React Navigation
- Async Storage
- Zustand (preferred) or Context API
- Fetch API / Axios

**Backend Base URL:**
```
https://api.raha.com/api/v1
```

**Important Wallet UX Rules:**
1. Do not show account number directly on the wallet page.
2. Show only wallet balance and action buttons (`Fund`, `Withdraw`, `Transactions`).
3. When user clicks `Fund`, open a modal and show full account details inside the modal.
4. If user has no wallet, show a clean empty state with `Create Wallet` CTA.

---

## REQUIREMENT 1: WALLET STATE MANAGEMENT

Create a `useWalletStore.ts` with:
- `hasWallet: boolean`
- `walletStatus: "loading" | "not_created" | "active" | "error"`
- `walletSummary` (balance, masked account preview)
- `fundingDetails` (accountNumber, bankName, accountName)
- `transactions`
- actions:
  - `fetchWalletStatus()`
  - `createWallet()`
  - `openFundModal()`
  - `fetchWalletBalance()`
  - `fetchTransactions(page?: number)`
  - `refreshWallet()`

Use loading and error states for all async actions.

---

## REQUIREMENT 2: SCREEN FLOW

Create wallet flow screens/components:

1. **WalletHomeScreen**
   - Top card: wallet balance
   - Buttons: `Fund Wallet`, `Withdraw`, `Transactions`
   - Must NOT show full account number here
   - If `hasWallet === false`, show `WalletEmptyState`

2. **WalletEmptyState**
   - Friendly message: "You don't have a wallet yet"
   - Show benefits text
   - Primary CTA: `Create Wallet`
   - Secondary CTA: `Maybe Later`

3. **FundWalletModal**
   - Open only when user taps `Fund Wallet`
   - Fetch and show:
     - account name
     - bank name
     - account number (full)
   - Include:
     - `Copy Account Number`
     - `I have sent payment` button
   - Show transfer instructions and note that wallet balance updates automatically after webhook.

---

## REQUIREMENT 3: API INTEGRATION

### 1) Check wallet status (page load)
`GET /wallet/status`

Success when wallet does not exist:
```json
{
  "hasWallet": false,
  "walletStatus": "not_created",
  "cta": "create_wallet"
}
```

Success when wallet exists:
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

### 2) Create wallet
`POST /wallet/create`

Success response:
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

### 3) Fetch wallet balance/details (on Fund button click)
`GET /wallet/balance`

Success response:
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

Wallet missing:
```json
{
  "message": "Wallet not found. Please create a wallet first.",
  "code": "WALLET_NOT_FOUND"
}
```

### 4) Transactions list
`GET /wallet/transactions?page=1&limit=20`

---

## REQUIREMENT 4: UI BEHAVIOR RULES

1. On screen focus, call `fetchWalletStatus()`.
2. If `not_created`, render `WalletEmptyState`.
3. On `Create Wallet`, call `POST /wallet/create`, then refetch status and show success toast.
4. On `Fund Wallet`, call `GET /wallet/balance` then open modal.
5. Copy button should copy account number and show "Copied!" feedback.
6. Keep all account details inside the modal only.

---

## REQUIREMENT 5: COMPONENTS TO GENERATE

Generate:
- `src/features/wallet/screens/WalletHomeScreen.tsx`
- `src/features/wallet/components/WalletEmptyState.tsx`
- `src/features/wallet/components/FundWalletModal.tsx`
- `src/features/wallet/store/useWalletStore.ts`
- `src/features/wallet/services/wallet.api.ts`
- `src/features/wallet/types/wallet.types.ts`

Also generate:
- API service methods with auth token support
- Reusable loading and error states
- Proper TypeScript interfaces for all wallet responses

---

## REQUIREMENT 6: DESIGN AND INTERACTION

Use clean UI to match existing auth/onboarding style:
- White background
- Rounded cards/buttons
- Clear hierarchy for balance/action buttons
- Subtle shadows
- Proper empty/loading/error states
- Smooth modal animation
- Mobile-first spacing

## PROMPT END
