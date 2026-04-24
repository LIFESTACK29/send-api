# Rider Onboarding Flow (Current)

## Required Steps
1. Register rider account and verify OTP.
2. Upload profile image.
3. Select vehicle type.
4. Rider is marked `active`, wallet is auto-created, and rider can access home.

## Endpoints
1. `POST /api/v1/auth/register`
2. `POST /api/v1/auth/verify-otp`
3. `POST /api/v1/auth/upload-profile-image`
4. `GET /api/v1/riders/vehicle-types`
5. `POST /api/v1/riders/:userId/vehicles`
6. `GET /api/v1/onboarding/state`
7. `GET /api/v1/riders/:userId/onboarding-status`

## Notes
1. Document upload is removed from active onboarding flow.
2. Vehicle details/image are not required for onboarding completion.
3. `POST /api/v1/wallet/create` is optional now; rider wallet is auto-created after onboarding completion.
