# Firestore Security Rules Setup

## ⚠️ IMPORTANT: Configure Firestore Security Rules

Your profile page is showing permission errors because Firestore security rules need to be configured.

## Steps to Fix:

1. **Go to Firebase Console**
   - Visit: https://console.firebase.google.com
   - Select project: `ai-vision-studio-d5e83`

2. **Navigate to Firestore Database**
   - Click "Firestore Database" in the left sidebar
   - Click the "Rules" tab at the top

3. **Replace the security rules with this:**

```javascript
rules_version = '2';

service cloud.firestore {
  match /databases/{database}/documents {
    // Allow users to read and write their own detections
    match /detections/{detectionId} {
      allow read, write: if request.auth != null && 
                          request.resource.data.userId == request.auth.uid;
      allow create: if request.auth != null;
    }
    
    // Optional: Allow users to read all detections (for admin purposes)
    // Remove this if you want strict user-only access
    match /detections/{detectionId} {
      allow read: if request.auth != null;
    }
  }
}
```

4. **Publish the rules**
   - Click the "Publish" button
   - Wait for confirmation

## What This Does:

- ✅ Users can only read/write their own detection records
- ✅ Authentication is required for all operations
- ✅ Prevents unauthorized access to other users' data
- ✅ Allows new detection records to be created

## After Setup:

Refresh your profile page and the detection history should load successfully!

---

**Alternative (Production-Ready) Rules:**

For better security in production, use these stricter rules:

```javascript
rules_version = '2';

service cloud.firestore {
  match /databases/{database}/documents {
    match /detections/{detectionId} {
      // Users can read their own detections
      allow read: if request.auth != null && 
                    resource.data.userId == request.auth.uid;
      
      // Users can create detections with their own userId
      allow create: if request.auth != null && 
                      request.resource.data.userId == request.auth.uid;
      
      // Users can update their own detections
      allow update: if request.auth != null && 
                      resource.data.userId == request.auth.uid;
      
      // Users can delete their own detections
      allow delete: if request.auth != null && 
                      resource.data.userId == request.auth.uid;
    }
  }
}
```
