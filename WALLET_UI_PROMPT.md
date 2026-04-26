# Wallet UI Prompt (Mobile App)

Use this exact prompt for wallet flow implementation:

## Prompt
Build the wallet screen using backend wallet states and responses.

Rules:
1. Always call `GET /api/v1/wallet/status` when wallet screen opens.
2. If `walletStatus` is `not_created`, show a `Create Wallet` button.
3. If `walletStatus` is `creating`, show a loading state:
   - Title: `Creating your wallet...`
   - Subtitle: `Please wait while we set up your account details.`
   - Poll `GET /api/v1/wallet/status` every 3 to 5 seconds until status changes.
4. If `walletStatus` is `failed`, show:
   - Title: `Wallet setup failed`
   - Action button: `Try Again` (calls `POST /api/v1/wallet/create`).
5. If `walletStatus` is `active`, show wallet card with:
   - `balance` / `balanceInNaira`
   - `maskedAccountNumber`
   - `bankName`
   - `accountName`

Create wallet action:
1. On `Create Wallet` tap, call `POST /api/v1/wallet/create`.
2. If response is `201/200` and `walletStatus = active`, render account details immediately.
3. If response is `202` and `walletStatus = creating`, switch to creating state and start polling status endpoint.

Balance endpoint handling:
1. `GET /api/v1/wallet/balance` can return `walletStatus = creating` for customers.
2. If that happens, do not show error; show `Creating your wallet...` state and continue polling `GET /wallet/status`.

Role behavior:
1. Customer: can be `not_created`, `creating`, `failed`, or `active` (DVA-backed).
2. Rider: wallet is local; typically active after onboarding completion.

## UI Copy
1. Not created: `Create your wallet to start funding and payments.`
2. Creating: `Your wallet is being created. This usually takes a few seconds.`
3. Failed: `We couldn't complete wallet setup. Please try again.`
4. Active: `Wallet ready`

## Expected Response Samples

### `GET /api/v1/wallet/status` (not_created)
```json
{
  "hasWallet": false,
  "walletStatus": "not_created",
  "cta": "create_wallet"
}
```

### `GET /api/v1/wallet/status` (creating)
```json
{
  "hasWallet": false,
  "walletStatus": "creating",
  "cta": "wait_wallet_creation"
}
```

### `GET /api/v1/wallet/status` (failed)
```json
{
  "hasWallet": false,
  "walletStatus": "failed",
  "cta": "create_wallet"
}
```

### `GET /api/v1/wallet/status` (active)
```json
{
  "hasWallet": true,
  "walletStatus": "active",
  "wallet": {
    "id": "WALLET_ID",
    "balance": 0,
    "balanceInNaira": 0,
    "accountPreview": {
      "maskedAccountNumber": "******1234",
      "last4": "1234",
      "bankName": "Test Bank",
      "accountName": "John Doe"
    }
  }
}
```

### `POST /api/v1/wallet/create` (creating)
```json
{
  "message": "Wallet is still being created. Please check again shortly.",
  "walletStatus": "creating"
}
```

### `POST /api/v1/wallet/create` (active)
```json
{
  "message": "Wallet created successfully",
  "walletStatus": "active",
  "wallet": {
    "id": "WALLET_ID",
    "role": "customer",
    "balance": 0,
    "balanceInNaira": 0,
    "accountNumber": "0123456789",
    "bankName": "Test Bank",
    "accountName": "John Doe"
  }
}
```
