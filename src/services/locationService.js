// Lazy-load Geolocation to avoid NativeEventEmitter warnings during module initialization
// (some native modules create a NativeEventEmitter at import time which can warn
// if the native module doesn't implement the expected listener methods). We'll
// require it where needed so the emitter is only created when location is actually used.
import BackgroundTimer from 'react-native-background-timer';
import DeviceInfo from 'react-native-device-info';
import { PermissionsAndroid, Platform, Alert, Linking } from 'react-native';

import { addDoc, setDoc, collection, doc } from '@react-native-firebase/firestore';
import { collections, serverTimestamp, db } from '../config/firebase';

let locationInterval = null;

const requestAndroidPermission = async (showExplanation) => {
  try {
    const finePermission = PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION;
    const hasFine = await PermissionsAndroid.check(finePermission);

    if (!hasFine) {
      if (showExplanation) {
        await new Promise((resolve) => {
          Alert.alert(
            'Location Permission Required',
            'FamilyGuard needs access to your location so your parent can keep you safe.',
            [{ text: 'Grant Permission', onPress: resolve }],
            { cancelable: false },
          );
        });
      }

      const result = await PermissionsAndroid.request(finePermission, {
        title: 'FamilyGuard Location Permission',
        message: 'FamilyGuard needs access to your location for safety monitoring.',
        buttonPositive: 'OK',
      });

      if (result !== PermissionsAndroid.RESULTS.GRANTED) {
        console.log('❌ Location permission denied:', result);
        return false;
      }
    }

    if (Platform.Version >= 29) {
      const bgPermission = PermissionsAndroid.PERMISSIONS.ACCESS_BACKGROUND_LOCATION;
      const hasBackground = await PermissionsAndroid.check(bgPermission);
      if (!hasBackground) {
        await PermissionsAndroid.request(bgPermission);
      }
    }

    return true;
  } catch (error) {
    console.error('Failed to request location permission', error);
    return false;
  }
};

export const requestLocationPermission = async (showExplanation = false) => {
  if (Platform.OS !== 'android') {
    return true;
  }
  return requestAndroidPermission(showExplanation);
};

const getLocationWithFallback = (options, attempt = 1) =>
  new Promise((resolve, reject) => {
    // eslint-disable-next-line global-require
    const geoModule = require('@react-native-community/geolocation');
    // The geolocation module may be exported as the module itself or as the
    // `default` property depending on bundler/transpiler. Fall back to the
    // global `navigator.geolocation` if available.
    const Geolocation = (geoModule && typeof geoModule.getCurrentPosition === 'function')
      ? geoModule
      : (geoModule && typeof geoModule.default === 'object' && typeof geoModule.default.getCurrentPosition === 'function')
        ? geoModule.default
        : (global.navigator && global.navigator.geolocation)
          ? global.navigator.geolocation
          : geoModule;

    const attemptType = options.enableHighAccuracy ? 'GPS' : 'Network';
    console.log(`🌍 Attempt ${attempt} (${attemptType}): Starting location fetch...`);

    Geolocation.getCurrentPosition(
      (position) => {
        console.log(`✅ Attempt ${attempt} (${attemptType}): Location acquired - ${position.coords.latitude.toFixed(4)}, ${position.coords.longitude.toFixed(4)}`);
        resolve(position);
      },
      (error) => {
        const errorMsg = error?.message || 'Unknown error';
        console.log(`❌ Attempt ${attempt} (${attemptType}): Failed - ${errorMsg} (code: ${error?.code})`);

        // If the first (high-accuracy/GPS) attempt times out or reports
        // POSITION_UNAVAILABLE, retry once using reduced accuracy (network).
        // Only fallback to network for a timeout (code 3). Keep code 2 (POSITION_UNAVAILABLE)
        // mapped to a friendly GPS unavailable message.
        const shouldFallback = error?.code === 3 && options.enableHighAccuracy && attempt === 1;
        if (shouldFallback) {
          console.log(`⚠️  GPS failed, attempting fallback with Network...`);
          getLocationWithFallback(
            {
              enableHighAccuracy: false,
              timeout: 15000,
              maximumAge: 10000,
            },
            attempt + 1,
          )
            .then(resolve)
            .catch(reject);
        } else {
          reject(error);
        }
      },
      options,
    );
  });

