# Frontend Reconciliation: Onboarding + Settings Documents

## Main Change
1. Documents are no longer part of onboarding steps.
2. Riders upload documents from Settings.
3. Rider remains `inactive` until required settings documents are uploaded and admin sets rider to `active`.

## Routing Source Of Truth
Use `accessState` from:
1. `POST /api/v1/auth/login`
2. `GET /api/v1/auth/me`
3. `GET /api/v1/onboarding/state`
4. `GET /api/v1/user/profile`
5. `GET /api/v1/riders/:userId/onboarding-status`

If `accessState.canAccessHome` is `false`, route by `accessState.nextStep`.

## Next Steps
1. `email_otp`
2. `profile_image`
3. `vehicle_details`
4. `submit_verification`
5. `pending_admin_approval`
6. `settings_documents`
7. `home`

## Vehicle Rules (Backend-Enforced)
1. `BICYCLE`: required `color`
2. `MOTORCYCLE`: required `color`, `licensePlate`
3. `TRICYCLE`: required `color`, `licensePlate`
4. `CAR`: required `brand`, `model`, `year`, `color`, `licensePlate`

## Onboarding Completion (No Documents)
Onboarding is complete when rider has:
1. email verified
2. profile image
3. vehicle selected
4. vehicle details complete (by vehicle type)
5. vehicle image
6. submitted for verification

## Settings Document Compliance
Required document types:
1. `DRIVING_LICENSE`
2. `GOVERNMENT_ID`
3. `INSURANCE`
4. `REGISTRATION`

If any are missing:
1. `accessState.canAccessHome = false`
2. `accessState.nextStep = "settings_documents"`
3. rider should remain `inactive`

## Key Response Example (Settings Documents Missing)
```json
{
  "accessState": {
    "onboardingStage": "approved",
    "verificationStatus": "approved",
    "onboardingRequired": false,
    "canAccessHome": false,
    "accessStatus": "settings_incomplete",
    "nextStep": "settings_documents",
    "riderStatus": "inactive",
    "settingsChecks": {
      "documentsUploaded": false,
      "missingDocuments": ["INSURANCE", "REGISTRATION"]
    }
  }
}
```

## API Responses You Should Expect

### 1) Create vehicle
`POST /api/v1/riders/:userId/vehicles`
```json
{
  "success": true,
  "data": {
    "vehicleId": "680veh...",
    "vehicleType": "MOTORCYCLE",
    "nextStep": "vehicle_details",
    "requiredFields": ["color", "licensePlate"]
  }
}
```

### 2) Update vehicle details (missing required)
`PUT /api/v1/riders/:userId/vehicles/:vehicleId`
```json
{
  "success": false,
  "message": "Missing required fields for motorcycle: licensePlate"
}
```

### 3) Upload vehicle image
`POST /api/v1/riders/:userId/vehicles/:vehicleId/image`
```json
{
  "success": true,
  "data": {
    "vehicleId": "680veh...",
    "imageUrl": "https://...",
    "nextStep": "submit_verification"
  }
}
```

### 4) Submit verification
`POST /api/v1/riders/:userId/submit-verification`
```json
{
  "success": true,
  "data": {
    "riderStatus": "pending_verification",
    "onboardingStage": "pending_admin_approval",
    "verificationStatus": "pending"
  }
}
```

### 5) Admin tries to activate rider with missing settings documents
`PUT /api/v1/riders/admin/riders/:userId/verify`
```json
{
  "success": false,
  "message": "Rider cannot be activated until all required documents are uploaded in settings",
  "data": {
    "riderStatus": "inactive",
    "missingDocuments": ["INSURANCE"],
    "nextStep": "settings_documents"
  }
}
```

### 6) Protected rider home APIs when blocked
```json
{
  "code": "RIDER_HOME_LOCKED",
  "canAccessHome": false,
  "nextStep": "settings_documents",
  "riderStatus": "inactive",
  "onboardingStage": "approved",
  "verificationStatus": "approved"
}
```

