# Firestore Security Rules - Content Alerts

Add this rule to your `firestore.rules` file in the web dashboard project:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    function isAuth() { return request.auth != null; }
    
    // ... existing rules ...

    // Content alerts (screenshot analysis results)
    match /contentAlerts/{alertId} {
      // Parents can read their children's alerts
      // Children can read alerts about themselves
      allow read: if isAuth() && (
        resource.data.parentId == request.auth.uid || 
        resource.data.childId == request.auth.uid
      );
      
      // Mobile app (child device) can create alerts
      allow create: if isAuth() && request.resource.data.childId is string;
      
      // Parents can mark alerts as reviewed
      allow update: if isAuth() && 
        resource.data.parentId == request.auth.uid &&
        request.resource.data.reviewed == true;
      
      // No deletes (keep audit trail)
      allow delete: if false;
    }
  }
}
```

## Deployment

From your web dashboard project directory:

```bash
firebase deploy --only firestore:rules
```

## Testing Rules

```javascript
// Test parent read access
firebase.firestore().collection('contentAlerts')
  .where('parentId', '==', parentAuthUid)
  .get();

// Test child read access  
firebase.firestore().collection('contentAlerts')
  .where('childId', '==', childAuthUid)
  .get();

// Test mobile app create
firebase.firestore().collection('contentAlerts').add({
  childId: 'abc123',
  parentId: 'xyz789',
  appName: 'Test',
  riskLevel: 'HIGH',
  safeSearchScores: {...},
  reviewed: false,
  createdAt: firebase.firestore.FieldValue.serverTimestamp()
});

// Test parent review
firebase.firestore().collection('contentAlerts').doc(alertId).update({
  reviewed: true,
  reviewedAt: firebase.firestore.FieldValue.serverTimestamp()
});
```

## Security Considerations

1. **Authentication Required**: All operations require `isAuth()`
2. **Read Isolation**: Users can only read alerts where they are parent or child
3. **Create Validation**: New alerts must have valid `childId`
4. **Update Restriction**: Only parents can mark as reviewed
5. **Delete Prevention**: Alerts are permanent (audit trail)
6. **Field Validation**: Add constraints for riskLevel enum, required fields

## Enhanced Rules (Optional)

For stricter validation:

```javascript
match /contentAlerts/{alertId} {
  function isParent() {
    return isAuth() && resource.data.parentId == request.auth.uid;
  }
  
  function isChild() {
    return isAuth() && resource.data.childId == request.auth.uid;
  }
  
  function validRiskLevel() {
    return request.resource.data.riskLevel in ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];
  }
  
  function hasRequiredFields() {
    return request.resource.data.keys().hasAll([
      'childId', 'appName', 'riskLevel', 'safeSearchScores', 'reviewed', 'createdAt'
    ]);
  }
  
  allow read: if isParent() || isChild();
  
  allow create: if isAuth() && 
    hasRequiredFields() && 
    validRiskLevel() &&
    request.resource.data.reviewed == false;
  
  allow update: if isParent() && 
    request.resource.data.reviewed == true &&
    request.resource.data.diff(resource.data).affectedKeys().hasOnly(['reviewed', 'reviewedAt']);
  
  allow delete: if false;
}
```
