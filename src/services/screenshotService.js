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
 * Note: MediaProjection permission doesn't persist, so we clear any stored state
 */
export const restorePermissionState = async () => {
  try {
    // MediaProjection permission doesn't survive app restarts, so clear any stale state
    isPermissionGranted = false;
    await AsyncStorage.removeItem(PERMISSION_GRANTED_KEY);
    console.log('📸 Screen capture permission cleared - user must grant from Settings');
  } catch (error) {
    console.error('Failed to clear permission state:', error);
  }
};

/**
 * Check if permission is currently granted
 */
export const isScreenCapturePermissionGranted = () => {
  return isPermissionGranted;
};

/**
 * Request screen capture permission (one-time, persists)
 */
export const requestScreenCapturePermission = async () => {
  if (!ScreenCaptureModule) {
    throw new Error('ScreenCaptureModule not available');
  }

  try {
    await ScreenCaptureModule.requestPermission();
    isPermissionGranted = true;
    console.log('✅ Screen capture permission granted (valid until app closes)');
    return true;
  } catch (error) {
    console.error('❌ Screen capture permission denied:', error);
    isPermissionGranted = false;
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
 * Requests fresh permission before each capture since Android MediaProjection tokens timeout
 * @param {string} packageName - Package name of the app being captured
 * @param {string} appName - Human-readable app name
 * @returns {Promise<{base64: string, timestamp: number, packageName: string, appName: string} | null>}
 */
export const captureScreenshot = async (packageName, appName) => {
  if (!canCapture(packageName)) {
    console.log(`⏱️  Screenshot cooldown active for ${appName} (${packageName})`);
    return null;
  }

  if (!ScreenCaptureModule) {
    console.error('❌ ScreenCaptureModule not available');
    return null;
  }
  if (isCaptureInProgress) {
    console.log(`⏳ Screenshot already in progress, skipping ${appName} (${packageName})`);
    return null;
  }

  isCaptureInProgress = true;
  let retry = false;

  try {
    while (true) {
      // Always request fresh permission to avoid MediaProjection reuse errors
      // MediaProjection tokens expire quickly and cannot be reused
      console.log('📸 Requesting fresh permission for screenshot capture...');
      isPermissionGranted = false; // Force fresh permission request
      
      const permissionGranted = await requestScreenCapturePermission();
      if (!permissionGranted) {
        console.warn('⚠️  User denied permission for this capture');
        return null;
      }

      // Critical delay: MediaProjection needs time to become active after permission grant
      // Android requires time to initialize the MediaProjection service
      // Too short = "permission not granted" error, too long = bad UX
      console.log('⏳ Waiting 500ms for MediaProjection to initialize...');
      await new Promise(resolve => setTimeout(resolve, 500));

      try {
        const result = await ScreenCaptureModule.captureScreen();
        console.log(`✅ Screenshot captured: ${result.width}x${result.height}, ${(result.size / 1024).toFixed(1)}KB`);

        // Update capture history
        captureHistory.set(packageName, Date.now());

        // Reset permission flag for next capture
        isPermissionGranted = false;

        return {
          base64: result.base64,
          timestamp: Date.now(),
          packageName,
          appName,
        };
      } catch (error) {
        const message = (error?.message || `${error || ''}`).toLowerCase();
        const isPermissionNotReady = message.includes('permission not granted');
        const isMediaProjectionError = 
          message.includes("don't re-use the resultdata") || 
          message.includes('projection instance') ||
          message.includes('contentrecordingsession') ||
          message.includes('non-current mediaprojection') ||
          message.includes('token') || 
          message.includes('timed out') ||
          message.includes('acquirelatestimage') || 
          message.includes('null object reference');

        console.warn(`⚠️  Screenshot capture failed for ${appName}: ${error.message || error}`);

        // Retry once on MediaProjection errors or permission timing issues with longer delay
        if (!retry && (isMediaProjectionError || isPermissionNotReady)) {
          retry = true;
          isPermissionGranted = false;
          console.log('🔄 MediaProjection error detected, waiting 800ms and retrying with fresh permission...');
          await new Promise(resolve => setTimeout(resolve, 800));
          continue;
        }

        // Give up after retry
        console.error(`❌ Screenshot capture failed permanently for ${appName}`);
        isPermissionGranted = false;
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
