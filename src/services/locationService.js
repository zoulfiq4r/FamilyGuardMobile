
import Geolocation from '@react-native-community/geolocation';
import BackgroundTimer from 'react-native-background-timer';
import { collections, serverTimestamp } from '../config/firebase';
import DeviceInfo from 'react-native-device-info';
import { PermissionsAndroid, Platform, Alert } from 'react-native';

let locationInterval = null;

// Request location permissions
export const requestLocationPermission = async (showExplanation = false) => {
  if (Platform.OS === 'android') {
    try {
      const hasFineLocation = await PermissionsAndroid.check(
        PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
      );

      if (!hasFineLocation) {
        // If showing explanation (e.g., after pairing), show alert first
        if (showExplanation) {
          await new Promise((resolve) => {
            Alert.alert(
              'Location Permission Required',
              'FamilyGuard needs access to your location to keep you safe. Your parent will be able to see your location for monitoring purposes.',
              [
                {
                  text: 'Grant Permission',
                  onPress: () => resolve(undefined),
                  style: 'default'
                }
              ],
              { cancelable: false }
            );
          });
        }

        console.log('📍 Requesting location permission...');
        const granted = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
          {
            title: 'FamilyGuard Location Permission',
            message: 'FamilyGuard needs access to your location for safety monitoring.',
            buttonNeutral: 'Ask Me Later',
            buttonNegative: 'Cancel',
            buttonPositive: 'OK',
          }
        );

        if (granted !== PermissionsAndroid.RESULTS.GRANTED) {
          console.log('❌ Location permission denied:', granted);
          return false;
        }
        console.log('✅ Location permission granted');
      } else {
        console.log('✅ Location permission already granted');
      }

      // Also request background location for Android 10+ (optional)
      if (Platform.Version >= 29) {
        try {
          const hasBackground = await PermissionsAndroid.check(
            PermissionsAndroid.PERMISSIONS.ACCESS_BACKGROUND_LOCATION,
          );
          if (!hasBackground) {
            const bgGranted = await PermissionsAndroid.request(
              PermissionsAndroid.PERMISSIONS.ACCESS_BACKGROUND_LOCATION,
              {
                title: 'Background Location Permission',
                message: 'Allow FamilyGuard to access location in the background?',
                buttonNeutral: 'Ask Me Later',
                buttonNegative: 'Cancel',
                buttonPositive: 'OK',
              }
            );
            if (bgGranted === PermissionsAndroid.RESULTS.GRANTED) {
              console.log('✅ Background location permission granted');
            } else {
              console.log('⚠️ Background location permission not granted (will track in foreground only)');
            }
          } else {
            console.log('✅ Background location permission already granted');
          }
        } catch (bgError) {
          console.log('⚠️ Could not request background location (will track in foreground only):', bgError);
        }
      }

      // Return true if main location permission is granted, even if background is denied
      return true;
    } catch (err) {
      console.error('❌ Permission request error:', err);
      return false;
    }
  }
  // For iOS, return true (iOS permissions are handled differently)
  return true;
};

// Helper function to get location with retry and fallback strategy
const getLocationWithFallback = (options, attempt = 1) => {
  return new Promise((resolve, reject) => {
    console.log(`📍 Attempt ${attempt}: Requesting location with ${options.enableHighAccuracy ? 'GPS (high accuracy)' : 'network (standard)'}...`);
    
    Geolocation.getCurrentPosition(
      (position) => {
        resolve(position);
      },
      (error) => {
        // If high accuracy GPS times out, try with network location as fallback
        if (error.code === 3 && options.enableHighAccuracy && attempt === 1) {
          console.log('⚠️ GPS timed out, trying network location as fallback...');
          // Retry with network location (lower accuracy but faster)
          getLocationWithFallback(
            {
              enableHighAccuracy: false,
              timeout: 15000, // Shorter timeout for network location
              maximumAge: 10000, // Accept location up to 1 minute old for network
            },
            2
          )
            .then(resolve)
            .catch(reject);
        } else {
          reject(error);
        }
      },
      options
    );
  });
};

