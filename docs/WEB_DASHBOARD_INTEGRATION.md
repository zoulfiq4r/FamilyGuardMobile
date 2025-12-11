# Web Dashboard Integration Guide

## Alert Document Structure

Alerts are stored in Firestore at: `content_alerts/{alertId}`

### Document Schema:

```javascript
{
  // Identifiers
  alertId: "BiRtLkvkpHc6plhf2mbz",
  childId: "sQyQn4zsKv1FQ5qIFx1O",
  parentId: "lx3idMIi35OwyEPRFiVzaQPWgHj2",
  
  // App Information
  appName: "WhatsApp",
  packageName: "com.whatsapp",
  
  // Analysis Results
  riskLevel: "MEDIUM", // LOW | MEDIUM | HIGH | CRITICAL
  safeSearchScores: {
    adult: 0,
    violence: 2,
    racy: 1,
    medical: 0,
    spoof: 0
  },
  
  // Screenshot (if uploaded successfully)
  screenshotUrl: "https://firebasestorage.googleapis.com/.../screenshot.jpg",
  
  // Metadata
  timestamp: Timestamp,
  createdAt: Timestamp,
  reviewed: false,
  reviewedAt: null,
  reviewedBy: null,
  notes: null
}
```

## Web Dashboard Queries

### Get All Alerts for Parent

```javascript
import { collection, query, where, orderBy, getDocs } from 'firebase/firestore';

async function getAlertsForParent(parentId) {
  const alertsRef = collection(db, 'content_alerts');
  const q = query(
    alertsRef,
    where('parentId', '==', parentId),
    orderBy('timestamp', 'desc')
  );
  
  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data()
  }));
}
```

### Get High-Risk Alerts Only

```javascript
async function getHighRiskAlerts(parentId) {
  const alertsRef = collection(db, 'content_alerts');
  const q = query(
    alertsRef,
    where('parentId', '==', parentId),
    where('riskLevel', 'in', ['HIGH', 'CRITICAL']),
    orderBy('timestamp', 'desc')
  );
  
  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data()
  }));
}
```

### Get Alerts for Specific Child

```javascript
async function getChildAlerts(childId) {
  const alertsRef = collection(db, 'content_alerts');
  const q = query(
    alertsRef,
    where('childId', '==', childId),
    orderBy('timestamp', 'desc'),
    limit(50)
  );
  
  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data()
  }));
}
```

### Real-time Alerts Listener

```javascript
import { onSnapshot } from 'firebase/firestore';

function subscribeToAlerts(parentId, callback) {
  const alertsRef = collection(db, 'content_alerts');
  const q = query(
    alertsRef,
    where('parentId', '==', parentId),
    where('reviewed', '==', false),
    orderBy('timestamp', 'desc')
  );
  
  return onSnapshot(q, (snapshot) => {
    const alerts = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
    callback(alerts);
  });
}
```

### Mark Alert as Reviewed

```javascript
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';

async function markAlertAsReviewed(alertId, parentId, notes = null) {
  const alertRef = doc(db, 'content_alerts', alertId);
  await updateDoc(alertRef, {
    reviewed: true,
    reviewedAt: serverTimestamp(),
    reviewedBy: parentId,
    notes: notes
  });
}
```

## Display Screenshot

If screenshot was uploaded successfully:

```javascript
function AlertCard({ alert }) {
  return (
    <div className="alert-card">
      <div className="alert-header">
        <span className={`risk-badge ${alert.riskLevel.toLowerCase()}`}>
          {alert.riskLevel}
        </span>
        <span className="app-name">{alert.appName}</span>
        <span className="timestamp">
          {new Date(alert.timestamp.toDate()).toLocaleString()}
        </span>
      </div>
      
      {alert.screenshotUrl && (
        <img 
          src={alert.screenshotUrl} 
          alt="Screenshot"
          className="alert-screenshot"
        />
      )}
      
      <div className="safe-search-scores">
        <h4>Content Analysis:</h4>
        <ul>
          <li>Adult: {alert.safeSearchScores.adult}/5</li>
          <li>Violence: {alert.safeSearchScores.violence}/5</li>
          <li>Racy: {alert.safeSearchScores.racy}/5</li>
        </ul>
      </div>
      
      <button onClick={() => markAlertAsReviewed(alert.id)}>
        Mark as Reviewed
      </button>
    </div>
  );
}
```

## Dashboard Features to Implement

1. **Alert List View**
   - Show all alerts sorted by timestamp
   - Filter by risk level
   - Filter by child
   - Search by app name

2. **Alert Detail View**
   - Full screenshot preview
   - Complete SafeSearch scores
   - App information
   - Mark as reviewed
   - Add notes

3. **Statistics Dashboard**
   - Total alerts count
   - Alerts by risk level (pie chart)
   - Alerts by app (bar chart)
   - Timeline view

4. **Real-time Notifications**
   - Use onSnapshot to get instant updates
   - Show browser notification for HIGH/CRITICAL alerts
   - Badge count for unreviewed alerts

## Security Rules for Web Dashboard

Ensure Firestore rules allow parents to read their children's alerts:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /content_alerts/{alertId} {
      allow read: if request.auth != null && 
                     (resource.data.parentId == request.auth.uid);
      allow write: if false; // Only app can create alerts
    }
  }
}
```
