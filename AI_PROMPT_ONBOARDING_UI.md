# Prompt for AI - Generate Rider Onboarding Flow UI (Expo React Native)

Copy and paste this entire prompt into ChatGPT, Claude, or your preferred AI tool.

---

## PROMPT START

I'm building a delivery rider onboarding flow for my Expo React Native app. I need you to create a complete, production-ready onboarding flow with proper API integration, state management, and UI that matches my existing authentication pages (login/signup).

### PROJECT CONTEXT

**Tech Stack:**
- React Native with Expo
- TypeScript
- React Navigation (for screen transitions)
- Async Storage for persistence
- Fetch API for backend calls
-Zustand for state management (your choice, but implement it)

**Backend Base URL:**
```
https://api.raha.com/api/v1
```

**Existing Auth Pages Style:**
- Clean, minimalist design
- White background with accent colors
- Rounded corners on buttons/inputs
- Proper spacing and typography
- Loading states and error handling
- Toast/Alert notifications

**Use this design system for onboarding screens too.**

---

## REQUIREMENT 1: AUTHENTICATION STATE MANAGEMENT

Create a custom hook `useAuth.ts` that:
1. Stores JWT token in Async Storage securely
2. Stores userId and userRole from login/register response
3. Provides login, register, verifyOTP, and logout functions
4. Auto-loads token on app startup
5. Includes token validation

---

## REQUIREMENT 2: ONBOARDING NAVIGATION STRUCTURE

Create a separate navigation stack called `OnboardingStack` that includes these screens in order:

1. **ProfileSetup** - Upload profile picture (optional but recommended)
2. **VehicleTypeSelection** - Choose vehicle type with icons
3. **VehicleDetailsForm** - Fill brand, model, year, color, license plate
4. **VehicleImageUpload** - Capture/select vehicle photo
5. **DocumentsUpload** - Upload 4 required documents
6. **ReviewSubmit** - Review all data before submitting
7. **VerificationStatus** - Show pending status with refresh option
8. **OnboardingComplete** (shown after approval) - Show success message

**Navigation Logic:**
- User can navigate BACKWARD through screens
- After submitting (screen 7), cannot go back to edit
- After admin approval, show HomeStack instead of OnboardingStack
- Check `riderStatus` from user profile:
  - `"incomplete"` → Show OnboardingStack
  - `"pending_verification"` → Show VerificationStatus screen
  - `"active"` → Show HomeStack (unlock access)
  - `"rejected"` → Show rejection message with reason + option to resubmit

---

## REQUIREMENT 3: VEHICLE TYPE SELECTION SCREEN

**Must include:**

1. Display 4 vehicle types with ICONS (use react-native-vector-icons or expo vector icons):
   - 🚲 **BICYCLE** (use bike icon)
   - 🏍️ **MOTORCYCLE** (use motorcycle icon)
   - 🛺 **TRICYCLE** (use car icon or custom)
   - 🚗 **CAR** (use car icon)

2. Show each type as a CARD that:
   - Has large icon (40px+)
   - Shows label below icon
   - Has description text
   - Shows selection state (highlighted border when selected)
   - Animates on press

3. API Call when type selected:
   ```
   POST /riders/{userId}/vehicles
   Body: { "vehicleType": "MOTORCYCLE" }
   
   Response:
   {
     "success": true,
     "data": {
       "vehicleId": "507f1f77bcf86cd799439012",
       "vehicleType": "MOTORCYCLE",
       "nextStep": "vehicle_details",
       "requiredFields": ["brand", "model", "year", "color", "licensePlate", "registrationNumber"]
     }
   }
   ```

4. Store `vehicleId` from response
5. Show error toast if API fails
6. Show loading state during API call

---

## REQUIREMENT 4: VEHICLE DETAILS FORM SCREEN

**Must include:**

