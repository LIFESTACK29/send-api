# Mobile App Implementation - Quick Reference Guide

## Rider Onboarding Flow - Step by Step

This guide shows the exact sequence of actions and API calls needed to implement the rider onboarding flow.

---

## Prerequisites
- Store JWT token in device secure storage (Keychain on iOS, Keystore on Android)
- Use this token in all subsequent requests: `Authorization: Bearer {token}`
- Handle API errors gracefully with user-friendly messages

---

## STEP 1: Registration & Email Verification

### Screen: Welcome/Auth Screen
**User Action**: Enter registration details

**API Call 1: Register**
```
POST /auth/register
{
  "firstName": "John",
  "lastName": "Doe",
  "email": "john@example.com",
  "phoneNumber": "+2347012345678",
  "password": "securePassword123",
  "role": "rider"
}
```

**Response**:
```json
{
  "isOnboarded": false,
  "userId": "507f1f77bcf86cd799439011"
}
```

**Store**: Save `userId` locally (needed for all subsequent calls)

### Screen: OTP Verification
**User Action**: Enter 6-digit OTP received in email

**API Call 2: Verify OTP**
```
POST /auth/verify-otp
{
  "userId": "507f1f77bcf86cd799439011",
  "code": "123456"
}
```

**Response**:
```json
{
  "token": "eyJhbGc...",
  "user": {...}
}
```

**Store**: Save JWT `token` to secure storage

---

## STEP 2: Profile Setup (Optional but Recommended)

### Screen: Profile Picture Upload
**User Action**: Upload profile picture

**API Call 3: Update Profile**
(Use your existing profile update endpoint or create simple one)

**Endpoint**: `PUT /user/profile` (existing)
**Body**:
```json
{
  "profileImage": <file>
}
```

**Note**: This uses existing user controller. Add multipart form support.

---

## STEP 3: Vehicle Type Selection

### Screen: Select Vehicle Type
**User Action**: Select one of 4 vehicle types

**API Call 4: Get Vehicle Types** (for display)
```
GET /riders/vehicle-types
```

**Response**:
```json
{
  "data": [
    {"type": "BICYCLE", "label": "Bicycle", ...},
    {"type": "MOTORCYCLE", "label": "Motorcycle", ...},
    {"type": "TRICYCLE", "label": "Tricycle", ...},
    {"type": "CAR", "label": "Car", ...}
  ]
}
```

**API Call 5: Create Vehicle**
```
POST /riders/{userId}/vehicles
{
  "vehicleType": "MOTORCYCLE"
}
```

**Response**:
```json
{
  "data": {
    "vehicleId": "507f1f77bcf86cd799439012",
    "vehicleType": "MOTORCYCLE",
    "nextStep": "vehicle_details",
    "requiredFields": ["brand", "model", "year", "color", "licensePlate", "registrationNumber"]
  }
}
```

**Store**: Save `vehicleId`

---

## STEP 4: Vehicle Details Form

### Screen: Add Vehicle Details
**User Action**: Fill form with vehicle info

**API Call 6: Update Vehicle Details**
```
PUT /riders/{userId}/vehicles/{vehicleId}
{
  "brand": "Honda",
  "model": "CB500F",
  "year": 2023,
  "color": "Red",
  "licensePlate": "ABC-1234",
  "registrationNumber": "REG-123456",
  "additionalDetails": {
    "engineCC": 500,
    "transmission": "Manual"
  }
}
```

**Response**:
```json
{
  "success": true,
  "data": {
    "vehicleId": "507f1f77bcf86cd799439012",
    "nextStep": "vehicle_image"
  }
}
```

---

## STEP 5: Upload Vehicle Image

### Screen: Capture Vehicle Photo
**User Action**: Take photo or select from gallery

**API Call 7: Upload Vehicle Image**
```
POST /riders/{userId}/vehicles/{vehicleId}/image
Content-Type: multipart/form-data

{
  "vehicleImage": <image_file>
}
```

**Response**:
```json
{
  "success": true,
  "data": {
    "vehicleId": "507f1f77bcf86cd799439012",
    "imageUrl": "https://...",
    "nextStep": "documents"
  }
}
```

---

## STEP 6: Upload Documents

### Screen: Document Upload Page
**User Action**: Upload 4 required documents

**API Call 8: Get Required Documents** (for display/checklist)
```
GET /riders/required
```