// Get current location and send to Firestore
export const sendLocationUpdate = async (childId) => {
  try {
    // Check if location is mock/test location (common emulator coordinates)
    const isMockLocation = (lat, lon) => {
      // Common test coordinates that indicate mock location
      const mockCoordinates = [
        { lat: 37.421998, lon: -122.084000 }, // Apple Park (emulator default)
        { lat: 37.386001, lon: -122.085938 }, // Cupertino area
        { lat: 0, lon: 0 }, // Null Island
      ];
      return mockCoordinates.some(mock => 
        Math.abs(mock.lat - lat) < 0.01 && Math.abs(mock.lon - lon) < 0.01
      );
    };

    console.log('📍 Requesting fresh location...');
    
    // First try with GPS (high accuracy), fallback to network if timeout
    const position = await getLocationWithFallback({
      enableHighAccuracy: true, // Try GPS first
      timeout: 20000, // Allow up to 20 seconds for the GPS fix
      maximumAge: 0, // Force fresh location for GPS attempt
      distanceFilter: 10, // Only update if moved 10 meters
    });

    const { latitude, longitude, accuracy, altitude, speed } = position.coords;
    
    console.log('📍 Location received:', { 
      latitude, 
      longitude, 
      accuracy,
      isMock: isMockLocation(latitude, longitude),
      altitude,
      speed
    });

    // Warn if accuracy is very poor or location seems like mock
    const isMock = isMockLocation(latitude, longitude);
    if (isMock) {
      console.warn('⚠️ Location appears to be mock/test location. Please ensure GPS is enabled and location services are on.');
      console.warn('📍 Current coordinates:', latitude, longitude, 'are test coordinates.');
      
      // Show prominent alert about mock location
      Alert.alert(
        '⚠️ Mock Location Detected',
        'Your device is using a test/mock location (37.42, -122.08). To get your real location:\n\n' +
        '1. Go to Settings → Developer Options\n' +
        '2. Turn OFF "Allow mock locations"\n' +
        '3. Enable GPS in Location settings\n' +
        '4. Set Location mode to "High accuracy"\n\n' +
        'The app will try to get your real location on the next update.',
        [{ text: 'OK' }]
      );
    }

    if (accuracy > 100 && !isMock) {
      console.warn('⚠️ Location accuracy is poor:', accuracy, 'meters. GPS might not be enabled.');
    }
    
    // Also warn if accuracy is suspiciously perfect (often indicates mock)
    if (accuracy < 10 && isMock) {
      console.warn('⚠️ Suspiciously precise accuracy for a mock location.');
    }

    const deviceId = await DeviceInfo.getUniqueId();

    const timestamp = serverTimestamp();
    const locationPayload = {
      childId,
      deviceId,
      latitude,
      longitude,
      accuracy,
      altitude: altitude || 0,
      speed: speed || 0,
      timestamp,
      isMockLocation: isMock,
    };

    // Save aggregate location log (legacy consumers)
    await collections.locations.add(locationPayload);
    console.log('🗺️ Wrote location to collection /locations for child', childId);

    const childDocRef = collections.children.doc(childId);

    // Write to per-child locations subcollection for dashboard map
    await childDocRef.collection('locations').add({
      latitude,
      longitude,
      accuracy,
      timestamp,
      deviceId,
    });
    console.log(`🗂️ Appended location under children/${childId}/locations`);

    // Update child's current location snapshot (preferred by dashboard)
    await childDocRef.set({
      currentLocation: {
        latitude,
        longitude,
        accuracy,
        timestamp,
        deviceId,
      },
      lastLocation: { // keep legacy field to avoid breaking older builds
        latitude,
        longitude,
        accuracy,
        timestamp,
      },
      lastSeen: timestamp,
    }, { merge: true });
    console.log(`🧭 Updated children/${childId}.currentLocation snapshot`);

    console.log('✅ Location sent to Firestore');
    return { latitude, longitude, accuracy };
  } catch (locationError) {
    console.error('❌ Location error:', locationError.code, locationError.message);
    
    // Provide helpful error messages
    let errorMessage = 'Failed to get location';
    if (locationError.code) {
      switch (locationError.code) {
        case 1: // PERMISSION_DENIED
          errorMessage = 'Location permission denied';
          break;
        case 2: // POSITION_UNAVAILABLE
          errorMessage = 'Location unavailable. Please check GPS settings.';
          break;
        case 3: // TIMEOUT
          errorMessage = 'Location request timed out. Please ensure GPS is enabled.';
          break;
      }
    }
    console.error('❌', errorMessage);
    throw new Error(errorMessage);
  }
};

