import storage from '@react-native-firebase/storage';
import { ref, uploadString, getDownloadURL } from '@react-native-firebase/storage';

/**
 * Upload screenshot to Firebase Cloud Storage
 * @param {string} base64Image - Base64 encoded screenshot
 * @param {string} childId - Child device ID
 * @param {string} packageName - App package name
 * @param {number} timestamp - Capture timestamp
 * @returns {Promise<string>} - Download URL of uploaded screenshot
 */
export const uploadScreenshot = async (base64Image, childId, packageName, timestamp) => {
  try {
    // Create a unique filename: screenshots/{childId}/{packageName}/{timestamp}.jpg
    const filename = `screenshots/${childId}/${packageName}/${timestamp}.jpg`;

    console.log(`📤 Uploading screenshot to Cloud Storage: ${filename}`);
    
    // Upload to Cloud Storage using modular API
    const storageRef = ref(storage(), filename);
    await uploadString(storageRef, base64Image, 'base64', {
      contentType: 'image/jpeg',
      customMetadata: {
        childId,
        packageName,
        timestamp: timestamp.toString(),
      },
    });

    // Get download URL
    const downloadURL = await getDownloadURL(storageRef);
    console.log(`✅ Screenshot uploaded successfully: ${downloadURL.substring(0, 50)}...`);

    return downloadURL;
  } catch (error) {
    console.error('❌ Failed to upload screenshot:', error.code || error.message);
    throw error;
  }
};

/**
 * Delete screenshot from Cloud Storage
 * @param {string} screenshotUrl - Download URL of the screenshot
 */
export const deleteScreenshot = async (screenshotUrl) => {
  try {
    if (!screenshotUrl) {
      console.warn('⚠️  No screenshot URL to delete');
      return;
    }

    // Extract path from URL
    // Format: https://firebasestorage.googleapis.com/v0/b/{bucket}/o/screenshots%2F...
    const matches = screenshotUrl.match(/\/o\/(.+?)\?/);
    if (!matches) {
      console.warn('⚠️  Could not extract path from screenshot URL');
      return;
    }

    const path = decodeURIComponent(matches[1]);
    console.log(`🗑️  Deleting screenshot: ${path}`);
    await firebase.storage().ref(path).delete();
    console.log(`✅ Screenshot deleted successfully`);
  } catch (error) {
    console.error('❌ Failed to delete screenshot:', error);
    throw error;
  }
};
