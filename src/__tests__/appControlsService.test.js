const mockDocRefs = new Map();

const createDocRef = () => ({
  set: jest.fn().mockResolvedValue(undefined),
  delete: jest.fn().mockResolvedValue(undefined),
});

const mockCollectionRef = {
  onSnapshot: jest.fn(),
  doc: jest.fn((docId) => {
    if (!mockDocRefs.has(docId)) {
      mockDocRefs.set(docId, createDocRef());
    }
    return mockDocRefs.get(docId);
  }),
  get: jest.fn(),
};

const mockDb = {
  collection: jest.fn(() => mockCollectionRef),
};

jest.mock('../config/firebase', () => ({
  db: mockDb,
}));

const {
  subscribeToAppControls,
  getAppControlsOnce,
  setAppBlocked,
  setAppDailyLimit,
  removeAppControl,
} = require('../services/appControlsService');

const makeSnapshot = (docs) => ({
  forEach: (cb) =>
    docs.forEach(({ id, data }) =>
      cb({
        id,
        data: () => data,
      }),
    ),
});

describe('appControlsService', () => {
  const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
  const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

  beforeEach(() => {
    jest.clearAllMocks();
    mockDocRefs.clear();
    consoleErrorSpy.mockClear();
    consoleWarnSpy.mockClear();
  });

  afterAll(() => {
    consoleWarnSpy.mockRestore();
    consoleErrorSpy.mockRestore();
  });

  test('subscribeToAppControls warns when identifiers missing', () => {
    const unsubscribe = subscribeToAppControls('', '', jest.fn());
    expect(typeof unsubscribe).toBe('function');
    expect(consoleWarnSpy).toHaveBeenCalled();
    expect(mockDb.collection).not.toHaveBeenCalled();
  });

  test('subscribeToAppControls logs errors from snapshot listener', () => {
    const error = new Error('listener');
    mockCollectionRef.onSnapshot.mockImplementation((success, failure) => {
      failure?.(error);
      return jest.fn();
    });

    subscribeToAppControls('fam', 'child', jest.fn());
    expect(consoleErrorSpy).toHaveBeenCalledWith('Failed to load app controls', error);
  });

  test('subscribeToAppControls emits parsed state and returns unsubscribe', () => {
    const handlers = {};
    mockCollectionRef.onSnapshot.mockImplementation((success, error) => {
      handlers.success = success;
      handlers.error = error;
      return jest.fn(() => {
        handlers.success = null;
      });
    });

    const callback = jest.fn();
    const unsubscribe = subscribeToAppControls('fam-1', 'child-1', callback);

    expect(mockDb.collection).toHaveBeenCalledWith('families/fam-1/children/child-1/appControls');
    expect(typeof unsubscribe).toBe('function');

    handlers.success?.(
      makeSnapshot([
        { id: 'meta', data: { globalDailyLimitMillis: '60000', graceMillis: '5000', timezone: 'UTC' } },
        { id: 'com.app.one', data: { blocked: true, dailyLimitMillis: '90000' } },
      ]),
    );

    expect(callback).toHaveBeenCalledWith({
      meta: {
        globalDailyLimitMillis: 60000,
        graceMillis: 5000,
        timezone: 'UTC',
      },
      apps: {
        'com.app.one': {
          blocked: true,
          dailyLimitMillis: 90000,
        },
      },
    });
  });

  test('getAppControlsOnce returns structured snapshot', async () => {
    mockCollectionRef.get.mockResolvedValueOnce(
      makeSnapshot([
        { id: 'meta', data: { globalDailyLimitMillis: 30000, graceMillis: null, timezone: null } },
        { id: 'pkg', data: { blocked: false, dailyLimitMillis: 1000 } },
      ]),
    );

    const state = await getAppControlsOnce('fam', 'child');

    expect(mockDb.collection).toHaveBeenCalledWith('families/fam/children/child/appControls');
    expect(state).toEqual({
      meta: {
        globalDailyLimitMillis: 30000,
        graceMillis: 0,
        timezone: null,
      },
      apps: {
        pkg: {
          blocked: false,
          dailyLimitMillis: 1000,
        },
      },
    });
  });

  test('setAppBlocked updates the doc with boolean value', async () => {
    await setAppBlocked('fam', 'child', 'pkg', 1);
    const docRef = mockDocRefs.get('pkg');
    expect(docRef.set).toHaveBeenCalledWith({ blocked: true }, { merge: true });
  });

  test('setAppDailyLimit coercions and clears nulls', async () => {
    await setAppDailyLimit('fam', 'child', 'pkg', '1234');
    expect(mockDocRefs.get('pkg').set).toHaveBeenLastCalledWith(
      { dailyLimitMillis: 1234 },
      { merge: true },
    );

    await setAppDailyLimit('fam', 'child', 'pkg', null);
    expect(mockDocRefs.get('pkg').set).toHaveBeenLastCalledWith(
      { dailyLimitMillis: null },
      { merge: true },
    );
  });

  test('removeAppControl deletes doc', async () => {
    await removeAppControl('fam', 'child', 'pkg');
    expect(mockDocRefs.get('pkg').delete).toHaveBeenCalled();
  });

  test('mutators throw when required identifiers missing', async () => {
    await expect(setAppBlocked()).rejects.toThrow(/Missing required parameters/);
    await expect(setAppDailyLimit('fam', null, 'pkg', 1)).rejects.toThrow(/Missing required parameters/);
    await expect(removeAppControl('fam', 'child')).rejects.toThrow(/Missing required parameters/);
  });

  test('setAppDailyLimit surfaces Firestore errors', async () => {
    const docId = 'pkg-error';
    const errorDoc = createDocRef();
    errorDoc.set.mockRejectedValueOnce(new Error('write-fail'));
    mockDocRefs.set(docId, errorDoc);

    await expect(setAppDailyLimit('fam', 'child', docId, 5)).rejects.toThrow('write-fail');
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      'Failed to update app daily limit',
      expect.any(Error),
    );
  });

  test('removeAppControl surfaces Firestore errors', async () => {
    const docId = 'pkg-delete-error';
    const errorDoc = createDocRef();
    errorDoc.delete.mockRejectedValueOnce(new Error('delete-fail'));
    mockDocRefs.set(docId, errorDoc);

    await expect(removeAppControl('fam', 'child', docId)).rejects.toThrow('delete-fail');
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      'Failed to remove app control',
      expect.any(Error),
    );
  });
});
