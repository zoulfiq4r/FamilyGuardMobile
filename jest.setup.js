/* eslint-env jest */
// Core mocks for native modules leveraged across tests.

jest.mock('@react-native-firebase/app', () => {
  const mockApp = { name: 'mock-app' };
  const defaultExport = jest.fn(() => mockApp);
  const getApp = jest.fn(() => mockApp);
  return {
    __esModule: true,
    default: defaultExport,
    getApp,
  };
});

jest.mock('@react-native-firebase/auth', () => {
  const authInstance = { currentUser: null };
  const defaultExport = jest.fn(() => authInstance);
  const getAuth = jest.fn(() => authInstance);
  return {
    __esModule: true,
    default: defaultExport,
    getAuth,
  };
});

jest.mock('@react-native-firebase/firestore', () => {
  const collections = new Map();

  const makeDoc = (path) => ({
    id: path.split('/').pop() || 'mockDocId',
    set: jest.fn(async () => {}),
    update: jest.fn(async () => {}),
    get: jest.fn(async () => ({ exists: false, data: () => ({}) })),
    collection: jest.fn((child) => ensureCollection(`${path}/${child}`)),
  });

  const ensureCollection = (name) => {
    if (collections.has(name)) {
      return collections.get(name);
    }

    const collectionRef = {
      name,
      add: jest.fn(async (payload) => ({ id: `${name}-doc`, payload })),
      doc: jest.fn((id = `${name}-doc`) => makeDoc(`${name}/${id}`)),
      get: jest.fn(async () => ({ empty: true, docs: [] })),
      onSnapshot: jest.fn((success) => {
        success?.({ forEach: () => {} });
        return jest.fn();
      }),
    };
    collections.set(name, collectionRef);
    return collectionRef;
  };

  const collectionFn = jest.fn((rootOrRef, path) => {
    if (rootOrRef && typeof rootOrRef.collection === 'function' && path) {
      return rootOrRef.collection(path);
    }
    if (typeof rootOrRef === 'string' && !path) {
      return ensureCollection(rootOrRef);
    }
    if (path) {
      return ensureCollection(path);
    }
    return ensureCollection(rootOrRef);
  });

  const docFn = jest.fn((collectionRef, id) => collectionRef.doc(id));

  const module = {
    getFirestore: jest.fn(() => ({})),
    collection: collectionFn,
    doc: docFn,
    addDoc: jest.fn(async (collectionRef, payload) => collectionRef.add(payload)),
    setDoc: jest.fn(async (docRef, data, options) => docRef.set(data, options)),
    updateDoc: jest.fn(async (docRef, data) => docRef.update(data)),
    getDocs: jest.fn(async (collectionRef) => collectionRef.get()),
    getDoc: jest.fn(async (docRef) => docRef.get()),
    query: jest.fn((collectionRef, ...constraints) => {
      return constraints.reduce((ref, constraint) => {
        if (!constraint || typeof constraint !== 'object') {
          return ref;
        }
        switch (constraint.__type) {
          case 'where':
            return ref.where(constraint.field, constraint.op, constraint.value);
          case 'orderBy':
            return ref.orderBy(constraint.field, constraint.direction);
          case 'limit':
            return ref.limit(constraint.value);
          default:
            return ref;
        }
      }, collectionRef);
    }),
    where: jest.fn((field, op, value) => ({ __type: 'where', field, op, value })),
    orderBy: jest.fn((field, direction) => ({ __type: 'orderBy', field, direction })),
    limit: jest.fn((value) => ({ __type: 'limit', value })),
    onSnapshot: jest.fn((ref, success, error) => ref.onSnapshot(success, error)),
    serverTimestamp: jest.fn(() => new Date()),
    increment: jest.fn((value = 1) => ({ __increment__: value })),
    Timestamp: {
      fromDate: (date) => ({
        toDate: () => date,
        toMillis: () => date.getTime(),
        seconds: Math.floor(date.getTime() / 1000),
        nanoseconds: (date.getTime() % 1000) * 1_000_000,
      }),
    },
    FieldValue: {
      serverTimestamp: jest.fn(() => new Date()),
      increment: jest.fn((value = 1) => ({ __increment__: value })),
    },
  };

  return module;
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

jest.mock('react-native-fs', () => ({
  readFile: jest.fn(),
  writeFile: jest.fn(),
  unlink: jest.fn(),
  exists: jest.fn(),
  mkdir: jest.fn(),
  readDir: jest.fn(),
  stat: jest.fn(),
  DocumentDirectoryPath: '/mock/documents',
  CachesDirectoryPath: '/mock/cache',
  TemporaryDirectoryPath: '/mock/tmp',
}));

jest.mock('@react-native-community/netinfo', () => ({
  __esModule: true,
  default: {
    fetch: jest.fn(() => Promise.resolve({ isConnected: true, isInternetReachable: true })),
    addEventListener: jest.fn(() => jest.fn()),
  },
  NetInfoStateType: {
    unknown: 'unknown',
    none: 'none',
    cellular: 'cellular',
    wifi: 'wifi',
  },
}));
