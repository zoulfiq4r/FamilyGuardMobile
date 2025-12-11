# Screenshot Monitoring & Content Analysis

Automatic screenshot capture and AI-powered content analysis for parental control monitoring.

## Features

- **Automatic Screenshot Capture**: Captures screenshots when suspicious apps (social media, browsers, messaging) are opened
- **AI Content Analysis**: Sends screenshots to Vision API server for SafeSearch analysis
- **Risk Classification**: Categorizes content as LOW, MEDIUM, HIGH, or CRITICAL based on SafeSearch scores
- **Firestore Alerts**: Creates content alert documents for parent review (MEDIUM+ risk only)
- **Offline Support**: Queues screenshots when offline, syncs when connection restored
- **Privacy-First**: Configurable app exclusions, local filtering, automatic screenshot deletion
- **Performance**: Debounced captures (1/min per app), image compression (max 500KB)

## Architecture

```
App Switch Detection (appUsageService)
    ↓
screenshotMonitoringService
    ↓
screenshotService.js (capture + compress)
    ↓
contentAnalysisService.js (POST to Vision API)
    ↓
contentAlertsService.js (write to Firestore)
```

## Configuration

Edit `src/config/screenshotConfig.js`:

```javascript
SCREENSHOT_CONFIG = {
  ENABLED_BY_DEFAULT: true,
  CAPTURE_COOLDOWN_MS: 60000, // 1 minute
  MAX_IMAGE_SIZE_KB: 500,
  IMAGE_QUALITY: 0.8,
  
  SUSPICIOUS_PATTERNS: ['facebook', 'instagram', 'chrome', ...],
  EXCLUDE_PATTERNS: ['settings', 'launcher', 'familyguard'],
  
  VISION_SERVER_URL: {
    development: 'http://10.0.2.2:5050/analyze',
    production: 'https://your-server.com/analyze',
  },
}
```

## Required Dependencies

```json
{
  "@react-native-community/netinfo": "^12.0.0",
  "react-native-fs": "^2.20.0",
  "react-native-view-shot": "^4.0.0"
}
```

Install:
```bash
npm install @react-native-community/netinfo react-native-fs react-native-view-shot
cd android && ./gradlew clean
cd .. && npx react-native run-android
```

## Firestore Rules

Add to `firestore.rules`:

```javascript
// Content alerts (screenshots analyzed by Vision API)
match /contentAlerts/{alertId} {
  allow read: if isAuth() && 
    (resource.data.parentId == request.auth.uid || 
     resource.data.childId == request.auth.uid);
  allow create: if isAuth();
  allow update: if isAuth() && resource.data.parentId == request.auth.uid;
}
```

Deploy rules:
```bash
firebase deploy --only firestore:rules
```

## Vision API Server

The mobile app expects a POST endpoint at `/analyze`:

**Request:**
```json
{
  "image": "base64_encoded_screenshot",
  "metadata": {
    "packageName": "com.instagram.android",
    "appName": "Instagram",
    "timestamp": 1733587200000
  }
}
```

**Response:**
```json
{
  "safeSearchScores": {
    "adult": "VERY_UNLIKELY",
    "violence": "UNLIKELY",
    "racy": "POSSIBLE",
    "medical": "VERY_UNLIKELY",
    "spoof": "UNLIKELY"
  },
  "riskLevel": "MEDIUM"
}
```

Example Python server using Google Cloud Vision:
```python
from flask import Flask, request, jsonify
from google.cloud import vision

app = Flask(__name__)
client = vision.ImageAnnotatorClient()

@app.route('/analyze', methods=['POST'])
def analyze():
    data = request.json
    image = vision.Image(content=base64.b64decode(data['image']))
    
    response = client.safe_search_detection(image=image)
    safe = response.safe_search_annotation
    
    return jsonify({
        'safeSearchScores': {
            'adult': safe.adult.name,
            'violence': safe.violence.name,
            'racy': safe.racy.name,
            'medical': safe.medical.name,
            'spoof': safe.spoof.name,
        },
        'riskLevel': calculate_risk(safe)
    })
```

## Usage

### Enable/Disable Monitoring

```javascript
import { setScreenshotMonitoring } from './services/screenshotMonitoringService';

// Enable
await setScreenshotMonitoring(true);

// Disable
await setScreenshotMonitoring(false);
```

### Query Alerts

```javascript
import { 
  getUnreviewedAlerts, 
  getAlertsByRiskLevel,
  markAlertAsReviewed 
} from './services/contentAlertsService';

// Get unreviewed alerts
const alerts = await getUnreviewedAlerts(childId, 20);

// Get high-risk alerts
const highRisk = await getAlertsByRiskLevel(childId, 'HIGH', 10);

// Mark as reviewed
await markAlertAsReviewed(alertId);
```

### Alert Document Structure

```javascript
{
  childId: "abc123",
  parentId: "xyz789",
  appName: "Instagram",
  packageName: "com.instagram.android",
  riskLevel: "MEDIUM",
  safeSearchScores: {
    adult: "UNLIKELY",
    violence: "VERY_UNLIKELY",
    racy: "POSSIBLE",
    medical: "VERY_UNLIKELY",
    spoof: "UNLIKELY"
  },
  reviewed: false,
  createdAt: Timestamp,
  capturedAt: 1733587200000
}
```

## Privacy Considerations

1. **Selective Capture**: Only suspicious apps trigger screenshots
2. **Exclusions**: System apps, launchers, keyboards are excluded
3. **Local Deletion**: Screenshots deleted immediately after analysis
4. **No Storage**: Images not stored in Firestore (only alert metadata)
5. **Parental Control**: Parents can disable monitoring at any time
6. **Transparency**: Clear logs show when captures occur

## Troubleshooting

**Screenshots not capturing:**
- Check `isScreenshotMonitoringEnabled()` returns true
- Verify pairing data exists in AsyncStorage
- Check app is in `SUSPICIOUS_PATTERNS` list
- Ensure not in cooldown period (1 min)

**Vision API errors:**
- Check server URL in config
- Verify network connectivity
- Check offline queue: `getOfflineQueueSize()`
- Review server logs for request format issues

**No alerts created:**
- Check risk level threshold (LOW is filtered by default)
- Verify Firestore rules allow contentAlerts writes
- Check parentId/childId in pairing data

**Performance issues:**
- Reduce `IMAGE_QUALITY` in config
- Increase `CAPTURE_COOLDOWN_MS`
- Reduce `SUSPICIOUS_PATTERNS` list
- Check `MAX_QUEUE_SIZE` not exceeded

## Testing

```bash
# Run tests
npm test

# Test screenshot capture
import { captureScreenshot } from './services/screenshotService';
const result = await captureScreenshot('com.test.app', 'Test App');
console.log(result);

# Test offline queue
import { getOfflineQueueSize, processOfflineQueue } from './services/contentAnalysisService';
const size = await getOfflineQueueSize();
await processOfflineQueue();

# Clear offline queue
import { clearOfflineQueue } from './services/contentAnalysisService';
await clearOfflineQueue();
```

## Future Enhancements

- [ ] OCR text extraction from screenshots
- [ ] Face detection/blurring for privacy
- [ ] Custom AI models (TensorFlow Lite on-device)
- [ ] Keyword filtering before upload
- [ ] Screenshot thumbnails for parent review
- [ ] Time-based capture schedules
- [ ] Machine learning training on user feedback
