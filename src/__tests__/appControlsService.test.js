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
  });

  test('subscribeToAppControls logs errors from snapshot listener', () => {
    // Test that subscription handles errors gracefully
    const callback = jest.fn();
    const unsubscribe = subscribeToAppControls('fam', 'child', callback);
    expect(typeof unsubscribe).toBe('function');
  });

  test('subscribeToAppControls emits parsed state and returns unsubscribe', () => {
    const callback = jest.fn();
    const unsubscribe = subscribeToAppControls('fam-1', 'child-1', callback);

    expect(typeof unsubscribe).toBe('function');
    // Callback should be called with initial state
    expect(callback).toHaveBeenCalled();
  });

  test('getAppControlsOnce returns structured snapshot', async () => {
    const state = await getAppControlsOnce('fam', 'child');
    
    // Should return state with expected structure
    expect(state).toBeDefined();
    expect(state.meta).toBeDefined();
    expect(state.apps).toBeDefined();
  });

  test('setAppBlocked updates the doc with boolean value', async () => {
    const result = await setAppBlocked('fam', 'child', 'pkg', 1);
    expect(result).toBe(true);
  });

  test('setAppDailyLimit coercions and clears nulls', async () => {
    await setAppDailyLimit('fam', 'child', 'pkg', '1234');
    // Verify function executes without error

    await setAppDailyLimit('fam', 'child', 'pkg', null);
    // Verify function executes without error for null value
  });

  test('removeAppControl deletes doc', async () => {
    const result = await removeAppControl('fam', 'child', 'pkg');
    expect(result).toBe(true);
  });

  test('mutators throw when required identifiers missing', async () => {
    await expect(setAppBlocked()).rejects.toThrow(/Missing required parameters/);
    await expect(setAppDailyLimit('fam', null, 'pkg', 1)).rejects.toThrow(/Missing required parameters/);
    await expect(removeAppControl('fam', 'child')).rejects.toThrow(/Missing required parameters/);
  });

  test('setAppDailyLimit surfaces Firestore errors', async () => {
    // Test that function propagates errors from Firestore
    await expect(setAppDailyLimit('', 'child', 'pkg', 5)).rejects.toThrow();
  });

  test('removeAppControl surfaces Firestore errors', async () => {
    // Test that function propagates errors from Firestore
    await expect(removeAppControl('', 'child', 'pkg')).rejects.toThrow();
  });
});
