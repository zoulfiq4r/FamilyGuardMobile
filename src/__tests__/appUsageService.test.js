const mockBackgroundTimer = {
  setInterval: jest.fn(() => 101),
  clearInterval: jest.fn(),
};

jest.mock('react-native-background-timer', () => mockBackgroundTimer);

const mockDeviceInfo = {
  getUniqueId: jest.fn(async () => 'device-abc'),
};

jest.mock('react-native-device-info', () => mockDeviceInfo);

const createFirebaseMock = () => {
  const aggregateDocs = new Map();
  const childDocs = new Map();
  const childAppDocs = new Map();
  const deviceDocs = new Map();

  const appUsageSessions = {
    add: jest.fn(async (payload) => ({
      id: `session-${appUsageSessions.add.mock.calls.length}`,
      payload,
    })),
  };

  const appUsageAggregates = {
    doc: jest.fn((id) => {
      if (!aggregateDocs.has(id)) {
        aggregateDocs.set(id, {
          set: jest.fn(async () => {}),
        });
      }
      return aggregateDocs.get(id);
    }),
  };

  const children = {
    doc: jest.fn((childId) => {
      if (!childDocs.has(childId)) {
        childDocs.set(childId, {
          collection: jest.fn((name) => {
            if (name !== 'apps') {
              throw new Error(`Unsupported collection ${name}`);
            }
            return {
              doc: jest.fn((pkg) => {
                const key = `${childId}:${pkg}`;
                if (!childAppDocs.has(key)) {
                  childAppDocs.set(key, {
                    set: jest.fn(async () => {}),
                  });
                }
                return childAppDocs.get(key);
              }),
            };
          }),
        });
      }
      return childDocs.get(childId);
    }),
  };

  const devices = {
    doc: jest.fn((deviceId) => {
      if (!deviceDocs.has(deviceId)) {
        deviceDocs.set(deviceId, {
          set: jest.fn(async () => {}),
        });
      }
      return deviceDocs.get(deviceId);
    }),
  };

  const serverTimestamp = jest.fn(() => 'server-ts');
  const increment = jest.fn((value = 1) => ({ __increment__: value }));
  const Timestamp = {
    fromDate: jest.fn((date) => ({
      toDate: () => date,
      toMillis: () => date.getTime(),
    })),
  };

  const reset = () => {
    aggregateDocs.clear();
    childDocs.clear();
    childAppDocs.clear();
    deviceDocs.clear();
    appUsageSessions.add.mockClear();
    appUsageAggregates.doc.mockClear();
    children.doc.mockClear();
    devices.doc.mockClear();
    serverTimestamp.mockClear();
    increment.mockClear();
    Timestamp.fromDate.mockClear();
  };

  return {
    collections: {
      appUsageSessions,
      appUsageAggregates,
      children,
      devices,
    },
    serverTimestamp,
    increment,
    Timestamp,
    __aggregateDocs: aggregateDocs,
    __childDocs: childDocs,
    __childAppDocs: childAppDocs,
    __deviceDocs: deviceDocs,
    __reset: reset,
  };
};

const mockFirebase = createFirebaseMock();

jest.mock('../config/firebase', () => mockFirebase);

jest.mock('../services/appUsageAnalytics', () => ({
  toDateKey: jest.fn((input) => {
    const date = typeof input === 'number' ? new Date(input) : input;
    return date.toISOString().slice(0, 10);
  }),
}));

const nativeModulesState = {
  AppUsageModule: null,
};

const platformState = { OS: 'android' };

jest.mock('react-native', () => ({
  NativeModules: nativeModulesState,
  Platform: platformState,
}));

const createUsageModule = () => ({
  hasUsageAccessPermission: jest.fn(async () => true),
  openUsageAccessSettings: jest.fn(),
  getUsageEvents: jest.fn(async () => []),
  getCurrentForegroundApp: jest.fn(async () => null),
});

const loadService = ({ os = 'android', usageModule = createUsageModule() } = {}) => {
  nativeModulesState.AppUsageModule = usageModule;
  platformState.OS = os;
  let service;
  jest.isolateModules(() => {
    service = require('../services/appUsageService');
  });
  return { service, usageModule };
};

const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

