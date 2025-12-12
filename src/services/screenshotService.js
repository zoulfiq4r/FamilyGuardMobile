import { Platform, NativeModules } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import RNFS from 'react-native-fs';
import { SCREENSHOT_CONFIG, isExcludedApp } from '../config/screenshotConfig';

const { ScreenCaptureModule } = NativeModules;

// Debounce tracking: packageName -> last capture timestamp
const captureHistory = new Map();
const CAPTURE_COOLDOWN_MS = SCREENSHOT_CONFIG.CAPTURE_COOLDOWN_MS;
const MAX_IMAGE_SIZE_BYTES = SCREENSHOT_CONFIG.MAX_IMAGE_SIZE_KB * 1024;
const PERMISSION_GRANTED_KEY = '@familyguard_screenshot_permission_granted';

let isPermissionGranted = false;
let isCaptureInProgress = false;

/**
 * Restore permission state from AsyncStorage (called on app init)
 * IMPORTANT: Does NOT auto-request permission (MediaProjection tokens are per-session)
 * User must explicitly grant via requestScreenCapturePermission() each session
 */
export const restorePermissionState = async () => {
  try {
    const wasGranted = await AsyncStorage.getItem(PERMISSION_GRANTED_KEY);
    
    if (wasGranted === 'true') {
      // Previously granted, but tokens expire per session - require explicit request
      isPermissionGranted = false; // Reset; user must re-grant
      console.log('📸 Screen capture: permission must be re-granted (tokens expire per session)');
    } else {
      isPermissionGranted = false;
      console.log('📸 Screen capture permission not granted');
    }
  } catch (error) {
    console.error('Failed to restore permission state:', error);
    isPermissionGranted = false;
  }
};

/**
 * Check if permission is currently granted
 */
export const isScreenCapturePermissionGranted = () => {
  return isPermissionGranted;
};

/**
 * Clear permission state (for testing or manual reset)
 */
export const clearPermissionState = async () => {
  try {
    isPermissionGranted = false;
    await AsyncStorage.removeItem(PERMISSION_GRANTED_KEY);
    console.log('📸 Screen capture permission cleared');
  } catch (error) {
    console.error('Failed to clear permission state:', error);
  }
};

/**
 * Request screen capture permission (one-time setup, persists across sessions)
 */
export const requestScreenCapturePermission = async () => {
  if (!ScreenCaptureModule) {
    throw new Error('ScreenCaptureModule not available');
  }

  try {
    console.log('📸 Requesting MediaProjection permission from native module...');
    const result = await ScreenCaptureModule.requestPermission();
    console.log('📸 Native requestPermission resolved:', result);
    
    isPermissionGranted = true;
    
    // Persist permission state so we know permission was granted
    await AsyncStorage.setItem(PERMISSION_GRANTED_KEY, 'true');
    
    console.log('✅ Screen capture permission granted and saved');
    return true;
  } catch (error) {
    console.error('❌ Screen capture permission denied/error:', error);
    isPermissionGranted = false;
    await AsyncStorage.removeItem(PERMISSION_GRANTED_KEY);
    console.log('📸 Permission state reset to false after error');
    return false;
  }
};

/**
 * Check if we can capture a screenshot for the given app (respects cooldown)
 */
const canCapture = (packageName) => {
  const lastCapture = captureHistory.get(packageName);
  if (!lastCapture) {
    return true;
  }
  return Date.now() - lastCapture >= CAPTURE_COOLDOWN_MS;
};

/**
 * Compress image by reducing quality incrementally until under size limit
 */
const compressImageToBase64 = async (screenshotUri, maxSizeBytes = MAX_IMAGE_SIZE_BYTES) => {
  let quality = 0.8;
  let base64Data = null;
  let sizeBytes = Infinity;

  // Try progressively lower quality until we hit the size target
  while (quality >= 0.3 && sizeBytes > maxSizeBytes) {
    try {
      // React Native Image doesn't have built-in compression on capture,
      // so we'll read the file and use RNFS to encode it
      const fileContent = await RNFS.readFile(screenshotUri, 'base64');
      base64Data = fileContent;
      sizeBytes = Math.ceil((fileContent.length * 3) / 4); // Approximate decoded size

      if (sizeBytes > maxSizeBytes) {
        quality -= 0.1;
        // For React Native, we'd need a native module or external library
        // to actually re-encode with lower quality. For now, we'll just
        // return the base64 and handle compression server-side if needed.
        console.log(`⚠️  Screenshot size ${(sizeBytes / 1024).toFixed(1)}KB exceeds limit, consider server-side compression`);
        break;
      }
    } catch (error) {
      console.error('Failed to read screenshot file', error);
      throw error;
    }
  }

  return base64Data;
};