// Start location tracking (every 5 minutes)
export const startLocationTracking = async (childId, showPermissionExplanation = true) => {
  console.log('🚀 Starting location tracking...');

  // Request permission first (show explanation if coming from pairing)
  const hasPermission = await requestLocationPermission(showPermissionExplanation);
  if (!hasPermission) {
    console.log('❌ Location permission not granted');
    return false;
  }

  // Send initial location with better error handling
  try {
    const locationResult = await sendLocationUpdate(childId);
    
    // Check if location seems invalid
    if (locationResult) {
      const { latitude, longitude, accuracy } = locationResult;
      
      // Check for common mock/test coordinates
      const isMockCoords = (latitude === 37.421998 && longitude === -122.084) || 
                           (Math.abs(latitude - 37.421998) < 0.001 && Math.abs(longitude + 122.084) < 0.001);
      
      if (isMockCoords) {
        console.warn('⚠️ Received test/mock location. Please check:');
        console.warn('   1. GPS is enabled in device settings');
        console.warn('   2. Location services are turned on');
        console.warn('   3. Mock location is disabled in Developer Options');
        console.warn('   4. Set Location mode to "High accuracy" (not Battery saving)');
        
        if (showPermissionExplanation) {
          Alert.alert(
            '⚠️ Mock Location Detected',
            'Your device is reporting a test location instead of your real location.\n\n' +
            'To fix this:\n' +
            '1. Settings → Developer Options → Turn OFF "Allow mock locations"\n' +
            '2. Settings → Location → Turn ON\n' +
            '3. Location mode → Select "High accuracy"\n' +
            '4. Go outside for better GPS signal\n\n' +
            'The app will retry getting your real location.',
            [{ text: 'OK' }]
          );
        }
      }
    }
  } catch (error) {
    console.error('❌ Failed to get initial location:', error);
    // Still continue with tracking - it will retry on next interval
  }

  // Set up interval to send location every 5 minutes (300000 ms)
  locationInterval = BackgroundTimer.setInterval(() => {
    sendLocationUpdate(childId);
  }, 300000); // 5 minutes

  console.log('✅ Location tracking started (5-minute intervals)');
  return true;
};

// Stop location tracking
export const stopLocationTracking = () => {
  if (locationInterval) {
    BackgroundTimer.clearInterval(locationInterval);
    locationInterval = null;
    console.log('⏹️ Location tracking stopped');
  }
};

// Get location tracking status from Firestore
export const checkLocationTrackingEnabled = async (deviceId) => {
  try {
    const controlsDoc = await collections.controls.doc(deviceId).get();
    if (controlsDoc.exists) {
      return controlsDoc.data().locationEnabled || false;
    }
    return false;
  } catch (error) {
    console.error('❌ Error checking location status:', error);
    return false;
  }
};

import Geolocation from '@react-native-community/geolocation';
import BackgroundTimer from 'react-native-background-timer';
import { collections } from '../config/firebase';
import firestore from '@react-native-firebase/firestore';
import DeviceInfo from 'react-native-device-info';
import { PermissionsAndroid, Platform, Alert } from 'react-native';

let locationInterval = null;

// Request location permissions
export const requestLocationPermission = async (showExplanation = false) => {
  if (Platform.OS === 'android') {
    try {
      // If showing explanation (e.g., after pairing), show alert first
      if (showExplanation) {
        await new Promise((resolve) => {
          Alert.alert(
            'Location Permission Required',
            'FamilyGuard needs access to your location to keep you safe. Your parent will be able to see your location for monitoring purposes.',
            [
              {
                text: 'Grant Permission',
                onPress: () => resolve(undefined),
                style: 'default'
              }
            ],
            { cancelable: false }
          );
        });
      }
      
      // Always request permission (request() handles already-granted permissions gracefully)
      // This ensures the flow is consistent and will show dialog if permission not granted
      console.log('📍 Requesting location permission...');
      
      const granted = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
        {
          title: 'FamilyGuard Location Permission',
          message: 'FamilyGuard needs access to your location for safety monitoring.',
          buttonNeutral: 'Ask Me Later',
          buttonNegative: 'Cancel',
          buttonPositive: 'OK',
        }
      );

      if (granted === PermissionsAndroid.RESULTS.GRANTED) {
        console.log('✅ Location permission granted');
        
        // Also request background location for Android 10+ (optional)
        if (Platform.Version >= 29) {
          try {
            const bgGranted = await PermissionsAndroid.request(
              PermissionsAndroid.PERMISSIONS.ACCESS_BACKGROUND_LOCATION,
              {
                title: 'Background Location Permission',
                message: 'Allow FamilyGuard to access location in the background?',
                buttonNeutral: 'Ask Me Later',
                buttonNegative: 'Cancel',
                buttonPositive: 'OK',
              }
            );
            if (bgGranted === PermissionsAndroid.RESULTS.GRANTED) {
              console.log('✅ Background location permission granted');
            } else {
              console.log('⚠️ Background location permission not granted (will track in foreground only)');
            }
          } catch (bgError) {
            console.log('⚠️ Could not request background location (will track in foreground only):', bgError);
          }
        }
        // Return true if main location permission is granted, even if background is denied
        return true;
      } else {
        console.log('❌ Location permission denied:', granted);
        return false;
      }
    } catch (err) {
      console.error('❌ Permission request error:', err);
      return false;
    }
  }
  // For iOS, return true (iOS permissions are handled differently)
  return true;
};

