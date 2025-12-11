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

  // Create a simple mock doc reference
  const makeDocRef = (path) => ({
    id: path.split('/').pop(),
    _path: path,
    set: jest.fn(async () => ({})),
    update: jest.fn(async () => ({})),
    delete: jest.fn(async () => ({})),
    get: jest.fn(async () => ({
      exists: () => true,
      data: () => ({}),
      id: path.split('/').pop(),
    })),
    collection: jest.fn((childPath) => makeCollectionRef(`${path}/${childPath}`)),
  });

  // Create a simple mock collection reference
  const makeCollectionRef = (path) => {
    if (collections.has(path)) {
      return collections.get(path);
    }

    const collectionRef = {
      _path: path,
      _docs: [],
      add: jest.fn(async (data) => ({
        id: `doc-${Date.now()}`,
        ...makeDocRef(`${path}/doc-${Date.now()}`),
      })),
      doc: jest.fn((docId) => {
        const docPath = `${path}/${docId}`;
        const existing = collections.get(docPath);
        if (existing) return existing;
        const newDoc = makeDocRef(docPath);
        collections.set(docPath, newDoc);
        return newDoc;
      }),
      get: jest.fn(async () => ({
        empty: collectionRef._docs.length === 0,
        docs: collectionRef._docs,
        forEach: (cb) => collectionRef._docs.forEach(cb),
      })),
      onSnapshot: jest.fn((success, error) => {
        const snapshot = {
          empty: collectionRef._docs.length === 0,
          docs: collectionRef._docs,
          forEach: (cb) => collectionRef._docs.forEach(cb),
        };
        success?.(snapshot);
        return jest.fn();
      }),
    };
    collections.set(path, collectionRef);
    return collectionRef;
  };

  return {
    __esModule: true,
    getFirestore: jest.fn(() => ({
      _path: 'db',
    })),
    collection: jest.fn((dbOrRef, path) => {
      // Handle: collection(db, 'path') or collection(docRef, 'subcollection')
      if (dbOrRef && dbOrRef._path && path) {
        // docRef.collection('sub')
        return makeCollectionRef(`${dbOrRef._path}/${path}`);
      } else if (typeof path === 'string') {
        // db.collection('path')
        return makeCollectionRef(path);
      }
      return makeCollectionRef('unknown');
    }),
    doc: jest.fn((dbOrCollectionOrPath, maybeDocId) => {
      // Handle: doc(db, "path") or doc(collectionRef, id)
      if (typeof maybeDocId === 'string') {
        // This is doc(something, id)
        const collectionPath = (dbOrCollectionOrPath && dbOrCollectionOrPath._path) || '';
        const fullPath = collectionPath ? `${collectionPath}/${maybeDocId}` : maybeDocId;
        return makeDocRef(fullPath);
      } else if (typeof dbOrCollectionOrPath === 'string') {
        // This is doc(db, path) with a path string
        return makeDocRef(dbOrCollectionOrPath);
      }
      return makeDocRef('unknown');
    }),
    deleteDoc: jest.fn(async (docRef) => {
      if (typeof docRef.delete === 'function') {
        return docRef.delete();
      }
    }),
    getDocs: jest.fn(async (collectionRef) => {
      if (typeof collectionRef.get === 'function') {
        return collectionRef.get();
      }
      return { empty: true, docs: [], forEach: () => {} };
    }),
    getDoc: jest.fn(async (docRef) => {
      if (typeof docRef.get === 'function') {
        return docRef.get();
      }
      return { exists: () => false, data: () => ({}) };
    }),
    onSnapshot: jest.fn((collectionRef, success, error) => {
      if (typeof collectionRef.onSnapshot === 'function') {
        return collectionRef.onSnapshot(success, error);
      }
      success?.({ empty: true, docs: [], forEach: () => {} });
      return jest.fn();
    }),
    setDoc: jest.fn(async (docRef, data) => {
      if (typeof docRef.set === 'function') {
        return docRef.set(data);
      }
    }),
    updateDoc: jest.fn(async (docRef, data) => {
      if (typeof docRef.update === 'function') {
        return docRef.update(data);
      }
    }),
    addDoc: jest.fn(async (collectionRef, data) => {
      if (typeof collectionRef.add === 'function') {
        return collectionRef.add(data);
      }
    }),
    query: jest.fn((collectionRef) => collectionRef),
    where: jest.fn(() => ({})),
    orderBy: jest.fn(() => ({})),
    limit: jest.fn(() => ({})),
    serverTimestamp: jest.fn(() => new Date()),
    increment: jest.fn((value) => value),
    Timestamp: {
      fromDate: (date) => date,
      now: () => new Date(),
    },
    FieldValue: {
      serverTimestamp: () => new Date(),
      increment: (value) => value,
    },
  };
});

jest.mock('@react-native-firebase/functions', () => ({
  __esModule: true,
  default: jest.fn(() => ({})),
  getFunctions: jest.fn(() => ({})),
  httpsCallable: jest.fn(() => jest.fn(async () => ({ data: {} }))),
}));

jest.mock('@react-native-firebase/storage', () => {
  const mockRef = {
    child: jest.fn(function() { return this; }),
    put: jest.fn(async () => ({ ref: {} })),
    putString: jest.fn(async () => ({ ref: {} })),
    getDownloadURL: jest.fn(async () => 'https://example.com/image.jpg'),
    delete: jest.fn(async () => {}),
  };

  return {
    __esModule: true,
    default: {
      ref: jest.fn(() => mockRef),
      storage: jest.fn(() => ({
        ref: jest.fn(() => mockRef),
      })),
    },
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
