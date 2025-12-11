const functions = require('firebase-functions');
const admin = require('firebase-admin');
const vision = require('@google-cloud/vision');

// Initialize Firebase Admin
admin.initializeApp();

// Initialize Vision API client
const visionClient = new vision.ImageAnnotatorClient();

/**
 * Analyze screenshot using Google Cloud Vision API
 * This function is called from the mobile app with a base64 screenshot
 */
exports.analyzeScreenshot = functions.https.onCall(async (data, context) => {
  // Verify authentication
  if (!context.auth) {
    throw new functions.https.HttpsError(
      'unauthenticated',
      'User must be authenticated to analyze screenshots'
    );
  }

  const { base64Image, childId, packageName, appName } = data;

  // Validate input
  if (!base64Image || !childId || !packageName) {
    throw new functions.https.HttpsError(
      'invalid-argument',
      'Missing required parameters: base64Image, childId, packageName'
    );
  }

  try {
    console.log(`Analyzing screenshot for ${appName} (${packageName}), child: ${childId}`);

    // Perform Safe Search detection using Cloud Vision API
    const [result] = await visionClient.safeSearchDetection({
      image: {
        content: base64Image
      }
    });

    const safeSearch = result.safeSearchAnnotation;

    // Convert Google's likelihood enum to numeric scores (1-5)
    const likelihoodToScore = {
      'UNKNOWN': 0,
      'VERY_UNLIKELY': 1,
      'UNLIKELY': 2,
      'POSSIBLE': 3,
      'LIKELY': 4,
      'VERY_LIKELY': 5
    };

    // Extract scores
    const scores = {
      adult: likelihoodToScore[safeSearch.adult] || 0,
      violence: likelihoodToScore[safeSearch.violence] || 0,
      racy: likelihoodToScore[safeSearch.racy] || 0,
      medical: likelihoodToScore[safeSearch.medical] || 0,
      spoof: likelihoodToScore[safeSearch.spoof] || 0
    };

    // Calculate overall risk level based on maximum score
    const maxScore = Math.max(...Object.values(scores));
    let riskLevel;
    
    if (maxScore >= 4) {
      riskLevel = 'CRITICAL';
    } else if (maxScore >= 3) {
      riskLevel = 'HIGH';
    } else if (maxScore >= 2) {
      riskLevel = 'MEDIUM';
    } else {
      riskLevel = 'LOW';
    }

    console.log(`Analysis complete: ${riskLevel} risk (max score: ${maxScore})`);

    // Return analysis results
    return {
      safeSearchScores: scores,
      riskLevel,
      timestamp: Date.now(),
      rawResponse: {
        adult: safeSearch.adult,
        violence: safeSearch.violence,
        racy: safeSearch.racy,
        medical: safeSearch.medical,
        spoof: safeSearch.spoof
      }
    };

  } catch (error) {
    console.error('Vision API error:', error);
    
    // Return a more specific error
    if (error.code === 3) {
      throw new functions.https.HttpsError(
        'invalid-argument',
        'Invalid image format or corrupted image'
      );
    }
    
    throw new functions.https.HttpsError(
      'internal',
      'Failed to analyze screenshot: ' + error.message
    );
  }
});

/**
 * Optional: Analyze screenshot from Storage URL
 * This can be used if you want to analyze screenshots that are already uploaded
 */
exports.analyzeScreenshotFromUrl = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'Authentication required');
  }

  const { screenshotUrl, childId, packageName } = data;

  if (!screenshotUrl || !childId) {
    throw new functions.https.HttpsError('invalid-argument', 'Missing required parameters');
  }

  try {
    // Analyze image from Cloud Storage URL
    const [result] = await visionClient.safeSearchDetection({
      image: {
        source: { imageUri: screenshotUrl }
      }
    });

    const safeSearch = result.safeSearchAnnotation;

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

    const maxScore = Math.max(...Object.values(scores));
    let riskLevel = 'LOW';
    if (maxScore >= 4) riskLevel = 'CRITICAL';
    else if (maxScore >= 3) riskLevel = 'HIGH';
    else if (maxScore >= 2) riskLevel = 'MEDIUM';

    return {
      safeSearchScores: scores,
      riskLevel,
      timestamp: Date.now()
    };

  } catch (error) {
    console.error('Vision API error:', error);
    throw new functions.https.HttpsError('internal', 'Analysis failed: ' + error.message);
  }
});