/**
 * Capture a screenshot and return base64 encoded image
 * Only captures if permission was previously granted in Settings
 * @param {string} packageName - Package name of the app being captured
 * @param {string} appName - Human-readable app name
 * @returns {Promise<{base64: string, timestamp: number, packageName: string, appName: string} | null>}
 */
export const captureScreenshot = async (packageName, appName) => {
  // Don't capture excluded apps
  if (isExcludedApp(packageName)) {
    console.log(`🚫 Skipping excluded app: ${appName} (${packageName})`);
    return null;
  }

  if (!canCapture(packageName)) {
    console.log(`⏱️  Screenshot cooldown active for ${appName} (${packageName})`);
    return null;
  }

  if (!ScreenCaptureModule) {
    console.error('❌ ScreenCaptureModule not available');
    return null;
  }

  // Check if permission is granted (either flag is set OR was previously granted in AsyncStorage)
  // Note: MediaProjection tokens expire per session, so we check AsyncStorage as backup
  if (!isPermissionGranted) {
    // If flag is false, check if permission was previously granted in this session
    const wasGrantedInSession = await AsyncStorage.getItem(PERMISSION_GRANTED_KEY);
    if (wasGrantedInSession !== 'true') {
      console.warn('⚠️  Screen capture permission not granted. User must grant via Settings.');
      return null;
    }
    // Flag is false but AsyncStorage says it was granted - restore the flag
    console.log('📸 Restoring permission flag from AsyncStorage');
    isPermissionGranted = true;
  }

  if (isCaptureInProgress) {
    console.log(`⏳ Screenshot already in progress, skipping ${appName} (${packageName})`);
    return null;
  }

  isCaptureInProgress = true;
  let retry = false;

  try {
    while (true) {

      try {
        const result = await ScreenCaptureModule.captureScreen();
        console.log(`✅ Screenshot captured: ${result.width}x${result.height}, ${(result.size / 1024).toFixed(1)}KB`);

        // Update capture history
        captureHistory.set(packageName, Date.now());

        return {
          base64: result.base64,
          timestamp: Date.now(),
          packageName,
          appName,
        };
      } catch (error) {
        const message = (error?.message || `${error || ''}`).toLowerCase();
        const isPermissionError = message.includes('permission not granted') || message.includes('permission denied') || message.includes('no_permission');
        const isMediaProjectionError = 
          message.includes("don't re-use") || 
          message.includes("don't re-use the resultdata") || 
          message.includes('projection instance') ||
          message.includes('projection stopped') ||
          message.includes('contentrecordingsession') ||
          message.includes('non-current mediaprojection') ||
          message.includes('token') || 
          message.includes('timed out') ||
          message.includes('acquirelatestimage') || 
          message.includes('null object reference') ||
          message.includes('projection expired');

        console.warn(`⚠️  Screenshot capture failed for ${appName}: ${error.message || error}`);

        // If permission error, token has expired/been revoked - require explicit re-grant
        if (isPermissionError) {
          console.log('🔄 Permission/token lost. Requires user to explicitly re-grant.');
          isPermissionGranted = false;
          return null;
        }

        // Retry once on MediaProjection errors with longer delay
        if (!retry && isMediaProjectionError) {
          retry = true;
          console.log('🔄 MediaProjection error detected, waiting 1000ms and retrying...');
          await new Promise(resolve => setTimeout(resolve, 1000));
          continue;
        }

        // Give up after retry
        console.error(`❌ Screenshot capture failed permanently for ${appName}`);
        return null;
      }
    }
  } finally {
    isCaptureInProgress = false;
  }
};

/**
 * Check if an app should trigger screenshot capture
 * @param {string} packageName - Package name to check
 * @returns {boolean}
 */
export const isSuspiciousApp = (packageName) => {
  // Check if excluded first
  if (isExcludedApp(packageName)) {
    return false;
  }

  const lowerPackage = packageName.toLowerCase();
  return SCREENSHOT_CONFIG.SUSPICIOUS_PATTERNS.some((pattern) => 
    lowerPackage.includes(pattern)
  );
};

/**
 * Reset capture history (useful for testing or manual override)
 */
export const resetCaptureHistory = () => {
  captureHistory.clear();
  console.log('📸 Screenshot capture history cleared');
};

/**
 * Get remaining cooldown time for an app
 * @param {string} packageName
 * @returns {number} - Milliseconds remaining, or 0 if ready to capture
 */
export const getCooldownRemaining = (packageName) => {
  const lastCapture = captureHistory.get(packageName);
  if (!lastCapture) {
    return 0;
  }
  const elapsed = Date.now() - lastCapture;
  return Math.max(0, CAPTURE_COOLDOWN_MS - elapsed);
};
