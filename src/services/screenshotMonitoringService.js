import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppState, NativeModules } from 'react-native';
import { captureScreenshot, isSuspiciousApp, requestScreenCapturePermission, restorePermissionState, isScreenCapturePermissionGranted } from './screenshotService';
import { analyzeWithOfflineSupport, setupOfflineQueueSync } from './contentAnalysisService';
import { createContentAlert } from './contentAlertsService';
import { SCREENSHOT_CONFIG, shouldCreateAlert } from '../config/screenshotConfig';

const { AppUsageModule } = NativeModules;

const PAIRING_DATA_KEY = '@familyguard_pairing';
const FEATURE_ENABLED_KEY = '@familyguard_screenshot_monitoring_enabled';
const PERMISSION_GRANTED_KEY = '@familyguard_screenshot_permission_granted';

let isMonitoringEnabled = SCREENSHOT_CONFIG.ENABLED_BY_DEFAULT;
let pairingData = null;
let queueSyncUnsubscribe = null;
let lastHandledApp = null;
let lastHandledTime = 0;
const HANDLE_DEBOUNCE_MS = 2000; // Don't handle same app within 2 seconds

/**
 * Request screen capture permission
 */
export const requestPermission = async () => {
  try {
    console.log('📸 screenshotMonitoringService: Requesting permission...');
    const granted = await requestScreenCapturePermission();
    console.log('📸 screenshotMonitoringService: Permission result =', granted);
    return granted;
  } catch (error) {
    console.error('Failed to request screen capture permission', error);
    return false;
  }
};

/**
 * Initialize screenshot monitoring system
 */
export const initializeScreenshotMonitoring = async () => {
  try {
    // First, restore permission state from AsyncStorage (this just checks if permission was granted before)
    // This does NOT request permission - it only restores the saved state
    await restorePermissionState();

    // Check if feature is enabled (defaults to config value if not set)
    const enabled = await AsyncStorage.getItem(FEATURE_ENABLED_KEY);
    isMonitoringEnabled = enabled !== null ? enabled === 'true' : SCREENSHOT_CONFIG.ENABLED_BY_DEFAULT;

    // Load pairing data for childId and parentId
    const pairingJson = await AsyncStorage.getItem(PAIRING_DATA_KEY);
    if (pairingJson) {
      pairingData = JSON.parse(pairingJson);
    }

    // Setup offline queue sync
    if (queueSyncUnsubscribe) {
      queueSyncUnsubscribe();
    }
    queueSyncUnsubscribe = setupOfflineQueueSync(handleAnalysisComplete);

    console.log(`📸 Screenshot monitoring ${isMonitoringEnabled ? 'ENABLED' : 'DISABLED'}`);
    console.log('📸 Grant permission from Settings each time app starts to enable screenshot capture');
  } catch (error) {
    console.error('Failed to initialize screenshot monitoring', error);
  }
};

/**
 * Enable or disable screenshot monitoring
 */
export const setScreenshotMonitoring = async (enabled) => {
  try {
    await AsyncStorage.setItem(FEATURE_ENABLED_KEY, enabled ? 'true' : 'false');
    isMonitoringEnabled = enabled;
    console.log(`📸 Screenshot monitoring ${enabled ? 'ENABLED' : 'DISABLED'}`);
  } catch (error) {
    console.error('Failed to set screenshot monitoring state', error);
    throw error; // Propagate error to tests
  }
};

/**
 * Alias for setScreenshotMonitoring (for test compatibility)
 */
export const setMonitoringEnabled = setScreenshotMonitoring;

/**
 * Check if monitoring is currently enabled
 * @returns {boolean}
 */
export const getMonitoringEnabled = () => isMonitoringEnabled;

/**
 * Check if monitoring is enabled (legacy alias)
 * @returns {boolean}
 */
export const isScreenshotMonitoringEnabled = () => isMonitoringEnabled;

/**
 * Handle app switch event - capture screenshot if suspicious
 * @param {string} packageName - Package name of foreground app
 * @param {string} appName - Human-readable app name
 */
export const handleAppSwitch = async (packageName, appName) => {
  if (!isMonitoringEnabled) {
    return;
  }

  if (!pairingData?.childId) {
    console.warn('📸 Screenshot monitoring skipped: no pairing data');
    return;
  }

  // Check if app is suspicious
  if (!isSuspiciousApp(packageName)) {
    return;
  }

  // Debounce: prevent handling same app multiple times in quick succession
  const now = Date.now();
  if (lastHandledApp === packageName && (now - lastHandledTime) < HANDLE_DEBOUNCE_MS) {
    console.log(`⏭️  Skipping duplicate ${appName} (debounced)`);
    return; // Skip duplicate detection within debounce window
  }

  lastHandledApp = packageName;
  lastHandledTime = now;

  console.log(`🔍 Suspicious app detected: ${appName} (${packageName})`);
  console.log(`📸 Capturing screenshot of ${appName}...`);

  try {
    // Capture screenshot
    const screenshot = await captureScreenshot(packageName, appName);
    
    if (!screenshot) {
      console.log(`❌ Screenshot capture returned null for ${appName} - check cooldown or permission`);
      return;
    }

    console.log(`✅ Screenshot captured: ${screenshot.base64?.length || 0} bytes`);

    // Add childId to screenshot data for offline queue
    const screenshotWithContext = {
      ...screenshot,
      childId: pairingData.childId,
    };

    // Analyze screenshot with offline support
    await analyzeWithOfflineSupport(screenshotWithContext, handleAnalysisComplete);
  } catch (error) {
    console.error(`Failed to capture/analyze screenshot for ${appName}:`, error);
  }
};

/**
 * Handle completed analysis (called after analysis or from offline queue)
 */
const handleAnalysisComplete = async (result) => {
  try {
    if (!pairingData?.childId) {
      console.warn('Cannot create alert: missing pairing data');
      return;
    }

    const { packageName, appName, safeSearchScores, riskLevel, base64 } = result;

    // Only create alerts based on config thresholds
    if (!shouldCreateAlert(riskLevel)) {
      console.log(`✅ ${appName} analysis complete: ${riskLevel} risk, no alert created`);
      return;
    }

    console.log(`🚨 Creating ${riskLevel} risk alert for ${appName}`);

    // Create content alert in Firestore
    await createContentAlert({
      childId: pairingData.childId,
      parentId: pairingData.parentId,
      appName,
      packageName,
      riskLevel,
      safeSearchScores,
      base64Screenshot: base64, // Pass the screenshot for Cloud Storage upload
      timestamp: result.timestamp,
    });

    console.log(`✅ Content alert created for ${appName} (${riskLevel})`);
  } catch (error) {
    console.error('Failed to handle analysis completion', error);
  }
};

/**
 * Update pairing data (call this when pairing changes)
 */
export const updatePairingData = (newPairingData) => {
  pairingData = newPairingData;
  console.log('📸 Screenshot monitoring pairing data updated');
};

/**
 * Cleanup monitoring resources
 */
export const cleanupScreenshotMonitoring = () => {
  if (queueSyncUnsubscribe) {
    queueSyncUnsubscribe();
    queueSyncUnsubscribe = null;
  }
  pairingData = null;
  console.log('📸 Screenshot monitoring cleaned up');
};
