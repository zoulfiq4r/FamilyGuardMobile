# Firebase Cloud Storage Setup

## Enable Cloud Storage in Firebase Console

1. Go to: https://console.firebase.google.com/project/familyguard-37a27/storage
2. Click "Get Started"
3. Choose production mode (we'll set rules manually)
4. Select your storage location (choose closest to your users)

## Set Storage Security Rules

Go to Storage → Rules tab and replace with:

```javascript
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    // Screenshots path: screenshots/{childId}/{packageName}/{timestamp}.jpg
    match /screenshots/{childId}/{packageName}/{timestamp} {
      // Only authenticated users can write
      allow write: if request.auth != null;
      
      // Parents can read their children's screenshots
      allow read: if request.auth != null && 
                     exists(/databases/(default)/documents/pairing/$(childId)) &&
                     get(/databases/(default)/documents/pairing/$(childId)).data.parentId == request.auth.uid;
    }
    
    // Deny all other access
    match /{allPaths=**} {
      allow read, write: if false;
    }
  }
}
```

## Test Storage Access

After applying rules, the app will automatically upload screenshots to:
`gs://familyguard-37a27.appspot.com/screenshots/{childId}/{packageName}/{timestamp}.jpg`

## Verify Upload

Check Firebase Console → Storage → Files to see uploaded screenshots.
