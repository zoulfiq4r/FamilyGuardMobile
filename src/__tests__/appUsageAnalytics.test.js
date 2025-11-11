import {
  listenToDailyUsageAggregate,
  listenToRecentSessions,
  fetchUsageWindowSummary,
  listenToDeviceCurrentApp,
} from '../services/appUsageAnalytics';

const noop = () => {};

const dailySnapshotHandlersStore = { current: null };
const sessionSnapshotHandlersStore = { current: null };
const deviceSnapshotHandlersStore = { current: null };

let mockAggregateDocs = [];
let mockAggregateShouldThrow = false;

jest.mock('../config/firebase', () => {
  const makeOnSnapshot = (store) => (success, error) => {
    store.current = { success, error };
    return jest.fn();
  };

  const aggregatesCollection = {
    doc: jest.fn(() => ({
      onSnapshot: makeOnSnapshot(dailySnapshotHandlersStore),
    })),
    where: jest.fn(() => aggregatesCollection),
    orderBy: jest.fn(() => aggregatesCollection),
    get: jest.fn(async () => {
      if (mockAggregateShouldThrow) {
        throw new Error('aggregate-get');
      }
      return {
        forEach: (cb) => {
          mockAggregateDocs.forEach((doc) => cb(doc));
        },
      };
    }),
  };

  const sessionsQuery = {
    onSnapshot: makeOnSnapshot(sessionSnapshotHandlersStore),
  };

  const appUsageSessions = {
    where: jest.fn(() => appUsageSessions),
    orderBy: jest.fn(() => appUsageSessions),
    limit: jest.fn(() => sessionsQuery),
  };

  const devices = {
    doc: jest.fn(() => ({
      onSnapshot: makeOnSnapshot(deviceSnapshotHandlersStore),
    })),
  };

  return {
    collections: {
      appUsageAggregates: aggregatesCollection,
      appUsageSessions,
      devices,
    },
  };
});

const makeDoc = (id, data) => ({ id, data: () => data });

const emitSnapshot = (store, snapshot) => {
  store.current?.success(snapshot);
};

describe('appUsageAnalytics service', () => {
  beforeEach(() => {
    mockAggregateDocs = [];
    mockAggregateShouldThrow = false;
    dailySnapshotHandlersStore.current = null;
    sessionSnapshotHandlersStore.current = null;
    deviceSnapshotHandlersStore.current = null;
  });

  test('listenToDailyUsageAggregate returns noop when identifiers missing', () => {
    const unsubscribe = listenToDailyUsageAggregate(null, '2024-01-01', noop);
    expect(typeof unsubscribe).toBe('function');
  });

  test('listenToDailyUsageAggregate emits defaults when doc missing', () => {
    const callback = jest.fn();
    listenToDailyUsageAggregate('child', '2024-01-01', callback);

    emitSnapshot(dailySnapshotHandlersStore, { exists: false });

    expect(callback).toHaveBeenCalledWith({
      totalDurationMs: 0,
      apps: [],
      hours: [],
      updatedAt: null,
    });
  });

  test('listenToDailyUsageAggregate maps apps and hours from snapshot', () => {
    const callback = jest.fn();
    listenToDailyUsageAggregate('child', '2024-01-01', callback);

    emitSnapshot(dailySnapshotHandlersStore, {
      exists: true,
      data: () => ({
        totalDurationMs: 5000,
        apps: {
          'b.app': { durationMs: 1000, appName: 'Beta', sessions: 2 },
          'a.app': { durationMs: 2000 },
        },
        hours: {
          '12': 200,
          '02': 400,
        },
        lastUpdated: { toMillis: () => 12345 },
      }),
    });

    expect(callback).toHaveBeenCalledWith({
      totalDurationMs: 5000,
      apps: [
        { packageName: 'a.app', appName: 'a.app', durationMs: 2000, sessions: 0, lastUsed: 0 },
        { packageName: 'b.app', appName: 'Beta', durationMs: 1000, sessions: 2, lastUsed: 0 },
      ],
      hours: [
        { hour: '02', durationMs: 400 },
        { hour: '12', durationMs: 200 },
      ],
      updatedAt: 12345,
    });
  });

  test('listenToRecentSessions converts snapshot docs', () => {
    const callback = jest.fn();
    listenToRecentSessions('child', '2024-01-01', 5, callback);

    const startTime = new Date('2024-01-01T00:00:00Z');
    const endTime = new Date('2024-01-01T00:30:00Z');

    emitSnapshot(sessionSnapshotHandlersStore, {
      forEach: (cb) => {
        cb({
          id: 'session-1',
          data: () => ({
            packageName: 'pkg',
            appName: 'App',
            durationMs: 1200,
            startTime: { toDate: () => startTime },
            endTime: { toDate: () => endTime },
          }),
        });
      },
    });

    expect(callback).toHaveBeenCalledWith([
      {
        id: 'session-1',
        packageName: 'pkg',
        appName: 'App',
        durationMs: 1200,
        startTime,
        endTime,
      },
    ]);
  });

  test('fetchUsageWindowSummary returns aggregates and handles errors', async () => {
    mockAggregateDocs = [
      makeDoc('doc-1', { dateKey: '2024-01-01', totalDurationMs: 100 }),
      makeDoc('doc-2', { dateKey: '2024-01-02', totalDurationMs: 200 }),
    ];

    const summary = await fetchUsageWindowSummary('child', 2);
    expect(summary).toMatchObject({
      totalDurationMs: 300,
      averagePerDayMs: 150,
      days: [
        { id: 'doc-1', dateKey: '2024-01-01', totalDurationMs: 100 },
        { id: 'doc-2', dateKey: '2024-01-02', totalDurationMs: 200 },
      ],
    });

    mockAggregateShouldThrow = true;
    const fallback = await fetchUsageWindowSummary('child', 2);
    expect(fallback.totalDurationMs).toBe(0);
    expect(fallback.days).toEqual([]);
    expect(fallback.error).toBeInstanceOf(Error);
  });

  test('listenToDeviceCurrentApp emits null/defaults', () => {
    const callback = jest.fn();
    listenToDeviceCurrentApp('device-1', callback);

    emitSnapshot(deviceSnapshotHandlersStore, { exists: false });
    expect(callback).toHaveBeenCalledWith(null);

    emitSnapshot(deviceSnapshotHandlersStore, { exists: true, data: () => ({}) });
    expect(callback).toHaveBeenCalledWith(null);

    emitSnapshot(deviceSnapshotHandlersStore, {
      exists: true,
      data: () => ({
        currentApp: {
          packageName: 'pkg',
          appName: 'App',
          since: { toMillis: () => 50 },
          updatedAt: { toMillis: () => 75 },
        },
      }),
    });

    expect(callback).toHaveBeenCalledWith({
      packageName: 'pkg',
      appName: 'App',
      since: 50,
      updatedAt: 75,
    });
  });
});
