# Google Cloud Vision API Integration

## Prerequisites

1. **Enable Cloud Vision API**
   - Go to: https://console.cloud.google.com/apis/library/vision.googleapis.com
   - Select your Firebase project
   - Click "Enable"

2. **Create Service Account** (if not done already)
   - Go to: https://console.cloud.google.com/iam-admin/serviceaccounts
   - Create service account with Vision API access
   - Download JSON key file

## Backend Server Setup

You need a backend server to handle Vision API calls because:
- API keys shouldn't be exposed in mobile apps
- Cloud Vision API requires server-side authentication

### Option A: Cloud Functions (Recommended)

Create `functions/analyzeScreenshot.js`:

```javascript
const functions = require('firebase-functions');
const admin = require('firebase-admin');
const vision = require('@google-cloud/vision');

const client = new vision.ImageAnnotatorClient();

exports.analyzeScreenshot = functions.https.onCall(async (data, context) => {
  // Verify authentication
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
  }

  const { base64Image, childId, packageName } = data;

  try {
    // Perform Safe Search detection
    const [result] = await client.safeSearchDetection({
      image: { content: base64Image }
    });

    const safeSearch = result.safeSearchAnnotation;

    // Convert likelihood to scores (0-5)
    const likelihoodToScore = {
      'UNKNOWN': 0,
      'VERY_UNLIKELY': 1,
      'UNLIKELY': 2,
      'POSSIBLE': 3,
      'LIKELY': 4,
      'VERY_LIKELY': 5
    };

    const scores = {
      adult: likelihoodToScore[safeSearch.adult] || 0,
      violence: likelihoodToScore[safeSearch.violence] || 0,
      racy: likelihoodToScore[safeSearch.racy] || 0,
      medical: likelihoodToScore[safeSearch.medical] || 0,
      spoof: likelihoodToScore[safeSearch.spoof] || 0
    };

    // Calculate risk level
    const maxScore = Math.max(...Object.values(scores));
    let riskLevel;
    if (maxScore >= 4) riskLevel = 'CRITICAL';
    else if (maxScore >= 3) riskLevel = 'HIGH';
    else if (maxScore >= 2) riskLevel = 'MEDIUM';
    else riskLevel = 'LOW';

    return {
      safeSearchScores: scores,
      riskLevel,
      timestamp: Date.now()
    };

  } catch (error) {
    console.error('Vision API error:', error);
    throw new functions.https.HttpsError('internal', 'Failed to analyze image');
  }
});
```

Deploy:
```bash
cd functions
npm install @google-cloud/vision
firebase deploy --only functions:analyzeScreenshot
```

### Option B: Express Server

If you prefer your own server, create REST endpoint that:
1. Receives base64 image
2. Calls Cloud Vision API
3. Returns SafeSearch scores and risk level

## Update Mobile App

Replace mock API in `src/services/contentAnalysisService.js`:

```javascript
import { getFunctions, httpsCallable } from '@react-native-firebase/functions';

const analyzeScreenshotWithVision = async (base64Image, packageName) => {
  const functions = getFunctions();
  const analyzeScreenshot = httpsCallable(functions, 'analyzeScreenshot');
  
  const result = await analyzeScreenshot({
    base64Image,
    packageName,
  });
  
  return result.data;
};
```

## Testing

1. Deploy Cloud Function
2. Remove mock API code
3. Capture screenshot
4. Verify real Vision API results in Firestore alerts
