import NetInfo from '@react-native-community/netinfo';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getFunctions, httpsCallable } from '@react-native-firebase/functions';
import { SCREENSHOT_CONFIG } from '../config/screenshotConfig';

const OFFLINE_QUEUE_KEY = '@familyguard_offline_queue';
const MAX_RETRY_ATTEMPTS = SCREENSHOT_CONFIG.MAX_RETRY_ATTEMPTS;
const RETRY_DELAY_MS = SCREENSHOT_CONFIG.RETRY_DELAY_MS;

// Initialize Firebase Functions
const functions = getFunctions();

/**
 * Call Cloud Vision API via Firebase Cloud Function
 * This uses the real Google Cloud Vision API for content analysis
 */
const callCloudVisionAPI = async (base64Image, metadata = {}) => {
  const analyzeScreenshot = httpsCallable(functions, 'analyzeScreenshot');
  
  const result = await analyzeScreenshot({
    base64Image,
    childId: metadata.childId,
    packageName: metadata.packageName,
    appName: metadata.appName,
  });
  
  return result.data;
};

/**
 * Analyze screenshot using Vision API server
 * @param {string} base64Image - Base64 encoded screenshot
 * @param {object} metadata - Additional metadata (packageName, appName, timestamp)
 * @returns {Promise<{safeSearchScores: object, riskLevel: string}>}
 */
export const analyzeScreenshot = async (base64Image, metadata = {}) => {
  let attempt = 0;
  let lastError = null;

  while (attempt < MAX_RETRY_ATTEMPTS) {
    try {
      console.log(`🔍 Analyzing screenshot (attempt ${attempt + 1}/${MAX_RETRY_ATTEMPTS})...`);

      // Call Cloud Vision API via Firebase Cloud Function
      const result = await callCloudVisionAPI(base64Image, metadata);
      
      console.log('✅ Screenshot analysis complete:', result.riskLevel);

      // Expected response format:
      // {
      //   safeSearchScores: { adult, violence, racy, medical, spoof },
      //   riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'
      // }

      return {
        safeSearchScores: result.safeSearchScores || {
          adult: 'UNKNOWN',
          violence: 'UNKNOWN',
          racy: 'UNKNOWN',
          medical: 'UNKNOWN',
          spoof: 'UNKNOWN',
        },
        riskLevel: result.riskLevel || calculateRiskLevel(result.safeSearchScores),
      };
    } catch (error) {
      lastError = error;
      attempt++;
      
      console.warn(`⚠️  Analysis attempt ${attempt} failed:`, error.message);

      if (attempt < MAX_RETRY_ATTEMPTS) {
        // Wait before retrying
        await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS * attempt));
      }
    }
  }

  // All retries failed
  console.error('❌ All analysis attempts failed:', lastError);
  throw lastError;
};

/**
 * Calculate risk level from SafeSearch scores
 */
const calculateRiskLevel = (scores) => {
  if (!scores) return 'LOW';

  const levels = { VERY_UNLIKELY: 0, UNLIKELY: 1, POSSIBLE: 2, LIKELY: 3, VERY_LIKELY: 4, UNKNOWN: 0 };
  
  const adultScore = levels[scores.adult] || 0;
  const violenceScore = levels[scores.violence] || 0;
  const racyScore = levels[scores.racy] || 0;

  const maxScore = Math.max(adultScore, violenceScore, racyScore);

  if (maxScore >= 4) return 'CRITICAL';
  if (maxScore >= 3) return 'HIGH';
  if (maxScore >= 2) return 'MEDIUM';
  return 'LOW';
};

/**
 * Add screenshot to offline queue if network is unavailable
 */
const addToOfflineQueue = async (screenshotData) => {
  try {
    const queueJson = await AsyncStorage.getItem(OFFLINE_QUEUE_KEY);
    const queue = queueJson ? JSON.parse(queueJson) : [];
    
    queue.push({
      ...screenshotData,
      queuedAt: Date.now(),
    });

    // Keep queue size manageable
    if (queue.length > SCREENSHOT_CONFIG.MAX_QUEUE_SIZE) {
      queue.shift(); // Remove oldest
    }

    await AsyncStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(queue));
    console.log(`📦 Screenshot queued for offline sync (${queue.length} items in queue)`);
  } catch (error) {
    console.error('Failed to add screenshot to offline queue', error);
  }
};