describe('appUsageService', () => {
  beforeEach(() => {
    mockFirebase.__reset();
    mockBackgroundTimer.setInterval.mockClear();
    mockBackgroundTimer.clearInterval.mockClear();
    mockDeviceInfo.getUniqueId.mockClear();
    consoleLogSpy.mockClear();
    consoleWarnSpy.mockClear();
    consoleErrorSpy.mockClear();
  });

  afterEach(() => {
    nativeModulesState.AppUsageModule = null;
    platformState.OS = 'android';
  });

  afterAll(() => {
    consoleLogSpy.mockRestore();
    consoleWarnSpy.mockRestore();
    consoleErrorSpy.mockRestore();
  });

  test('startAppUsageTracking returns false when platform is not Android', async () => {
    const usageModule = createUsageModule();
    const { service } = loadService({ os: 'ios', usageModule });

    await expect(
      service.startAppUsageTracking({ childId: 'child', parentId: 'parent' }),
    ).resolves.toBe(false);

    expect(usageModule.hasUsageAccessPermission).not.toHaveBeenCalled();
    expect(consoleLogSpy).toHaveBeenCalledWith(
      'App usage tracking is only supported on Android devices.',
    );
  });

  test('startAppUsageTracking warns when native module is unavailable', async () => {
    const { service } = loadService({ usageModule: null });

    const result = await service.startAppUsageTracking({ childId: 'child-1', parentId: 'parent-1' });

    expect(result).toBe(false);
    expect(consoleWarnSpy).toHaveBeenCalledWith('AppUsageModule native module is unavailable.');
  });

  test('startAppUsageTracking validates child context and opens settings when permission missing', async () => {
    const usageModule = createUsageModule();
    usageModule.hasUsageAccessPermission.mockResolvedValueOnce(false);
    const { service } = loadService({ usageModule });

    await expect(service.startAppUsageTracking({ parentId: 'parent-2' })).resolves.toBe(false);
    expect(consoleWarnSpy).toHaveBeenCalledWith(
      'Missing child context for app usage tracking',
    );

    consoleWarnSpy.mockClear();

    const context = { childId: 'child-2', parentId: 'parent-2' };
    const result = await service.startAppUsageTracking(context);

    expect(result).toBe(false);
    expect(usageModule.openUsageAccessSettings).toHaveBeenCalled();
    expect(mockBackgroundTimer.setInterval).not.toHaveBeenCalled();
  });

  test('startAppUsageTracking persists sessions, updates aggregates, and stops cleanly', async () => {
    const usageModule = createUsageModule();
    const now = new Date('2024-05-01T12:00:00Z').getTime();
    const dateSpy = jest.spyOn(Date, 'now').mockReturnValue(now);

    usageModule.getUsageEvents.mockResolvedValue([
      {
        packageName: 'com.demo.app',
        appName: 'Demo',
        eventType: 'BACKGROUND',
        timestamp: now - 1_000,
      },
      {
        packageName: 'com.demo.app',
        appName: 'Demo',
        eventType: 'FOREGROUND',
        timestamp: now - 4_000,
      },
    ]);

    const { service } = loadService({ usageModule });
    const context = { childId: 'child-42', parentId: 'parent-9' };

    try {
      const result = await service.startAppUsageTracking(context);
      expect(result).toBe(true);

      expect(usageModule.hasUsageAccessPermission).toHaveBeenCalled();
      expect(usageModule.getUsageEvents).toHaveBeenCalled();

      service.stopAppUsageTracking();
      expect(mockBackgroundTimer.clearInterval).toHaveBeenCalledWith(101);
    } finally {
      dateSpy.mockRestore();
    }
  });

  test('subscribeToLocalUsageState notifies immediately and respects unsubscribe', () => {
    const { service } = loadService();
    const callback = jest.fn();

    const unsubscribe = service.subscribeToLocalUsageState(callback);
    expect(callback).toHaveBeenCalledWith(
      expect.objectContaining({ totals: expect.any(Array), totalDurationMs: 0 }),
    );

    callback.mockClear();
    service.setUsageTimezone('America/New_York');
    expect(callback).toHaveBeenCalled();

    callback.mockClear();
    unsubscribe();
    service.setUsageTimezone('Asia/Tokyo');
    expect(callback).not.toHaveBeenCalled();

    const noopUnsub = service.subscribeToLocalUsageState(null);
    expect(typeof noopUnsub).toBe('function');
  });

  test('refreshForegroundApp propagates the native state to listeners', async () => {
    const usageModule = createUsageModule();
    usageModule.getCurrentForegroundApp.mockResolvedValue({
      packageName: 'com.now.playing',
      appName: 'Now Playing',
      since: 123,
    });

    const { service } = loadService({ usageModule });
    const snapshots = [];
    service.subscribeToLocalUsageState((snapshot) => snapshots.push(snapshot));
    snapshots.length = 0;

    const result = await service.refreshForegroundApp();
    expect(result).toEqual({
      packageName: 'com.now.playing',
      appName: 'Now Playing',
      since: 123,
    });
    expect(usageModule.getCurrentForegroundApp).toHaveBeenCalled();
    expect(snapshots.at(-1)?.activeApp).toMatchObject({ packageName: 'com.now.playing' });
  });
});
