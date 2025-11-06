// Override geolocation mock for this suite to control fallback flows
jest.mock('@react-native-community/geolocation', () => {
  const calls = [];
  let mode = 'success'; // 'success' | 'timeoutThenSuccess'
  const api = {
    __setMode: (m) => { mode = m; },
    __getCalls: () => calls,
    getCurrentPosition: (success, error, options) => {
      calls.push(options);
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
jest.mock('../config/firebase', () => {
  const firestore = { FieldValue: { serverTimestamp: jest.fn(() => 'server-ts') } };
  const locations = { add: jest.fn(async () => ({})) };
  const children = { doc: jest.fn(() => ({ update: jest.fn(async () => {}) })) };
  return { collections: { locations, children }, firestore };
});

jest.mock('react-native-device-info', () => ({ getUniqueId: jest.fn(async () => 'device-abc') }));

import Geolocation from '@react-native-community/geolocation';
import { sendLocationUpdate } from '../services/locationService';

describe('locationService.sendLocationUpdate', () => {
  test('sends location successfully', async () => {
    // default mock returns success
    const res = await sendLocationUpdate('child-1');
    expect(res).toEqual(expect.objectContaining({ latitude: 1, longitude: 2 }));
  });

  test('falls back to network on GPS timeout', async () => {
    Geolocation.__setMode('timeoutThenSuccess');
    const res = await sendLocationUpdate('child-2');
    expect(res).toEqual(expect.objectContaining({ latitude: 10, longitude: 20 }));
    const calls = Geolocation.__getCalls();
    expect(calls[0].enableHighAccuracy).toBe(true);
    // Ensure at least one subsequent call used network (enableHighAccuracy === false)
    expect(calls.some((o, idx) => idx > 0 && o && o.enableHighAccuracy === false)).toBe(true);
  });
});