/**
 * Process offline queue when network is restored
 */
export const processOfflineQueue = async (onAnalysisComplete) => {
  try {
    const queueJson = await AsyncStorage.getItem(OFFLINE_QUEUE_KEY);
    if (!queueJson) {
      return;
    }

    const queue = JSON.parse(queueJson);
    if (queue.length === 0) {
      return;
    }

    console.log(`📤 Processing offline queue (${queue.length} items)...`);

    const results = [];
    const failedItems = [];

    for (const item of queue) {
      try {
        // Validate that item has required base64 data - skip if missing
        if (!item.base64) {
          console.warn(`⚠️  Skipping invalid queue item for ${item.appName || 'unknown'}: missing base64 data`);
          console.log(`Debug: item keys = ${Object.keys(item).join(', ')}`);
          continue;
        }

        // Also validate childId is present
        if (!item.childId) {
          console.warn(`⚠️  Skipping queue item for ${item.appName}: missing childId`);
          continue;
        }

        const analysisResult = await analyzeScreenshot(item.base64, {
          childId: item.childId,
          packageName: item.packageName,
          appName: item.appName,
          timestamp: item.timestamp,
        });

        results.push({
          ...item,
          ...analysisResult,
        });

        // Call callback if provided
        if (onAnalysisComplete) {
          await onAnalysisComplete({
            ...item,
            ...analysisResult,
          });
        }
      } catch (error) {
        console.warn(`Failed to process queued item for ${item.appName || 'unknown'}:`, error);
        
        // Re-queue if not too old
        const maxAgeMs = SCREENSHOT_CONFIG.QUEUE_EXPIRY_HOURS * 60 * 60 * 1000;
        if (Date.now() - item.queuedAt < maxAgeMs) {
          failedItems.push(item);
        }
      }
    }

    // Update queue with failed items only
    await AsyncStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(failedItems));
    
    console.log(`✅ Offline queue processed: ${results.length} succeeded, ${failedItems.length} remaining`);

    return results;
  } catch (error) {
    console.error('Failed to process offline queue', error);
  }
};

/**
 * Analyze screenshot with offline fallback
 */
export const analyzeWithOfflineSupport = async (screenshotData, onAnalysisComplete) => {
  // Check network status
  const netInfo = await NetInfo.fetch();
  
  if (!netInfo.isConnected) {
    console.log('📡 No network connection, queueing screenshot for later analysis');
    await addToOfflineQueue(screenshotData);
    return null;
  }

  try {
    const result = await analyzeScreenshot(screenshotData.base64, {
      childId: screenshotData.childId,
      packageName: screenshotData.packageName,
      appName: screenshotData.appName,
      timestamp: screenshotData.timestamp,
    });

    // Call completion callback
    if (onAnalysisComplete) {
      await onAnalysisComplete({
        ...screenshotData,
        ...result,
      });
    }

    return result;
  } catch (error) {
    console.warn('Analysis failed, queueing for retry', error);
    await addToOfflineQueue(screenshotData);
    return null;
  }
};

/**
 * Setup network listener to auto-process queue when connection is restored
 */
export const setupOfflineQueueSync = (onAnalysisComplete) => {
  const unsubscribe = NetInfo.addEventListener((state) => {
    if (state.isConnected) {
      console.log('📡 Network restored, processing offline queue...');
      processOfflineQueue(onAnalysisComplete).catch((error) => {
        console.error('Failed to process offline queue on reconnect', error);
      });
    }
  });

  return unsubscribe;
};

/**
 * Clear offline queue (useful for testing or manual cleanup)
 */
export const clearOfflineQueue = async () => {
  await AsyncStorage.removeItem(OFFLINE_QUEUE_KEY);
  console.log('🗑️  Offline queue cleared');
};

/**
 * Get offline queue size
 */
export const getOfflineQueueSize = async () => {
  try {
    const queueJson = await AsyncStorage.getItem(OFFLINE_QUEUE_KEY);
    const queue = queueJson ? JSON.parse(queueJson) : [];
    return queue.length;
  } catch (error) {
    return 0;
  }
};
