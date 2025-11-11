const mockAppsCollection = {
  get: jest.fn(),
  onSnapshot: jest.fn(),
};

const mockChildrenDoc = {
  collection: jest.fn(() => mockAppsCollection),
};

const mockChildren = {
  doc: jest.fn(() => mockChildrenDoc),
};

jest.mock('../config/firebase', () => ({
  collections: {
    children: mockChildren,
  },
}));

jest.mock('../services/appUsageService', () => ({
  subscribeToLocalUsageState: jest.fn(),
}));

const { subscribeToLocalUsageState } = require('../services/appUsageService');
const {
  getChildApps,
  subscribeToChildApps,
  getAppsFromLocalUsage,
} = require('../services/appListService');

const makeSnapshot = (docs) => ({
  forEach: (cb) =>
    docs.forEach(({ id, data }) =>
      cb({
        id,
        data: () => data,
      }),
    ),
});

describe('appListService', () => {
  const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

  beforeEach(() => {
    jest.clearAllMocks();
    consoleErrorSpy.mockClear();
  });

  afterAll(() => {
    consoleErrorSpy.mockRestore();
  });

  test('getChildApps returns empty array when childId missing', async () => {
    const apps = await getChildApps('');
    expect(apps).toEqual([]);
    expect(mockChildren.doc).not.toHaveBeenCalled();
  });

  test('getChildApps returns [] when firestore throws', async () => {
    mockAppsCollection.get.mockRejectedValueOnce(new Error('fire'));
    const apps = await getChildApps('child-err');
    expect(apps).toEqual([]);
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      'Failed to get child apps',
      expect.any(Error),
    );
  });

  test('getChildApps maps documents and sorts by app name', async () => {
    const docs = [
      {
        id: 'b.pkg',
        data: {
          name: 'Bravo',
          usageMinutes: 20,
          status: { isBlocked: true, message: 'remote', reason: 'parent' },
          updatedAt: { toDate: () => ({ getTime: () => 100 }) },
        },
      },
      {
        id: 'a.pkg',
        data: {
          appName: 'Alpha',
          usageMinutes: 5,
          isBlocked: false,
          updatedAt: { toDate: () => ({ getTime: () => 50 }) },
        },
      },
    ];
    mockAppsCollection.get.mockResolvedValueOnce(
      makeSnapshot(
        docs.map((doc) => ({
          id: doc.id,
          data: doc.data,
        })),
      ),
    );

    const apps = await getChildApps('child-1');

    expect(mockChildren.doc).toHaveBeenCalledWith('child-1');
    expect(apps).toEqual([
      {
        packageName: 'a.pkg',
        appName: 'Alpha',
        usageMinutes: 5,
        isBlocked: false,
        status: {
          isBlocked: false,
          message: null,
          reason: null,
        },
        updatedAt: 50,
      },
      {
        packageName: 'b.pkg',
        appName: 'Bravo',
        usageMinutes: 20,
        isBlocked: true,
        status: {
          isBlocked: true,
          message: 'remote',
          reason: 'parent',
        },
        updatedAt: 100,
      },
    ]);
  });

  test('subscribeToChildApps emits sorted payloads', () => {
    const handlers = {};
    mockAppsCollection.onSnapshot.mockImplementation((success, error) => {
      handlers.success = success;
      handlers.error = error;
      return jest.fn();
    });

    const callback = jest.fn();
    const unsubscribe = subscribeToChildApps('child-9', callback);

    expect(typeof unsubscribe).toBe('function');
    expect(mockChildren.doc).toHaveBeenCalledWith('child-9');

    handlers.success?.(
      makeSnapshot([
        {
          id: 'z.pkg',
          data: {
            name: 'Zulu',
            status: { isBlocked: false },
          },
        },
        {
          id: 'm.pkg',
          data: {
            name: 'Mike',
            isBlocked: true,
          },
        },
      ]),
    );

    expect(callback).toHaveBeenCalledWith([
      expect.objectContaining({ packageName: 'm.pkg', appName: 'Mike' }),
      expect.objectContaining({ packageName: 'z.pkg', appName: 'Zulu' }),
    ]);
  });

  test('subscribeToChildApps returns noop when child id missing', () => {
    const callback = jest.fn();
    const unsubscribe = subscribeToChildApps('', callback);
    expect(typeof unsubscribe).toBe('function');
    expect(mockChildren.doc).not.toHaveBeenCalled();
  });

  test('getAppsFromLocalUsage resolves with mapped usage data', async () => {
    const unsubscribe = jest.fn();
    subscribeToLocalUsageState.mockImplementationOnce((listener) => {
      listener({
        totals: [
          { packageName: 'pkg.one', appName: 'One', durationMs: 1000, sessions: 2, lastUsed: 10 },
        ],
      });
      return unsubscribe;
    });

    const apps = await getAppsFromLocalUsage();

    expect(subscribeToLocalUsageState).toHaveBeenCalled();
    expect(unsubscribe).toHaveBeenCalled();
    expect(apps).toEqual([
      {
        packageName: 'pkg.one',
        appName: 'One',
        durationMs: 1000,
        sessions: 2,
        lastUsed: 10,
      },
    ]);
  });

  test('getAppsFromLocalUsage resolves empty when listener provides nothing', async () => {
    const unsubscribe = jest.fn();
    subscribeToLocalUsageState.mockImplementationOnce((listener) => {
      listener(null);
      return unsubscribe;
    });

    const apps = await getAppsFromLocalUsage();

    expect(apps).toEqual([]);
    expect(unsubscribe).toHaveBeenCalled();
  });
});