const detectMockLocation = (lat, lon) => {
  const known = [
    { lat: 37.421998, lon: -122.084 },
    { lat: 37.386001, lon: -122.085938 },
    { lat: 0, lon: 0 },
  ];
  return known.some(
    (mock) => Math.abs(lat - mock.lat) < 0.01 && Math.abs(lon - mock.lon) < 0.01,
  );
};

export const sendLocationUpdate = async (childId) => {
  if (!childId) {
    throw new Error('Missing child identifier for location update.');
  }

  try {
    // First attempt: GPS/high accuracy. If that fails with timeout or
    // POSITION_UNAVAILABLE, getLocationWithFallback will perform one
    // fallback attempt using reduced accuracy (network).
    const position = await getLocationWithFallback({
      enableHighAccuracy: true,
      timeout: 20000,
      maximumAge: 0,
      distanceFilter: 10,
    });

    const { latitude, longitude, accuracy, altitude = 0, speed = 0 } = position.coords;
    const timestamp = Date.now();
    const deviceId = await DeviceInfo.getUniqueId();
    const isMock = detectMockLocation(latitude, longitude);

    const locationPayload = {
      childId,
      deviceId,
      latitude,
      longitude,
      accuracy,
      altitude,
      speed,
      timestamp,
      isMockLocation: isMock,
    };

    await addDoc(collections.locations, locationPayload);

    const childDocRef = doc(collections.children, childId);
    // For sub-collection, use the modular API correctly with path strings
    const childLocationsRef = collection(db, 'children', childId, 'locations');
    await addDoc(childLocationsRef, {
      latitude,
      longitude,
      accuracy,
      timestamp,
      deviceId,
    });

    await setDoc(
      childDocRef,
      {
        currentLocation: {
          latitude,
          longitude,
          accuracy,
          timestamp,
          deviceId,
        },
        lastLocation: {
          latitude,
          longitude,
          accuracy,
          timestamp,
        },
        lastSeen: serverTimestamp(),
      },
      { merge: true },
    );

    console.log(`📍 Location updated for child ${childId}: ${latitude.toFixed(4)}, ${longitude.toFixed(4)}`);
    return { latitude, longitude, accuracy };
  } catch (error) {
    console.error('❌ Location update failed:', error?.message || error);

    // If position unavailable, offer the user a quick way to open settings
    if (error?.code === 2) {
      Alert.alert(
        'Location Unavailable',
        'No location provider available. Please enable GPS/location services.',
        [
          { text: 'Open Settings', onPress: () => Linking?.openSettings?.() },
          { text: 'OK' },
        ],
        { cancelable: true },
      );
    }

    let message = 'Failed to get location';
    if (error?.code === 1) {
      message = 'Location permission denied';
    } else if (error?.code === 2) {
      message = 'Location unavailable. Please check GPS settings.';
    } else if (error?.code === 3) {
      message = 'Location request timed out.';
    }

    throw new Error(message);
  }
};

export const startLocationTracking = async (childId, showPermissionExplanation = true) => {
  const hasPermission = await requestLocationPermission(showPermissionExplanation);
  if (!hasPermission) {
    return false;
  }

  try {
    await sendLocationUpdate(childId);
  } catch (error) {
    console.warn('Initial location update failed', error);
  }

  if (locationInterval) {
    BackgroundTimer.clearInterval(locationInterval);
  }
  locationInterval = BackgroundTimer.setInterval(() => {
    sendLocationUpdate(childId).catch((error) => {
      console.warn('Recurring location update failed', error);
    });
  }, 300000);

  return true;
};

export const stopLocationTracking = () => {
  if (locationInterval) {
    BackgroundTimer.clearInterval(locationInterval);
    locationInterval = null;
  }
};