1. Form Fields:
   - **Brand** text input (e.g., "Honda", "Toyota")
   - **Model** text input (e.g., "CB500F")
   - **Year** picker (show current year down to 2000)
   - **Color** dropdown with common colors
   - **License Plate** text input (uppercase, formatted)
   - **Registration Number** text input (ONLY show if vehicleType !== BICYCLE)
   - **Additional Details** optional JSON field (collapsible, for power/cc/etc)

2. Form validation:
   - All required fields have green checkmarks when filled
   - Show error message for invalid inputs
   - License plate format: ABC-1234 (auto-format)

3. API Call on submit:
   ```
   PUT /riders/{userId}/vehicles/{vehicleId}
   Body: {
     "brand": "Honda",
     "model": "CB500F",
     "year": 2023,
     "color": "Red",
     "licensePlate": "ABC-1234",
     "registrationNumber": "REG-123456",
     "additionalDetails": { "engineCC": 500 }
   }
   
   Response:
   {
     "success": true,
     "data": {
       "vehicleId": "507f1f77bcf86cd799439012",
       "nextStep": "vehicle_image"
     }
   }
   ```

4. Show loading spinner during submission
5. Navigate to next screen on success
6. Show error toast on failure with retry button

---

## REQUIREMENT 5: VEHICLE IMAGE UPLOAD SCREEN

**Must include:**

1. Large upload area with:
   - Camera icon (40px)
   - Text: "Take a photo of your vehicle"
   - Subtext: "Clear, well-lit photo from the side"
   - Two buttons: [Camera] [Gallery]
   - Show uploaded image preview

2. Use `expo-image-picker` for camera/gallery access

3. Image preview:
   - Show selected image with 200x200px
   - Show file size
   - Option to change/retake photo

4. API Call on image select:
   ```
   POST /riders/{userId}/vehicles/{vehicleId}/image
   Content-Type: multipart/form-data
   Body: { "vehicleImage": <image_file> }
   
   Response:
   {
     "success": true,
     "data": {
       "vehicleId": "507f1f77bcf86cd799439012",
       "imageUrl": "https://raha-bucket.s3.fr-par.scw.cloud/...",
       "nextStep": "documents"
     }
   }
   ```

5. Show upload progress bar (0-100%)
6. Store `imageUrl` from response
7. Navigate to next screen after success
8. Show retry button on upload failure

---

## REQUIREMENT 6: DOCUMENTS UPLOAD SCREEN

**Must include:**

1. Show 4 REQUIRED DOCUMENTS as a checklist:
   ```
   ☐ Driving License
      Document #: [input field]
      Expires: [date picker]
      [Upload/Camera] [Status badge]
   
   ☐ Government ID
      Document #: [input field]
      Expires: [date picker]
      [Upload/Camera] [Status badge]
   
   ☐ Insurance Certificate
      Document #: [input field]
      Expires: [date picker]
      [Upload/Camera] [Status badge]
   
   ☐ Vehicle Registration
      Document #: [input field]
      Expires: [date picker]
      [Upload/Camera] [Status badge]
   ```

2. Status badges show:
   - "Pending Upload" (gray) - before upload
   - "Uploading..." (blue with spinner) - during upload
   - "✓ Uploaded" (green) - after success
   - "✗ Failed" (red) - on failure with retry

3. API Call for each document:
   ```
   POST /riders/{userId}/documents
   Content-Type: multipart/form-data
   Body: {
     "documentType": "DRIVING_LICENSE",
     "documentNumber": "DL123456",
     "expiryDate": "2028-12-31",
     "documentFile": <file>
   }
   
   Response:
   {
     "success": true,
     "data": {
       "documentId": "507f1f77bcf86cd799439013",
       "documentType": "DRIVING_LICENSE",
       "verificationStatus": "pending"
     }
   }
   ```

4. Upload all 4 documents (can be done in any order)
5. Show progress: "3 of 4 documents uploaded" at the top
6. Only enable "Next" button when all 4 are uploaded
7. Allow re-upload if a document fails
8. Show file size limit warning (max 5MB)

---

## REQUIREMENT 7: REVIEW & SUBMIT SCREEN

**Must include:**

