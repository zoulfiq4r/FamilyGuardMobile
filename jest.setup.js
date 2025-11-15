/* eslint-env jest */
// Core mocks for native modules leveraged across tests.

jest.mock('@react-native-firebase/app', () => {
  const mockApp = { name: 'mock-app' };
  const appFn = jest.fn(() => mockApp);
  appFn.getApp = jest.fn(() => mockApp);
  return appFn;
});

jest.mock('@react-native-firebase/auth', () => {
  const authInstance = { currentUser: null };
  const authFn = jest.fn(() => authInstance);
  return authFn;
});

jest.mock('@react-native-firebase/firestore', () => {
  const collections = new Map();

  const makeQuery = (factory) => {
    const query = {
      where: jest.fn(() => query),
      orderBy: jest.fn(() => query),
      limit: jest.fn(() => query),
      onSnapshot: jest.fn((success) => {
        success?.({ forEach: () => {} });
        return jest.fn();
      }),
      get: jest.fn(async () => ({ empty: true, docs: [] })),
    };
    return Object.assign(query, factory(query));
  };

  const makeDoc = (path) => ({
    id: path.split('/').pop() || 'mockDocId',
    set: jest.fn(async () => {}),
    update: jest.fn(async () => {}),
    get: jest.fn(async () => ({ exists: false, data: () => ({}) })),
    collection: jest.fn((child) => getCollection(`${path}/${child}`)),
    ref: { update: jest.fn(async () => {}) },
  });

  const getCollection = (name) => {
    if (collections.has(name)) {
      return collections.get(name);
    }

    const base = makeQuery(() => ({}));
    base.add = jest.fn(async (payload) => ({ id: `${name}-doc`, payload }));
    base.doc = jest.fn((id = `${name}-doc`) => makeDoc(`${name}/${id}`));
    collections.set(name, base);
    return base;
  };

  const firestoreInstance = () => ({
    collection: (path) => getCollection(path),
  });

  firestoreInstance.FieldValue = {
    serverTimestamp: jest.fn(() => new Date()),
    increment: jest.fn((value = 1) => ({ __increment__: value })),
  };
  firestoreInstance.Timestamp = {
    fromDate: (date) => ({
      toDate: () => date,
      toMillis: () => date.getTime(),
      seconds: Math.floor(date.getTime() / 1000),
    }),
  };

  return firestoreInstance;
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

jest.mock('react-native/Libraries/Alert/Alert', () => {
  const alert = jest.fn();
  return {
    alert,
    default: { alert },
  };
});

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);
