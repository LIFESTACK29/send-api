# Frontend Onboarding Reconciliation

## 1) Source Of Truth For Navigation
Always navigate with `user.accessState` (or `/api/v1/onboarding/state`):

1. If `accessState.canAccessHome === true` -> go to Home.
2. Else route by `accessState.nextStep`.

`accessState` fields:
1. `onboardingStage`
2. `verificationStatus`
3. `onboardingRequired`
4. `canAccessHome`
5. `accessStatus`
6. `nextStep`
7. `riderStatus` (riders)
8. `onboardingProgress` (riders)
9. `completionPercentage` (riders)

## 2) Stage To Screen Mapping
1. `email_pending` -> `email_otp`
2. `profile_pending` -> `profile_image`
3. `vehicle_pending` -> `vehicle_details`
4. `documents_pending` -> `documents`
5. `review_pending` -> `submit_verification`
6. `pending_admin_approval` -> `pending_admin_approval`
7. `approved` -> `home`
8. `rejected` -> `documents`

## 3) Vehicle Details Rules (Backend-Enforced)

### Required fields by `vehicleType`
1. `BICYCLE`: `color`
2. `MOTORCYCLE`: `color`, `licensePlate`
3. `TRICYCLE`: `color`, `licensePlate`
4. `CAR`: `brand`, `model`, `year`, `color`, `licensePlate`

### Clarification from your request
1. For `BICYCLE`, `brand/model/year/licensePlate` are optional.
2. For `MOTORCYCLE`, `brand/model/year` are optional and `licensePlate` is required.
3. For `TRICYCLE`, `brand/model/year` are optional.
4. `vehicleImage` is still required before submission.

## 4) Exact Backend Response Samples

### A) `POST /api/v1/auth/login` (success, rider not yet approved)
```json
{
  "message": "Login successful",
  "isOnboarded": true,
  "token": "jwt_here",
  "canAccessHome": false,
  "nextStep": "vehicle_details",
  "user": {
    "id": "680abc123...",
    "firstName": "Ifeanyi",
    "lastName": "Daniel",
    "email": "user@email.com",
    "phoneNumber": "0813...",
    "role": "rider",
    "isOnboarded": true,
    "riderStatus": "incomplete",
    "onboardingStage": "vehicle_pending",
    "verificationStatus": "not_submitted",
    "profileImageUrl": "https://...",
    "verificationNotes": null,
    "accessState": {
      "onboardingStage": "vehicle_pending",
      "verificationStatus": "not_submitted",
      "onboardingRequired": true,
      "canAccessHome": false,
      "accessStatus": "onboarding_incomplete",
      "nextStep": "vehicle_details",
      "riderStatus": "incomplete",
      "onboardingProgress": {
        "emailVerified": true,
        "profileCompleted": true,
        "vehicleSelected": true,
        "vehicleDetailsCompleted": false,
        "vehicleImageUploaded": false,
        "documentsUploaded": false,
        "submittedForVerification": false
      },
      "completionPercentage": 43
    }
  }
}
```

### B) `GET /api/v1/onboarding/state`
```json
{
  "success": true,
  "data": {
    "userId": "680abc123...",
    "role": "rider",
    "riderStatus": "pending_verification",
    "onboardingStage": "pending_admin_approval",
    "verificationStatus": "pending",
    "accessState": {
      "onboardingStage": "pending_admin_approval",
      "verificationStatus": "pending",
      "onboardingRequired": true,
      "canAccessHome": false,
      "accessStatus": "pending_admin_approval",
      "nextStep": "pending_admin_approval",
      "riderStatus": "pending_verification",
      "onboardingProgress": {
        "emailVerified": true,
        "profileCompleted": true,
        "vehicleSelected": true,
        "vehicleDetailsCompleted": true,
        "vehicleImageUploaded": true,
        "documentsUploaded": true,
        "submittedForVerification": true
      },
      "completionPercentage": 100
    }
  }
}
```

### C) `POST /api/v1/riders/:userId/vehicles`
```json
{
  "success": true,
  "message": "Vehicle created successfully",
  "data": {
    "vehicleId": "680veh...",
    "vehicleType": "MOTORCYCLE",
    "nextStep": "vehicle_details",
    "requiredFields": ["color", "licensePlate"]
  }
}
```

### D) `PUT /api/v1/riders/:userId/vehicles/:vehicleId` (missing required)
```json
{
  "success": false,
  "message": "Missing required fields for motorcycle: licensePlate"
}
```

### E) `PUT /api/v1/riders/:userId/vehicles/:vehicleId` (success)
```json
{
  "success": true,
  "message": "Vehicle details updated successfully",
  "data": {
    "vehicleId": "680veh...",
    "nextStep": "vehicle_image"
  }
}
```

### F) `POST /api/v1/riders/:userId/vehicles/:vehicleId/image`
```json
{
  "success": true,
  "message": "Vehicle image uploaded successfully",
  "data": {
    "vehicleId": "680veh...",
    "imageUrl": "https://...",
    "nextStep": "documents"
  }
}
```

### G) `POST /api/v1/riders/:userId/documents`
```json
{
  "success": true,
  "message": "Document uploaded successfully",
  "data": {
    "documentId": "680doc...",
    "documentType": "DRIVING_LICENSE",
    "verificationStatus": "pending"
  }
}
```

### H) `POST /api/v1/riders/:userId/submit-verification`
```json
{
  "success": true,
  "message": "Submitted for verification successfully",
  "data": {
    "userId": "680abc123...",
    "riderStatus": "pending_verification",
    "onboardingStage": "pending_admin_approval",
    "verificationStatus": "pending",
    "accessState": {
      "onboardingStage": "pending_admin_approval",
      "verificationStatus": "pending",
      "onboardingRequired": true,
      "canAccessHome": false,
      "accessStatus": "pending_admin_approval",
      "nextStep": "pending_admin_approval"
    },
    "message": "Your application is under review. You'll be notified once verified."
  }
}
```

### I) Rider tries home endpoints before approval (`403`)
```json
{
  "code": "RIDER_HOME_LOCKED",
  "message": "Verification is pending admin approval",
  "canAccessHome": false,
  "riderStatus": "pending_verification",
  "onboardingStage": "pending_admin_approval",
  "verificationStatus": "pending",
  "nextStep": "pending_admin_approval"
}
```

## 5) Frontend Boot Flow
On app launch with token:

1. `GET /api/v1/onboarding/state`
2. Read `data.accessState`
3. Route:
- `canAccessHome = true` -> Home
- else -> screen mapped by `nextStep`

This guarantees users never restart onboarding from scratch after app close.