1. Collapsible sections showing:
   ```
   ╔═══════════════════════════════════╗
   │ PROFILE SUMMARY                   │
   ├───────────────────────────────────┤
   │ ▼ Profile                         │
   │   [Profile Image Thumbnail]       │
   │   Email: user@example.com         │
   │   Phone: +234701...               │
   │                                   │
   │ ▼ Vehicle Information             │
   │   Type: 🏍️ Motorcycle             │
   │   Brand: Honda CB500F             │
   │   Year: 2023                      │
   │   License: ABC-1234               │
   │   [Vehicle Image Thumbnail]       │
   │                                   │
   │ ▼ Documents (4/4)                 │
   │   ✓ Driving License               │
   │   ✓ Government ID                 │
   │   ✓ Insurance                     │
   │   ✓ Registration                  │
   │                                   │
   │ Completion: ████████████ 100%     │
   │                                   │
   │ [SUBMIT FOR VERIFICATION]         │
   └═══════════════════════════════════┘
   ```

2. Each section tappable to expand/collapse

3. [SUBMIT FOR VERIFICATION] button:
   - Only enabled if ALL data complete (100%)
   - Shows loading state while submitting
   - Disabled after submission

4. API Call on submit:
   ```
   POST /riders/{userId}/submit-verification
   
   Response:
   {
     "success": true,
     "data": {
       "userId": "507f1f77bcf86cd799439011",
       "riderStatus": "pending_verification",
       "message": "Your application is under review..."
     }
   }
   ```

5. After success:
   - Show success message: "✅ Application submitted successfully!"
   - Navigate to VerificationStatus screen
   - Update user context with new riderStatus

---

## REQUIREMENT 8: VERIFICATION STATUS SCREEN

**Must include:**

1. Show different states based on `riderStatus`:

   **State 1: pending_verification**
   ```
   ┌─────────────────────────────┐
   │  ⏳ VERIFICATION IN PROGRESS │
   │                             │
   │ Your application is under   │
   │ review by our admin team.   │
   │                             │
   │ Average time: 2-24 hours    │
   │                             │
   │ We'll notify you when:      │
   │ ✓ Documents are verified    │
   │ ✓ Your account is approved  │
   │                             │
   │ [REFRESH STATUS]            │
   │ [NEED HELP?]                │
   └─────────────────────────────┘
   ```

   **State 2: active (APPROVED)**
   ```
   ┌─────────────────────────────┐
   │     ✅ YOU'RE APPROVED!      │
   │                             │
   │ Your account is now active  │
   │ You can start accepting     │
   │ delivery requests!          │
   │                             │
   │ [GO TO DASHBOARD]           │
   └─────────────────────────────┘
   ```

   **State 3: rejected (REJECTED)**
   ```
   ┌─────────────────────────────┐
   │    ❌ APPLICATION REJECTED   │
   │                             │
   │ Reason:                     │
   │ "Your driving license is    │
   │  expired. Please upload a   │
   │  valid license."            │
   │                             │
   │ [RESUBMIT APPLICATION]      │
   │ [CONTACT SUPPORT]           │
   └─────────────────────────────┘
   ```

2. [REFRESH STATUS] button:
   - Call GET /riders/{userId}/onboarding-status
   - Response format:
   ```json
   {
     "success": true,
     "data": {
       "userId": "507f1f77bcf86cd799439011",
       "onboardingProgress": {
         "emailVerified": true,
         "profileCompleted": true,
         "vehicleSelected": true,
         "vehicleDetailsCompleted": true,
         "vehicleImageUploaded": true,
         "documentsUploaded": true,
         "submittedForVerification": true
       },
       "riderStatus": "pending_verification",
       "completionPercentage": 100,
       "verificationNotes": null
     }
   }
   ```
   - Update user context with response
   - Show toast: "Status updated"

3. Optional: Setup polling every 30 seconds to auto-check status
4. Optional: Push notification when status changes

---

## REQUIREMENT 9: STATE MANAGEMENT & DATA FLOW

Create a `RiderOnboardingContext` with:

```typescript
interface RiderOnboardingState {
  userId: string;
  vehicleId: string | null;
  vehicleType: string | null;
  profileImageUrl: string | null;
  vehicleImageUrl: string | null;
  documents: {
    DRIVING_LICENSE?: { id: string; number: string; expiryDate: string };
    GOVERNMENT_ID?: { id: string; number: string; expiryDate: string };
    INSURANCE?: { id: string; number: string; expiryDate: string };
    REGISTRATION?: { id: string; number: string; expiryDate: string };
  };
  riderStatus: "incomplete" | "pending_verification" | "active" | "rejected";
  verificationNotes?: string;
  currentStep: number; // 1-8
}
```

Provide actions to:
- setVehicleType()
- setVehicleDetails()
- setVehicleImage()
- addDocument()
- submitForVerification()
- updateRiderStatus()
- resetOnboarding()

---

## REQUIREMENT 10: ERROR HANDLING & VALIDATION

For ALL API calls:

1. Show loading spinner/skeleton during request
2. Show error toast on failure with:
   - Error message from backend
   - Retry button
   - Contact support button (optional)

3. Validation before submit:
   - Check all required fields filled
   - Check file sizes (< 5MB)
   - Check image quality (minimum dimensions)
   - Show inline error messages

4. Network error handling:
   - Detect no internet and show offline message
   - Auto-retry on reconnect
   - Save form data locally to Async Storage

---

## REQUIREMENT 11: ACCESS CONTROL

Add a check in navigation:

```typescript
// After user logs in, check their riderStatus:
if (user.role === "rider") {
  if (user.riderStatus === "active") {
    // Show HomeStack
  } else {
    // Show OnboardingStack
    // Block access to homepage/earnings/etc
  }
}
```

**Users CANNOT access:**
- Home/Dashboard
- Order history
- Earnings
- Settings (limited)

**Until:** riderStatus === "active"

---

## REQUIREMENT 12: UI/UX POLISH

1. **Consistent Design:**
   - Match authentication pages styling
   - Same color scheme, typography, spacing
   - Rounded buttons (borderRadius: 12)
   - Proper status bar color

2. **Progress Indicators:**
   - Show "Step 3 of 8" at top of each screen
   - Progress bar below header
   - Smooth transitions between screens

3. **Animations:**
   - Fade in/out on screen change
   - Subtle scale animation on button press
   - Smooth progress bar animation

4. **Accessibility:**
   - Large tap targets (minimum 44px)
   - Clear labels for all inputs
   - Good color contrast
   - Screen reader friendly

5. **Loading States:**
   - Show spinner during API calls
   - Disable buttons while loading
   - Show progress text: "Uploading 45%..."

---

## REQUIREMENT 13: API INTEGRATION CHECKLIST

Integrate these exact endpoints:

| Endpoint | Method | Used In Screen |
|----------|--------|----------------|
| `/riders/vehicle-types` | GET | VehicleTypeSelection (to show options) |
| `/riders/{userId}/vehicles` | POST | VehicleTypeSelection (create vehicle) |
| `/riders/{userId}/vehicles/{vehicleId}` | PUT | VehicleDetailsForm (save details) |
| `/riders/{userId}/vehicles/{vehicleId}/image` | POST | VehicleImageUpload (upload photo) |
| `/riders/required` | GET | DocumentsUpload (show required docs list) |
| `/riders/{userId}/documents` | POST | DocumentsUpload (upload each doc) |
| `/riders/{userId}/submit-verification` | POST | ReviewSubmit (submit for approval) |
| `/riders/{userId}/onboarding-status` | GET | VerificationStatus (check status) |
| `/auth/upload-profile-image` | POST | ProfileSetup (upload profile pic) |

All requests must include:
```
Authorization: Bearer {JWT_TOKEN}
```

Token should be read from Async Storage (stored after login).

---

## REQUIREMENT 14: EXAMPLE DATA STRUCTURES

Use these example responses to test and validate UI:

**Vehicle Type Response:**
```json
{
  "success": true,
  "data": [
    { "type": "BICYCLE", "label": "Bicycle", "icon": "bike", "description": "Two-wheeled pedal" },
    { "type": "MOTORCYCLE", "label": "Motorcycle", "icon": "motorcycle", "description": "Two-wheeled motor" },
    { "type": "TRICYCLE", "label": "Tricycle", "icon": "car", "description": "Three-wheeled" },
    { "type": "CAR", "label": "Car", "icon": "car", "description": "Four-wheeled vehicle" }
  ]
}
```

**Vehicle Created Response:**
```json
{
  "success": true,
  "data": {
    "vehicleId": "507f1f77bcf86cd799439012",
    "vehicleType": "MOTORCYCLE",
    "nextStep": "vehicle_details",
    "requiredFields": ["brand", "model", "year", "color", "licensePlate", "registrationNumber"]
  }
}
```

**Onboarding Status Response:**
```json
{
  "success": true,
  "data": {
    "userId": "507f1f77bcf86cd799439011",
    "onboardingProgress": {
      "emailVerified": true,
      "profileCompleted": true,
      "vehicleSelected": true,
      "vehicleDetailsCompleted": true,
      "vehicleImageUploaded": true,
      "documentsUploaded": true,
      "submittedForVerification": true
    },
    "riderStatus": "pending_verification",
    "completionPercentage": 100,
    "verificationNotes": null
  }
}
```

---

## DELIVERABLES

Please create:

1. **Navigation Structure:**
   - OnboardingStack navigator with 8 screens
   - Conditional rendering (show OnboardingStack or HomeStack)

2. **8 Complete Screens:**
   - ProfileSetup.tsx
   - VehicleTypeSelection.tsx
   - VehicleDetailsForm.tsx
   - VehicleImageUpload.tsx
   - DocumentsUpload.tsx
   - ReviewSubmit.tsx
   - VerificationStatus.tsx

3. **Context & Hooks:**
   - RiderOnboardingContext.tsx
   - useAuth.ts (enhanced for storing rider data)
   - useRiderOnboarding.ts

4. **Utilities:**
   - API service functions for all endpoints
   - Error handling helper
   - Validation helpers

5. **Styling:**
   - Consistent with authentication pages
   - Use Expo constants for colors/spacing
   - Export from a colors.ts or theme.ts file

6. **TypeScript Types:**
   - Define all request/response types
   - Use strict typing throughout

---

## IMPORTANT NOTES

1. **DO NOT show homepage** until `riderStatus === "active"`
2. **Icons for vehicles** - use react-native-vector-icons or expo vector icons
3. **All API responses** must match the format shown in this prompt
4. **File uploads** - handle multipart/form-data correctly
5. **Async Storage** - persist JWT token securely
6. **Error messages** - show user-friendly messages, not raw API errors
7. **Loading states** - always show while API is processing
8. **Form validation** - validate locally before submitting to API
9. **Navigation** - smooth transitions with no back button after submission
10. **Accessibility** - ensure large tap targets and good contrast

---

## DESIGN INSPIRATION

Match the style of your **Login/Signup screens**:
- Clean white backgrounds
- Rounded corners on buttons/inputs
- Proper spacing and typography
- Consistent color scheme
- Professional, modern look
- No clutter or unnecessary UI

---

## END OF PROMPT

That's it! This prompt provides everything an AI needs to create your complete onboarding flow. Copy the entire thing and paste it into your AI tool.

---

# USAGE INSTRUCTIONS

1. Copy everything between "PROMPT START" and "END OF PROMPT"
2. Paste into ChatGPT 4, Claude 3.5 Sonnet, or similar AI
3. Add this follow-up if you need additional features:
   ```
   "Please also add:
   - Comprehensive error handling
   - Loading skeleton screens
   - Smooth animations between screens
   - Form persistence in Async Storage
   - Offline mode support
   - TypeScript strict mode enabled"
   ```
4. Ask for exports/file structure if needed
5. Request testing examples if needed

The AI will generate production-ready code following React Native best practices.
