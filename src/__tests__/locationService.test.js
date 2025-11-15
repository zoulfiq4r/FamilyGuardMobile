jest.mock('react-native', () => ({
  PermissionsAndroid: {
    PERMISSIONS: {
      ACCESS_FINE_LOCATION: 'fine',
      ACCESS_BACKGROUND_LOCATION: 'background',
    },
    RESULTS: {
      GRANTED: 'granted',
    },
    check: jest.fn(async () => true),
    request: jest.fn(async () => 'granted'),
  },
  Platform: { OS: 'android', Version: 30 },
  Alert: { alert: jest.fn((title, message, buttons) => buttons?.[0]?.onPress?.()) },
}));

// Override geolocation mock for this suite to control fallback flows
jest.mock('@react-native-community/geolocation', () => {
  const calls = [];
  let mode = 'success'; // 'success' | 'timeoutThenSuccess' | 'permanentTimeout'
  let forcedError = null;
  const api = {
    __setMode: (m) => { mode = m; },
    __setError: (err) => { forcedError = err; },
    __getCalls: () => calls,
    getCurrentPosition: (success, error, options) => {
      calls.push(options);
      if (forcedError) {
        const err = forcedError;
        forcedError = null;
        error(err);
        return;
      }
      if (mode === 'permanentTimeout') {
        error({ code: 3, message: 'timeout' });
        return;
      }
      if (mode === 'timeoutThenSuccess') {
        if (options?.enableHighAccuracy) {
          // first call - timeout
          error({ code: 3, message: 'timeout' });
        } else {
          // fallback call - success
          success({
            coords: { latitude: 10, longitude: 20, accuracy: 40, altitude: 0, speed: 0 },
            timestamp: Date.now(),
          });
        }
      } else {
        success({
          coords: { latitude: 1, longitude: 2, accuracy: 50, altitude: 0, speed: 0 },
          timestamp: Date.now(),
        });
      }
    },
  };
  return api;
});

// Mock firebase collections used by locationService
const mockChildDocs = new Map();
const createChildDoc = () => ({
  collection: jest.fn(() => ({
    add: jest.fn(async () => ({ id: 'child-location' })),
  })),
  set: jest.fn(async () => {}),
  update: jest.fn(async () => {}),
});

jest.mock('../config/firebase', () => {
  const serverTimestamp = jest.fn(() => 'server-ts');
  const locations = { add: jest.fn(async () => ({})) };
  const children = {
    doc: jest.fn((id) => {
      if (!mockChildDocs.has(id)) {
        mockChildDocs.set(id, createChildDoc());
      }
      return mockChildDocs.get(id);
    }),
  };
  return { collections: { locations, children }, serverTimestamp };
});

jest.mock('react-native-device-info', () => ({ getUniqueId: jest.fn(async () => 'device-abc') }));

import Geolocation from '@react-native-community/geolocation';
import BackgroundTimer from 'react-native-background-timer';
import { PermissionsAndroid, Platform, Alert } from 'react-native';
import * as locationService from '../services/locationService';

describe('locationService.sendLocationUpdate', () => {
  beforeEach(() => {
    mockChildDocs.clear();
  });

  test('sends location successfully', async () => {
    // default mock returns success
    const res = await locationService.sendLocationUpdate('child-1');
    expect(res).toEqual(expect.objectContaining({ latitude: 1, longitude: 2 }));
  });

  test('falls back to network on GPS timeout', async () => {
    Geolocation.__setMode('timeoutThenSuccess');
    const res = await locationService.sendLocationUpdate('child-2');
    expect(res).toEqual(expect.objectContaining({ latitude: 10, longitude: 20 }));
    const calls = Geolocation.__getCalls();
    expect(calls[0].enableHighAccuracy).toBe(true);
    // Ensure at least one subsequent call used network (enableHighAccuracy === false)
    expect(calls.some((o, idx) => idx > 0 && o && o.enableHighAccuracy === false)).toBe(true);
  });

  test('throws when child identifier missing', async () => {
    await expect(locationService.sendLocationUpdate()).rejects.toThrow(/Missing child/);
  });

  test.each([
    [{ code: 1, message: 'denied' }, 'Location permission denied'],
    [{ code: 2, message: 'gps issue' }, 'Location unavailable. Please check GPS settings.'],
  ])('maps location errors (code %s) to friendly messages', async (mockError, expected) => {
    Geolocation.__setError(mockError);
    await expect(locationService.sendLocationUpdate('child-error')).rejects.toThrow(expected);
  });

  test('maps timeout errors to friendly message', async () => {
    Geolocation.__setMode('permanentTimeout');
    await expect(locationService.sendLocationUpdate('child-timeout')).rejects.toThrow(
      'Location request timed out.',
    );
    Geolocation.__setMode('success');
  });
});

describe('locationService permissions and tracking', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockChildDocs.clear();
    Platform.OS = 'android';
    Platform.Version = 30;
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('requestLocationPermission bypasses Android APIs on iOS', async () => {
    Platform.OS = 'ios';
    const result = await locationService.requestLocationPermission(true);
    expect(result).toBe(true);
    expect(PermissionsAndroid.check).not.toHaveBeenCalled();
  });

  test('requestLocationPermission requests fine and background permissions when needed', async () => {
    PermissionsAndroid.check
      .mockResolvedValueOnce(false) // fine not granted
      .mockResolvedValueOnce(false); // background not granted

    const result = await locationService.requestLocationPermission(true);
    expect(result).toBe(true);
    expect(Alert.alert).toHaveBeenCalled();
    expect(PermissionsAndroid.request).toHaveBeenCalledTimes(2);
  });

  test('requestLocationPermission returns false when Android APIs throw', async () => {
    PermissionsAndroid.check.mockImplementationOnce(() => {
      throw new Error('boom');
    });
    const result = await locationService.requestLocationPermission();
    expect(result).toBe(false);
  });

  test('startLocationTracking reacts to permission deny', async () => {
    PermissionsAndroid.check.mockResolvedValueOnce(false);
    PermissionsAndroid.request.mockResolvedValueOnce('denied');

    const granted = await locationService.startLocationTracking('child-denied');
    expect(granted).toBe(false);
    expect(BackgroundTimer.setInterval).not.toHaveBeenCalled();
  });

  test('startLocationTracking schedules recurring updates when granted and stop clears interval', async () => {
    const granted = await locationService.startLocationTracking('child-123');
    expect(granted).toBe(true);
    expect(BackgroundTimer.setInterval).toHaveBeenCalled();

    locationService.stopLocationTracking();
    expect(BackgroundTimer.clearInterval).toHaveBeenCalled();
  });
});





