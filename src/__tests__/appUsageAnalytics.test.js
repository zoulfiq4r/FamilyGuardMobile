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
    const unsubscribe = listenToDailyUsageAggregate('child', '2024-01-01', callback);

    // Callback should be called
    expect(typeof unsubscribe).toBe('function');
    expect(callback).toHaveBeenCalled();
  });

  test('listenToDailyUsageAggregate maps apps and hours from snapshot', () => {
    const callback = jest.fn();
    const unsubscribe = listenToDailyUsageAggregate('child', '2024-01-01', callback);

    // Callback should be called with data
    expect(typeof unsubscribe).toBe('function');
    expect(callback).toHaveBeenCalled();
  });

  test('listenToRecentSessions converts snapshot docs', () => {
    const callback = jest.fn();
    const unsubscribe = listenToRecentSessions('child', '2024-01-01', 5, callback);

    // Should return unsubscribe function
    expect(typeof unsubscribe).toBe('function');
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
    const unsubscribe = listenToDeviceCurrentApp('device-1', callback);

    // Should return unsubscribe function and call callback
    expect(typeof unsubscribe).toBe('function');
    expect(callback).toHaveBeenCalled();
  });
});
