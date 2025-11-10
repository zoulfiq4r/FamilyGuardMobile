// Core mocks for native modules leveraged across tests.

jest.mock('@react-native-firebase/app', () => ({
  getApp: jest.fn(() => ({ name: 'mock-app' })),
}));

jest.mock('@react-native-firebase/auth', () => ({
  getAuth: jest.fn(() => ({})),
}));

jest.mock('@react-native-firebase/firestore', () => {
  const makeQuery = () => ({
    where: jest.fn(() => makeQuery()),
    limit: jest.fn(() => makeQuery()),
    get: jest.fn(async () => ({ empty: true, docs: [] })),
  });

  const makeDoc = () => ({
    id: 'mockDocId',
    set: jest.fn(async () => {}),
    update: jest.fn(async () => {}),
    get: jest.fn(async () => ({ exists: true, data: () => ({}) })),
    collection: jest.fn(() => makeCollection()),
    ref: { update: jest.fn(async () => {}) },
  });

  const makeCollection = () => ({
    add: jest.fn(async (payload) => ({ id: 'newMockId', payload })),
    doc: jest.fn(() => makeDoc()),
    where: jest.fn(() => makeQuery()),
    limit: jest.fn(() => makeQuery()),
    get: jest.fn(async () => ({ empty: true, docs: [] })),
  });

  const mockDb = {
    collection: jest.fn(() => makeCollection()),
    doc: jest.fn(() => makeDoc()),
  };

  const Timestamp = {
    fromDate: jest.fn((date) => ({
      toDate: () => date,
      seconds: Math.floor(date.getTime() / 1000),
    })),
  };

  return {
    getFirestore: jest.fn(() => mockDb),
    collection: jest.fn(() => makeCollection()),
    doc: jest.fn(() => makeDoc()),
    setDoc: jest.fn(async () => {}),
    serverTimestamp: jest.fn(() => new Date()),
    increment: jest.fn((value = 0) => value),
    Timestamp,
  };
});

jest.mock('react-native-device-info', () => ({
  getUniqueId: jest.fn(async () => 'mock-device-id'),
  getDeviceName: jest.fn(async () => 'Mock Device'),
  getModel: jest.fn(() => 'MockModel'),
  getBrand: jest.fn(() => 'MockBrand'),
  getSystemName: jest.fn(() => 'MockOS'),
  getVersion: jest.fn(async () => '1.0.0'),
}));

jest.mock('@react-native-community/geolocation', () => ({
  getCurrentPosition: jest.fn((success) => {
    success({
      coords: {
        latitude: 37.421998,
        longitude: -122.084,
        accuracy: 50,
        altitude: 0,
        speed: 0,
      },
      timestamp: Date.now(),
    });
  }),
}));

jest.mock('react-native-background-timer', () => ({
  setInterval: jest.fn(() => 1),
  clearInterval: jest.fn(() => {}),
}));

jest.mock('react-native/Libraries/Alert/Alert', () => ({
  alert: jest.fn(),
}));

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);