// Helper function to get location with retry and fallback strategy
const getLocationWithFallback = (options, attempt = 1) => {
  return new Promise((resolve, reject) => {
    console.log(`📍 Attempt ${attempt}: Requesting location with ${options.enableHighAccuracy ? 'GPS (high accuracy)' : 'network (standard)'}...`);
    
    Geolocation.getCurrentPosition(
      (position) => {
        resolve(position);
      },
      (error) => {
        // If high accuracy GPS times out, try with network location as fallback
        if (error.code === 3 && options.enableHighAccuracy && attempt === 1) {
          console.log('⚠️ GPS timed out, trying network location as fallback...');
          // Retry with network location (lower accuracy but faster)
          getLocationWithFallback(
            {
              enableHighAccuracy: false,
              timeout: 15000, // Shorter timeout for network location
              maximumAge: 10000, // Accept location up to 1 minute old for network
            },
            2
          )
            .then(resolve)
            .catch(reject);
        } else {
          reject(error);
        }
      },
      options
    );
  });
};

// Get current location and send to Firestore
export const sendLocationUpdate = async (childId) => {
  try {
    // Check if location is mock/test location (common emulator coordinates)
    const isMockLocation = (lat, lon) => {
      // Common test coordinates that indicate mock location
      const mockCoordinates = [
        { lat: 37.421998, lon: -122.084000 }, // Apple Park (emulator default)
        { lat: 37.386001, lon: -122.085938 }, // Cupertino area
        { lat: 0, lon: 0 }, // Null Island
      ];
      return mockCoordinates.some(mock => 
        Math.abs(mock.lat - lat) < 0.01 && Math.abs(mock.lon - lon) < 0.01
      );
    };

    console.log('📍 Requesting fresh location...');
    
    // First try with GPS (high accuracy), fallback to network if timeout
    const position = await getLocationWithFallback({
      enableHighAccuracy: true, // Try GPS first
      timeout: 60000, // Increased to 60 seconds for GPS fix
      maximumAge: 0, // Force fresh location for GPS attempt
      distanceFilter: 10, // Only update if moved 10 meters
    });

    const { latitude, longitude, accuracy, altitude, speed } = position.coords;
    
    console.log('📍 Location received:', { 
      latitude, 
      longitude, 
      accuracy,
      isMock: isMockLocation(latitude, longitude),
      altitude,
      speed
    });

    // Warn if accuracy is very poor or location seems like mock
    const isMock = isMockLocation(latitude, longitude);
    if (isMock) {
      console.warn('⚠️ Location appears to be mock/test location. Please ensure GPS is enabled and location services are on.');
      console.warn('📍 Current coordinates:', latitude, longitude, 'are test coordinates.');
      
      // Show prominent alert about mock location
      Alert.alert(
        '⚠️ Mock Location Detected',
        'Your device is using a test/mock location (37.42, -122.08). To get your real location:\n\n' +
        '1. Go to Settings → Developer Options\n' +
        '2. Turn OFF "Allow mock locations"\n' +
        '3. Enable GPS in Location settings\n' +
        '4. Set Location mode to "High accuracy"\n\n' +
        'The app will try to get your real location on the next update.',
        [{ text: 'OK' }]
      );
    }

    if (accuracy > 100 && !isMock) {
      console.warn('⚠️ Location accuracy is poor:', accuracy, 'meters. GPS might not be enabled.');
    }
    
    // Also warn if accuracy is suspiciously perfect (often indicates mock)
    if (accuracy < 10 && isMock) {
      console.warn('⚠️ Suspiciously precise accuracy for a mock location.');
    }

    const deviceId = await DeviceInfo.getUniqueId();

    // Save location to Firestore
    await collections.locations.add({
      childId,
      deviceId,
      latitude,
      longitude,
      accuracy,
      altitude: altitude || 0,
      speed: speed || 0,
      timestamp: firestore.FieldValue.serverTimestamp(),
      isMockLocation: isMockLocation(latitude, longitude),
    });

    // Update child's last location and last seen
    await collections.children.doc(childId).update({
      lastLocation: {
        latitude,
        longitude,
        accuracy,
        timestamp: firestore.FieldValue.serverTimestamp(),
      },
      lastSeen: firestore.FieldValue.serverTimestamp(),
    });

    console.log('✅ Location sent to Firestore');
    return { latitude, longitude, accuracy };
  } catch (locationError) {
    console.error('❌ Location error:', locationError.code, locationError.message);
    
    // Provide helpful error messages
    let errorMessage = 'Failed to get location';
    if (locationError.code) {
      switch (locationError.code) {
        case 1: // PERMISSION_DENIED
          errorMessage = 'Location permission denied';
          break;
        case 2: // POSITION_UNAVAILABLE
          errorMessage = 'Location unavailable. Please check GPS settings.';
          break;
        case 3: // TIMEOUT
          errorMessage = 'Location request timed out. Please ensure GPS is enabled.';
          break;
      }
    }
    console.error('❌', errorMessage);
    throw new Error(errorMessage);
  }
};

