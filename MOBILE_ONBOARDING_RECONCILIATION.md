# Mobile Onboarding Reconciliation Guide

This backend now returns a canonical `accessState` so the mobile app can always resume rider onboarding from the exact step where the user stopped, including after app close/reopen and login/logout.

## What Was Implemented

1. Persistent onboarding state contract in auth/profile responses:
- `POST /api/v1/auth/login`
- `GET /api/v1/auth/me`
- `GET /api/v1/user/profile`
- Profile-related `PATCH/POST/PUT/DELETE` responses in `/api/v1/user/*`

2. Canonical rider onboarding state endpoint:
- `GET /api/v1/riders/:userId/onboarding-status`

3. Home access lock for riders:
- Riders cannot access home APIs (`/api/v1/deliveries/*`, `/api/v1/wallet/*`) unless `riderStatus === "active"`.
- Pending/unapproved riders stay on onboarding/pending flow until admin approval.

4. Security and ownership hardening:
- Rider resource routes now enforce self-access (`:userId` must match logged-in user, unless admin).
- Admin verification endpoints are now truly admin-only.

## Access Contract (Source of Truth)

Use `user.accessState` from login/me/profile as the routing source of truth.

```json
{
  "onboardingRequired": true,
  "canAccessHome": false,
  "accessStatus": "onboarding_incomplete",
  "nextStep": "documents",
  "riderStatus": "incomplete",
  "onboardingProgress": {
    "emailVerified": true,
    "profileCompleted": true,
    "vehicleSelected": true,
    "vehicleDetailsCompleted": true,
    "vehicleImageUploaded": true,
    "documentsUploaded": false,
    "submittedForVerification": false
  },
  "completionPercentage": 71
}
```

## `nextStep` Values and Expected Mobile Screen

1. `email_otp`
- Route to OTP verification screen.
- Triggered when `isOnboarded === false`.

2. `profile_image`
- Route to rider profile image upload step.

3. `vehicle_type`
- Route to vehicle type selection step.

4. `vehicle_details`
- Route to vehicle details form step.

5. `vehicle_image`
- Route to vehicle image upload step.

6. `documents`
- Route to documents upload/re-upload step.

7. `submit_verification`
- Route to review/submit screen.
- User has completed all required steps but has not submitted.

8. `pending_admin_approval`
- Route to waiting/pending approval screen.
- Do not route to home.

9. `home`
- Route to app home/dashboard.
- Only when approved for riders (`riderStatus === "active"`).

## Access Status Meaning

1. `email_verification_required`
- Email OTP not completed.

2. `onboarding_incomplete`
- Rider onboarding not fully complete or not submitted.

3. `pending_admin_approval`
- Rider submitted and is awaiting admin action.

4. `approved`
- User is allowed full app/home access.

## Login Routing Rule

After successful login:

1. Read `user.accessState`.
2. If `canAccessHome === true`, route to Home.
3. If `canAccessHome === false`, route strictly by `nextStep`.

Do not infer from `riderStatus` alone; always prefer `accessState`.

## App Resume Rule (Cold Start / Reopen)

On app launch (if token exists):

1. Call `GET /api/v1/auth/me` (or `/api/v1/user/profile`).
2. Read `user.accessState`.
3. Route to `nextStep` if `canAccessHome === false`.
4. Route to Home only when `canAccessHome === true`.

This ensures users continue where they left off without restarting verification.

## Pending Approval Lock Behavior

If rider has submitted verification and admin has not approved yet:

- `riderStatus = "pending_verification"`
- `accessState.nextStep = "pending_admin_approval"`
- `accessState.canAccessHome = false`

If the rider tries to call home APIs directly, backend returns `403` with:

```json
{
  "message": "Verification is pending admin approval",
  "code": "RIDER_HOME_LOCKED",
  "canAccessHome": false,
  "riderStatus": "pending_verification",
  "nextStep": "pending_admin_approval"
}
```

## Admin Verification Impact

1. Admin approves rider:
- Endpoint: `PUT /api/v1/riders/admin/riders/:userId/verify`
- Body: `{ "status": "active", "notes": "..." }`
- Result: next login/me returns `nextStep: "home"` and `canAccessHome: true`.

2. Admin rejects rider:
- Body: `{ "status": "rejected", "notes": "..." }`
- Result: user stays out of home and resumes onboarding correction flow.

## Core Endpoints for Mobile Onboarding

1. `POST /api/v1/auth/login`
2. `GET /api/v1/auth/me`
3. `GET /api/v1/riders/:userId/onboarding-status`
4. `POST /api/v1/auth/upload-profile-image`
5. `POST /api/v1/riders/:userId/vehicles`
6. `PUT /api/v1/riders/:userId/vehicles/:vehicleId`
7. `POST /api/v1/riders/:userId/vehicles/:vehicleId/image`
8. `POST /api/v1/riders/:userId/documents`
9. `POST /api/v1/riders/:userId/submit-verification`

## Backend Files Updated

1. `src/services/onboarding.service.ts`
2. `src/controllers/auth.controller.ts`
3. `src/controllers/user.controller.ts`
4. `src/controllers/vehicle.controller.ts`
5. `src/middlewares/auth.middleware.ts`
6. `src/routes/vehicle.route.ts`
7. `src/routes/document.route.ts`
8. `src/routes/delivery.route.ts`
9. `src/routes/wallet.route.ts`