**Response**:
```json
{
  "data": [
    {"type": "DRIVING_LICENSE", "label": "Driving License", ...},
    {"type": "GOVERNMENT_ID", "label": "Government ID", ...},
    {"type": "INSURANCE", "label": "Insurance Certificate", ...},
    {"type": "REGISTRATION", "label": "Vehicle Registration", ...}
  ]
}
```

**API Call 9: Upload Document (repeat 4 times)**
```
POST /riders/{userId}/documents
Content-Type: multipart/form-data

{
  "documentType": "DRIVING_LICENSE",
  "documentNumber": "DL123456",
  "expiryDate": "2028-12-31",
  "documentFile": <pdf_or_image_file>
}
```

**Response**:
```json
{
  "success": true,
  "data": {
    "documentId": "507f1f77bcf86cd799439013",
    "documentType": "DRIVING_LICENSE",
    "verificationStatus": "pending"
  }
}
```

**Repeat for**:
- GOVERNMENT_ID
- INSURANCE
- REGISTRATION

---

## STEP 7: Review & Submit

### Screen: Review All Information
**API Call 10: Check Onboarding Status** (optional, for showing progress)
```
GET /riders/{userId}/onboarding-status
```

**Response**:
```json
{
  "data": {
    "onboardingProgress": {
      "emailVerified": true,
      "profileCompleted": true,
      "vehicleSelected": true,
      "vehicleDetailsCompleted": true,
      "vehicleImageUploaded": true,
      "documentsUploaded": true,
      "submittedForVerification": false
    },
    "completionPercentage": 100
  }
}
```

**Display**: Progress bar showing 100% complete

**User Action**: Tap Submit

**API Call 11: Submit for Verification**
```
POST /riders/{userId}/submit-verification
```

**Response**:
```json
{
  "success": true,
  "data": {
    "riderStatus": "pending_verification",
    "message": "Your application is under review..."
  }
}
```

---

## STEP 8: Verification Status Page

### Screen: Pending Verification Status
**Display Message**: "Your application is under review. You'll be notified once verified."

**Optional: Periodic Check**
```
GET /riders/{userId}/onboarding-status
```

Check `riderStatus` field:
- `"pending_verification"` → Still pending
- `"active"` → ✅ Approved! Ready to deliver
- `"rejected"` → ❌ Not approved, show reason from `verificationNotes`

**Notification**: Setup push notification for status change

---

## Code Examples

### React Native Example
```typescript
// Step 1: Register
const registerRider = async (data) => {
  try {
    const response = await fetch('https://api.raha.com/api/v1/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    const json = await response.json();
    setUserId(json.userId);
  } catch (error) {
    showError(error.message);
  }
};

// Step 2: Verify OTP
const verifyOTP = async (userId, code) => {
  try {
    const response = await fetch('https://api.raha.com/api/v1/auth/verify-otp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, code })
    });
    const json = await response.json();
    await SecureStore.setItemAsync('token', json.token);
  } catch (error) {
    showError(error.message);
  }
};

// Step 4: Create Vehicle
const createVehicle = async (userId, vehicleType) => {
  const token = await SecureStore.getItemAsync('token');
  try {
    const response = await fetch(`https://api.raha.com/api/v1/riders/${userId}/vehicles`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ vehicleType })
    });
    const json = await response.json();
    setVehicleId(json.data.vehicleId);
  } catch (error) {
    showError(error.message);
  }
};

// Step 5: Upload Vehicle Image
const uploadVehicleImage = async (userId, vehicleId, imageUri) => {
  const token = await SecureStore.getItemAsync('token');
  const formData = new FormData();
  formData.append('vehicleImage', {
    uri: imageUri,
    type: 'image/jpeg',
    name: 'vehicle.jpg'
  });

  try {
    const response = await fetch(
      `https://api.raha.com/api/v1/riders/${userId}/vehicles/${vehicleId}/image`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
        body: formData
      }
    );
    const json = await response.json();
    showSuccess('Vehicle photo uploaded successfully');
  } catch (error) {
    showError(error.message);
  }
};

// Step 6: Upload Document
const uploadDocument = async (userId, docType, docNumber, expiryDate, fileUri) => {
  const token = await SecureStore.getItemAsync('token');
  const formData = new FormData();
  formData.append('documentType', docType);
  formData.append('documentNumber', docNumber);
  formData.append('expiryDate', expiryDate);
  formData.append('documentFile', {
    uri: fileUri,
    type: 'application/pdf',
    name: `${docType}.pdf`
  });

  try {
    const response = await fetch(
      `https://api.raha.com/api/v1/riders/${userId}/documents`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
        body: formData
      }
    );
    const json = await response.json();
    showSuccess(`${docType} uploaded successfully`);
  } catch (error) {
    showError(error.message);
  }
};

