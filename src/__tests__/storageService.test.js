import AsyncStorage from '@react-native-async-storage/async-storage';

import {
  loadStoredChildContext,
  persistChildContext,
  clearStoredChildContext,
} from '../services/storageService';

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
}));

describe('storageService', () => {
  const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

  beforeEach(() => {
    jest.clearAllMocks();
    consoleWarnSpy.mockClear();
  });

  afterAll(() => {
    consoleWarnSpy.mockRestore();
  });

  test('loadStoredChildContext returns parsed context when valid data exists', async () => {
    const context = { childId: 'child-1', parentId: 'parent-9' };
    AsyncStorage.getItem.mockResolvedValueOnce(JSON.stringify(context));

    const result = await loadStoredChildContext();

    expect(result).toEqual(context);
    expect(AsyncStorage.getItem).toHaveBeenCalledWith('familyGuard.childContext');
  });

  test('loadStoredChildContext returns null when storage empty or malformed', async () => {
    AsyncStorage.getItem.mockResolvedValueOnce(null);

    await expect(loadStoredChildContext()).resolves.toBeNull();

    AsyncStorage.getItem.mockResolvedValueOnce('{}');
    await expect(loadStoredChildContext()).resolves.toBeNull();
  });

  test('loadStoredChildContext swallows errors and logs warning', async () => {
    const error = new Error('boom');
    AsyncStorage.getItem.mockRejectedValueOnce(error);

    await expect(loadStoredChildContext()).resolves.toBeNull();
    expect(consoleWarnSpy).toHaveBeenCalledWith(
      'Failed to load child context from storage',
      error,
    );
  });

  test('persistChildContext serializes payload and handles errors', async () => {
    const context = { childId: 'abc' };
    await persistChildContext(context);
    expect(AsyncStorage.setItem).toHaveBeenCalledWith(
      'familyGuard.childContext',
      JSON.stringify(context),
    );

    const error = new Error('write');
    AsyncStorage.setItem.mockRejectedValueOnce(error);
    await persistChildContext(context);
    expect(consoleWarnSpy).toHaveBeenCalledWith(
      'Failed to persist child context',
      error,
    );
  });

  test('clearStoredChildContext removes key and logs on failure', async () => {
    await clearStoredChildContext();
    expect(AsyncStorage.removeItem).toHaveBeenCalledWith('familyGuard.childContext');

    const error = new Error('remove');
    AsyncStorage.removeItem.mockRejectedValueOnce(error);
    await clearStoredChildContext();
    expect(consoleWarnSpy).toHaveBeenCalledWith(
      'Failed to clear child context from storage',
      error,
    );
  });
});