// Start location tracking (every 5 minutes)
export const startLocationTracking = async (childId, showPermissionExplanation = true) => {
  console.log('🚀 Starting location tracking...');

  // Request permission first (show explanation if coming from pairing)
  const hasPermission = await requestLocationPermission(showPermissionExplanation);
  if (!hasPermission) {
    console.log('❌ Location permission not granted');
    return false;
  }

  // Send initial location with better error handling
  try {
    const locationResult = await sendLocationUpdate(childId);
    
    // Check if location seems invalid
    if (locationResult) {
      const { latitude, longitude, accuracy } = locationResult;
      
      // Check for common mock/test coordinates
      const isMockCoords = (latitude === 37.421998 && longitude === -122.084) || 
                           (Math.abs(latitude - 37.421998) < 0.001 && Math.abs(longitude + 122.084) < 0.001);
      
      if (isMockCoords) {
        console.warn('⚠️ Received test/mock location. Please check:');
        console.warn('   1. GPS is enabled in device settings');
        console.warn('   2. Location services are turned on');
        console.warn('   3. Mock location is disabled in Developer Options');
        console.warn('   4. Set Location mode to "High accuracy" (not Battery saving)');
        
        if (showPermissionExplanation) {
          Alert.alert(
            '⚠️ Mock Location Detected',
            'Your device is reporting a test location instead of your real location.\n\n' +
            'To fix this:\n' +
            '1. Settings → Developer Options → Turn OFF "Allow mock locations"\n' +
            '2. Settings → Location → Turn ON\n' +
            '3. Location mode → Select "High accuracy"\n' +
            '4. Go outside for better GPS signal\n\n' +
            'The app will retry getting your real location.',
            [{ text: 'OK' }]
          );
        }
      }
    }
  } catch (error) {
    console.error('❌ Failed to get initial location:', error);
    // Still continue with tracking - it will retry on next interval
  }

  // Set up interval to send location every 5 minutes (300000 ms)
  locationInterval = BackgroundTimer.setInterval(() => {
    sendLocationUpdate(childId);
  }, 300000); // 5 minutes

  console.log('✅ Location tracking started (5-minute intervals)');
  return true;
};

// Stop location tracking
export const stopLocationTracking = () => {
  if (locationInterval) {
    BackgroundTimer.clearInterval(locationInterval);
    locationInterval = null;
    console.log('⏹️ Location tracking stopped');
  }
};

// Get location tracking status from Firestore
export const checkLocationTrackingEnabled = async (deviceId) => {
  try {
    const controlsDoc = await collections.controls.doc(deviceId).get();
    if (controlsDoc.exists) {
      return controlsDoc.data().locationEnabled || false;
    }
    return false;
  } catch (error) {
    console.error('❌ Error checking location status:', error);
    return false;
  }
};

