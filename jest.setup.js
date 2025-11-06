// Mocks for React Native Firebase and other native modules used in tests

jest.mock('@react-native-firebase/auth', () => {
  return () => ({});
});

jest.mock('@react-native-firebase/app', () => ({}));

jest.mock('@react-native-firebase/firestore', () => {
  const FieldValue = { serverTimestamp: jest.fn(() => new Date()) };

  const createDoc = () => ({
    id: 'mockDocId',
    set: jest.fn(async () => {}),
    update: jest.fn(async () => {}),
    get: jest.fn(async () => ({ exists: true, data: () => ({}) })),
    ref: { update: jest.fn(async () => {}) },
  });

  const collection = () => ({
    doc: jest.fn(() => createDoc()),
    add: jest.fn(async () => ({ id: 'newMockId' })),
    where: jest.fn(() => ({
      where: jest.fn(() => ({
        limit: jest.fn(() => ({
          get: jest.fn(async () => ({ empty: true, docs: [] })),
        })),
      })),
      limit: jest.fn(() => ({
        get: jest.fn(async () => ({ empty: true, docs: [] })),
      })),
      get: jest.fn(async () => ({ empty: true, docs: [] })),
    })),
    get: jest.fn(async () => ({ empty: true, docs: [] })),
  });

  const firestore = () => ({ collection });
  firestore.FieldValue = FieldValue;
  return firestore;
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
  getCurrentPosition: jest.fn((success, error) => {
    // Provide a deterministic mock position
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


