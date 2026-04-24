# Admin Verification Flow

## 1) Admin Login

Endpoint:
1. `POST /api/v1/auth/admin/login`

Request body:
```json
{
  "email": "admin@rahasend.com",
  "password": "your_password"
}
```

Success response:
```json
{
  "message": "Admin login successful",
  "token": "jwt_token_here",
  "user": {
    "id": "681admin...",
    "firstName": "Admin",
    "lastName": "User",
    "email": "admin@rahasend.com",
    "phoneNumber": "080...",
    "role": "admin",
    "isOnboarded": true,
    "accessState": {
      "onboardingStage": "approved",
      "verificationStatus": "approved",
      "onboardingRequired": false,
      "canAccessHome": true,
      "accessStatus": "approved",
      "nextStep": "home",
      "currentStep": "home"
    }
  }
}
```

## 2) List All Riders + Verification Status

Endpoint:
1. `GET /api/v1/admin/riders`

Headers:
1. `Authorization: Bearer <admin_token>`

Success response:
```json
{
  "success": true,
  "data": {
    "totalRiders": 2,
    "riders": [
      {
        "id": "681rider1...",
        "firstName": "Ifeanyi",
        "lastName": "Daniel",
        "email": "rider1@email.com",
        "phoneNumber": "0813...",
        "riderStatus": "inactive",
        "onboardingStage": "approved",
        "verificationStatus": "approved",
        "verificationNotes": null,
        "hasProfileImage": true,
        "hasVehicle": true,
        "hasVehicleImage": true,
        "documents": {
          "totalDocuments": 3,
          "approved": 2,
          "pending": 1,
          "rejected": 0,
          "documentsUploaded": false,
          "missingDocuments": ["REGISTRATION"]
        },
        "accessState": {
          "onboardingStage": "approved",
          "verificationStatus": "approved",
          "onboardingRequired": false,
          "canAccessHome": false,
          "accessStatus": "settings_incomplete",
          "nextStep": "settings_documents",
          "currentStep": "settings_documents"
        },
        "createdAt": "2026-04-24T10:00:00.000Z",
        "updatedAt": "2026-04-24T10:30:00.000Z"
      }
    ]
  }
}
```

## 3) Get Single Rider Verification Detail

Endpoint:
1. `GET /api/v1/admin/riders/:userId`

Headers:
1. `Authorization: Bearer <admin_token>`

Success response:
```json
{
  "success": true,
  "data": {
    "rider": {
      "id": "681rider1...",
      "firstName": "Ifeanyi",
      "lastName": "Daniel",
      "email": "rider1@email.com",
      "phoneNumber": "0813...",
      "riderStatus": "inactive",
      "onboardingStage": "approved",
      "verificationStatus": "approved",
      "verificationNotes": null,
      "profileImageUrl": "https://...",
      "accessState": {
        "onboardingStage": "approved",
        "verificationStatus": "approved",
        "onboardingRequired": false,
        "canAccessHome": false,
        "accessStatus": "settings_incomplete",
        "nextStep": "settings_documents",
        "currentStep": "settings_documents"
      }
    },
    "vehicles": [
      {
        "_id": "681veh...",
        "vehicleType": "MOTORCYCLE",
        "color": "Black",
        "licensePlate": "ABC-123XY",
        "imageUrl": "https://..."
      }
    ],
    "documents": [
      {
        "_id": "681doc...",
        "documentType": "DRIVING_LICENSE",
        "documentUrl": "https://...",
        "verificationStatus": "pending",
        "rejectionReason": null
      }
    ],
    "settingsChecks": {
      "documentsUploaded": false,
      "missingDocuments": ["REGISTRATION"]
    }
  }
}
```

## 4) Verify Rider (Admin Action)

Endpoint:
1. `PUT /api/v1/admin/riders/:userId/verify`

Headers:
1. `Authorization: Bearer <admin_token>`

Request body examples:
```json
{
  "status": "active",
  "notes": "All checks passed"
}
```

```json
{
  "status": "inactive",
  "notes": "Waiting for settings document completion"
}
```

```json
{
  "status": "rejected",
  "notes": "Invalid details provided"
}
```

Success response:
```json
{
  "success": true,
  "message": "Rider active successfully",
  "data": {
    "userId": "681rider1...",
    "riderStatus": "active",
    "onboardingStage": "approved",
    "verificationStatus": "approved",
    "verificationNotes": "All checks passed"
  }
}
```

If admin tries to activate with missing settings documents:
```json
{
  "success": false,
  "message": "Rider cannot be activated until all required documents are uploaded in settings",
  "data": {
    "riderStatus": "inactive",
    "missingDocuments": ["REGISTRATION"],
    "nextStep": "settings_documents"
  }
}
```

## 5) Verify Document (Admin Action)

Endpoint:
1. `PUT /api/v1/admin/documents/:documentId/verify`

Headers:
1. `Authorization: Bearer <admin_token>`

Approve request:
```json
{
  "status": "approved"
}
```

Reject request:
```json
{
  "status": "rejected",
  "rejectionReason": "Image is blurry"
}
```

Success response:
```json
{
  "success": true,
  "message": "Document approved successfully",
  "data": {
    "_id": "681doc...",
    "userId": "681rider1...",
    "documentType": "DRIVING_LICENSE",
    "verificationStatus": "approved"
  }
}
```

## 6) Frontend Admin Screen Flow

1. Admin Sign In:
- Call `POST /api/v1/auth/admin/login`
- Store token

2. Riders List Page:
- Call `GET /api/v1/admin/riders`
- Render rider summary and status chips (`active`, `inactive`, `pending_verification`, `rejected`)

3. Rider Detail Page:
- Call `GET /api/v1/admin/riders/:userId`
- Show profile, vehicles, documents, settings checks, access state

4. Verify Documents:
- Call `PUT /api/v1/admin/documents/:documentId/verify`
- Refresh rider details

5. Verify Rider:
- Call `PUT /api/v1/admin/riders/:userId/verify`
- If response says missing documents, show prompt to keep rider `inactive`
- Refresh riders list and detail

## 7) Existing Backward-Compatible Routes

Existing verification endpoints under `/api/v1/riders/admin/*` still work:
1. `PUT /api/v1/riders/admin/documents/:documentId/verify`
2. `PUT /api/v1/riders/admin/riders/:userId/verify`
3. `GET /api/v1/riders/admin/riders`
4. `GET /api/v1/riders/admin/riders/:userId`

Preferred new base path is `/api/v1/admin/*`.

