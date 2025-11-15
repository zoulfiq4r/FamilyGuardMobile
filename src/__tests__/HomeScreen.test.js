import React from 'react';
import { render, fireEvent, waitFor, act } from '@testing-library/react-native';

jest.mock('react-native-device-info', () => ({
  getUniqueId: jest.fn(() => Promise.resolve('device-test-id')),
}));

const mockSubscribe = jest.fn(() => jest.fn());
const mockRefreshForeground = jest.fn(() => Promise.resolve());

jest.mock('../services/appUsageService', () => ({
  subscribeToLocalUsageState: (...args) => mockSubscribe(...args),
  refreshForegroundApp: () => mockRefreshForeground(),
}));

const mockAggregate = jest.fn();
const mockSessions = jest.fn();
const mockDeviceCurrent = jest.fn();
const mockFetchSummary = jest.fn();

jest.mock('../services/appUsageAnalytics', () => ({
  listenToDailyUsageAggregate: (...args) => mockAggregate(...args),
  listenToRecentSessions: (...args) => mockSessions(...args),
  listenToDeviceCurrentApp: (...args) => mockDeviceCurrent(...args),
  fetchUsageWindowSummary: (...args) => mockFetchSummary(...args),
  toDateKey: () => '2025-01-01',
}));

const mockSendLocationUpdate = jest.fn(() =>
  Promise.resolve({ latitude: 10, longitude: 20, accuracy: 50 }),
);

jest.mock('../services/locationService', () => ({
  sendLocationUpdate: (...args) => mockSendLocationUpdate(...args),
}));

const HomeScreen = require('../screens/HomeScreen').default;

const flushAsync = () => act(() => Promise.resolve());

describe('HomeScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('renders empty state and consumes local snapshot when child not paired', async () => {
    const localHandlers = [];
    mockSubscribe.mockImplementation((callback) => {
      localHandlers.push(callback);
      return jest.fn();
    });

    const { getByText } = render(
      <HomeScreen onNavigateToSettings={jest.fn()} childContext={null} permissionState={{}} />,
    );

    expect(getByText('Pair a device to get started')).toBeTruthy();
    expect(mockSubscribe).toHaveBeenCalledTimes(1);
    expect(localHandlers).toHaveLength(1);

    const snapshot = {
      activeApp: { appName: 'Maps', packageName: 'maps', since: Date.now() - 5 * 60_000 },
      totals: [{ packageName: 'pkg', appName: 'Pkg', durationMs: 2_400_000 }],
    };
    act(() => localHandlers[0](snapshot));

    await waitFor(() => expect(mockSubscribe).toHaveBeenCalledTimes(1));
  });

  test('loads usage data, refreshes usage and location for paired child', async () => {
    mockAggregate.mockImplementation((_childId, _dateKey, callback) => {
      callback({
        totalDurationMs: 120_000,
        apps: [
          { packageName: 'pkg.one', appName: 'Demo App', durationMs: 90_000, sessions: 2 },
        ],
        hours: [{ hour: '02', durationMs: 60_000 }],
        updatedAt: Date.now(),
      });
      return jest.fn();
    });

    mockSessions.mockImplementation((_childId, _dateKey, _limit, callback) => {
      callback([
        {
          id: 'session-1',
          packageName: 'pkg.one',
          appName: 'Demo App',
          durationMs: 30_000,
          startTime: new Date('2025-01-01T00:00:00Z'),
          endTime: new Date('2025-01-01T00:05:00Z'),
        },
      ]);
      return jest.fn();
    });

    mockDeviceCurrent.mockImplementation((_deviceId, callback) => {
      callback({ packageName: 'pkg.two', appName: 'Streaming', since: Date.now() - 2_000 });
      return jest.fn();
    });

    mockFetchSummary
      .mockResolvedValueOnce({ totalDurationMs: 4000, averagePerDayMs: 500 })
      .mockResolvedValueOnce({ totalDurationMs: 8000, averagePerDayMs: 400 });

    const onNavigateToSettings = jest.fn();
    const childContext = { childId: 'child-1', childName: 'Ava' };

    const { getByText, getAllByText } = render(
      <HomeScreen
        onNavigateToSettings={onNavigateToSettings}
        childContext={childContext}
        permissionState={{ usage: true, location: true }}
      />,
    );

    await flushAsync();

    await waitFor(() => expect(mockFetchSummary).toHaveBeenCalledWith('child-1', 7));
    expect(mockFetchSummary).toHaveBeenCalledWith('child-1', 30);
    const [topApp] = getAllByText('Demo App');
    expect(topApp).toBeTruthy();

    fireEvent.press(getByText('Refresh'));
    await waitFor(() => expect(mockRefreshForeground).toHaveBeenCalled());

    fireEvent.press(getByText('Refresh Location'));
    await waitFor(() => expect(mockSendLocationUpdate).toHaveBeenCalledWith('child-1'));

    fireEvent.press(getByText('Settings'));
    expect(onNavigateToSettings).toHaveBeenCalled();
  });
});