// Step 11: Submit for Verification
const submitForVerification = async (userId) => {
  const token = await SecureStore.getItemAsync('token');
  try {
    const response = await fetch(
      `https://api.raha.com/api/v1/riders/${userId}/submit-verification`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      }
    );
    const json = await response.json();
    showSuccess('Application submitted successfully!');
    navigateTo('VerificationStatus', { userId });
  } catch (error) {
    showError(error.message);
  }
};
```

### Flutter Example
```dart
// Step 1: Register
Future<void> registerRider(String firstName, String lastName, String email, 
    String phoneNumber, String password) async {
  try {
    final response = await http.post(
      Uri.parse('https://api.raha.com/api/v1/auth/register'),
      headers: {'Content-Type': 'application/json'},
      body: jsonEncode({
        'firstName': firstName,
        'lastName': lastName,
        'email': email,
        'phoneNumber': phoneNumber,
        'password': password,
        'role': 'rider'
      }),
    );

    if (response.statusCode == 201) {
      final data = jsonDecode(response.body);
      userId = data['userId'];
    } else {
      showError('Registration failed');
    }
  } catch (e) {
    showError(e.toString());
  }
}

// Step 6: Upload Document
Future<void> uploadDocument(String userId, String docType, String docNumber, 
    String expiryDate, File documentFile) async {
  final token = await getTokenFromSecureStorage();
  
  var request = http.MultipartRequest(
    'POST',
    Uri.parse('https://api.raha.com/api/v1/riders/$userId/documents'),
  );
  
  request.headers['Authorization'] = 'Bearer $token';
  request.fields['documentType'] = docType;
  request.fields['documentNumber'] = docNumber;
  request.fields['expiryDate'] = expiryDate;
  request.files.add(await http.MultipartFile.fromPath(
    'documentFile',
    documentFile.path,
  ));

  try {
    var response = await request.send();
    if (response.statusCode == 201) {
      showSuccess('Document uploaded successfully');
    } else {
      showError('Upload failed');
    }
  } catch (e) {
    showError(e.toString());
  }
}
```

---

## Summary of All API Calls

| # | Method | Endpoint | Purpose |
|---|--------|----------|---------|
| 1 | POST | `/auth/register` | Register rider account |
| 2 | POST | `/auth/verify-otp` | Verify email with OTP |
| 3 | PUT | `/user/profile` | Upload profile picture |
| 4 | GET | `/riders/vehicle-types` | Display vehicle options |
| 5 | POST | `/riders/{userId}/vehicles` | Create vehicle |
| 6 | PUT | `/riders/{userId}/vehicles/{vehicleId}` | Fill vehicle details |
| 7 | POST | `/riders/{userId}/vehicles/{vehicleId}/image` | Upload vehicle photo |
| 8 | GET | `/riders/required` | Display required documents |
| 9 | POST | `/riders/{userId}/documents` | Upload documents (x4) |
| 10 | GET | `/riders/{userId}/onboarding-status` | Check progress |
| 11 | POST | `/riders/{userId}/submit-verification` | Submit for approval |
| 12 | GET | `/riders/{userId}/onboarding-status` | Check verification status |

---

## Error Handling

```javascript
async function handleApiCall(endpoint, options) {
  try {
    const response = await fetch(endpoint, options);
    
    // Check if status code indicates success
    if (!response.ok) {
      const error = await response.json();
      
      if (response.status === 401) {
        // Token expired - refresh or redirect to login
        redirectToLogin();
      } else if (response.status === 400) {
        // Validation error
        showError(error.message || 'Invalid input');
      } else if (response.status === 404) {
        // Not found
        showError(error.message || 'Resource not found');
      } else if (response.status === 409) {
        // Conflict (e.g., user already exists)
        showError(error.message || 'User already exists');
      } else {
        // Generic error
        showError(error.message || 'Something went wrong');
      }
      return null;
    }
    
    return await response.json();
  } catch (error) {
    showError('Network error. Please try again.');
    return null;
  }
}
```

---

## Testing Checklist

- [ ] Register with valid email
- [ ] Verify with correct OTP
- [ ] Create vehicle with each type
- [ ] Upload valid vehicle image
- [ ] Upload valid documents
- [ ] Submit for verification
- [ ] Check verification status
- [ ] Test error cases (invalid inputs, network errors)
- [ ] Test edge cases (expired documents, large files)
- [ ] Test offline mode (save data locally)
- [ ] Test retry logic for failed uploads
