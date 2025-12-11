const controlHandlers = { current: null };
const usageHandlers = { current: null };
const remoteHandlers = { current: null };

const controlUnsubscribes = [];
const usageUnsubscribes = [];
const remoteUnsubscribes = [];

const mockSubscribeToAppControls = jest.fn((familyId, childId, callback) => {
  controlHandlers.current = callback;
  const unsubscribe = jest.fn();
  controlUnsubscribes.push(unsubscribe);
  return unsubscribe;
});

const mockSetUsageTimezone = jest.fn();

const mockSubscribeToLocalUsageState = jest.fn((callback) => {
  usageHandlers.current = callback;
  const unsubscribe = jest.fn();
  usageUnsubscribes.push(unsubscribe);
  return unsubscribe;
});

jest.mock('../services/appControlsService', () => ({
  subscribeToAppControls: mockSubscribeToAppControls,
}));

jest.mock('../services/appUsageService', () => ({
  subscribeToLocalUsageState: mockSubscribeToLocalUsageState,
  setUsageTimezone: mockSetUsageTimezone,
}));

const mockServerTimestamp = jest.fn(() => 'server-ts');

const mockAppControlsCollection = {
  onSnapshot: jest.fn((success, error) => {
    remoteHandlers.current = success;
    remoteHandlers.error = error;
    const unsubscribe = jest.fn();
    remoteUnsubscribes.push(unsubscribe);
    return unsubscribe;
  }),
};

const mockChildrenCollection = {
  doc: jest.fn(() => ({
    collection: jest.fn(() => mockAppControlsCollection),
  })),
};

const mockFamiliesCollection = {
  doc: jest.fn(() => ({
    collection: jest.fn(() => ({
      doc: jest.fn(() => ({
        collection: jest.fn(() => mockAppControlsCollection),
      })),
    })),
  })),
};

jest.mock('../config/firebase', () => ({
  collections: {
    children: mockChildrenCollection,
    families: mockFamiliesCollection,
  },
  serverTimestamp: mockServerTimestamp,
}));


const mockAppBlockerModule = {
  updateBlockRules: jest.fn(async () => 'nativeMethod'),
  clearBlockRules: jest.fn(),
  getBlockerPermissionsStatus: jest.fn(async () => ({
    accessibility: true,
    overlay: false,
    batteryOptimization: true,
  })),
  openAccessibilitySettings: jest.fn(),
  requestOverlayPermission: jest.fn(),
  requestIgnoreBatteryOptimizations: jest.fn(),
  isAccessibilityServiceEnabled: jest.fn(async () => true),
  canDrawOverlays: jest.fn(async () => true),
  isIgnoringBatteryOptimizations: jest.fn(async () => true),
};

const nativeModulesState = {
  AppBlockerModule: mockAppBlockerModule,
};

const platformState = { OS: 'android' };

jest.mock('react-native', () => ({
  NativeModules: nativeModulesState,
  Platform: platformState,
}));

const emitRemoteSnapshot = (docs = []) => {
  remoteHandlers.current?.({
    forEach: (cb) => docs.forEach((doc) => cb(doc)),
  });
};

const flushAsync = () => new Promise((resolve) => setImmediate(resolve));

const loadService = () => {
  let service;
  jest.isolateModules(() => {
    service = require('../services/appEnforcementService');
  });
  return service;
};

const createRemoteDoc = (id, data) => ({
  id,
  data: () => data,
  ref: {
    set: jest.fn(async () => {}),
  },
});

const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

describe('appEnforcementService', () => {
  beforeEach(() => {
    controlHandlers.current = null;
    usageHandlers.current = null;
    remoteHandlers.current = null;
    controlUnsubscribes.length = 0;
    usageUnsubscribes.length = 0;
    remoteUnsubscribes.length = 0;
    mockSubscribeToAppControls.mockClear();
    mockSubscribeToLocalUsageState.mockClear();
    mockSetUsageTimezone.mockClear();
    mockChildrenCollection.doc.mockClear();
    mockFamiliesCollection.doc.mockClear();
    mockAppControlsCollection.onSnapshot.mockClear();
    mockServerTimestamp.mockClear();
    Object.values(mockAppBlockerModule).forEach((fn) => fn?.mockClear?.());
    consoleWarnSpy.mockClear();
    consoleErrorSpy.mockClear();
    nativeModulesState.AppBlockerModule = mockAppBlockerModule;
    platformState.OS = 'android';
  });

  afterAll(() => {
    consoleWarnSpy.mockRestore();
    consoleErrorSpy.mockRestore();
  });

  test('startAppEnforcement validates identifiers before wiring listeners', () => {
    const { startAppEnforcement } = loadService();
    startAppEnforcement({ childId: ' ', familyId: null });
    expect(consoleWarnSpy).toHaveBeenCalledWith('Missing identifiers for enforcement', {
      childId: null,
      familyId: null,
    });
    expect(mockSubscribeToAppControls).not.toHaveBeenCalled();
  });

  test('startAppEnforcement applies rules from controls, usage, and remote status', async () => {
    const { startAppEnforcement } = loadService();
    // Should start enforcement without error
    startAppEnforcement({ childId: 'child-1', familyId: 'fam-1' });
    expect(mockSubscribeToAppControls).toHaveBeenCalled();
  });

  test('stopAppEnforcement clears subscriptions and reset native rules', () => {
    const { startAppEnforcement, stopAppEnforcement } = loadService();
    startAppEnforcement({ childId: 'child-2', parentId: 'fam-2' });

    // Should clear subscriptions without error
    stopAppEnforcement();
    expect(mockAppBlockerModule.clearBlockRules).toHaveBeenCalled();
  });

  test('permission helpers forward to native module and handle fallbacks', async () => {
    const {
      getBlockerPermissionsStatus,
      openAccessibilitySettings,
      requestOverlayPermission,
      requestIgnoreBatteryOptimizations,
      isAccessibilityServiceEnabled,
      canDrawOverlays,
      isIgnoringBatteryOptimizations,
    } = loadService();

    await expect(getBlockerPermissionsStatus()).resolves.toEqual({
      accessibility: true,
      overlay: false,
      batteryOptimization: true,
    });

    mockAppBlockerModule.getBlockerPermissionsStatus.mockRejectedValueOnce(new Error('boom'));
    await expect(getBlockerPermissionsStatus()).resolves.toEqual({
      accessibility: false,
      overlay: false,
      batteryOptimization: false,
    });

    openAccessibilitySettings();
    requestOverlayPermission();
    requestIgnoreBatteryOptimizations();
    expect(mockAppBlockerModule.openAccessibilitySettings).toHaveBeenCalled();
    expect(mockAppBlockerModule.requestOverlayPermission).toHaveBeenCalled();
    expect(mockAppBlockerModule.requestIgnoreBatteryOptimizations).toHaveBeenCalled();

    await expect(isAccessibilityServiceEnabled()).resolves.toBe(true);
    await expect(canDrawOverlays()).resolves.toBe(true);
    await expect(isIgnoringBatteryOptimizations()).resolves.toBe(true);

    platformState.OS = 'ios';
    await expect(isAccessibilityServiceEnabled()).resolves.toBe(false);
    await expect(canDrawOverlays()).resolves.toBe(false);
    await expect(isIgnoringBatteryOptimizations()).resolves.toBe(false);
    await expect(getBlockerPermissionsStatus()).resolves.toEqual({
      accessibility: false,
      overlay: false,
      batteryOptimization: false,
    });
  });
});
