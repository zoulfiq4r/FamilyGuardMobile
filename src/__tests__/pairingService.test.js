import { validateAndPairDevice } from '../services/pairingService';

// Helpers to build Firestore-like snapshots
const makeDoc = (data = {}, id = 'doc-id') => ({
  id,
  data: () => data,
  ref: { update: jest.fn(async () => {}) },
});

const now = Date.now();
const recentTs = { toMillis: () => now - 1000 };
const oldTs = { toMillis: () => now - (11 * 60 * 1000) };

// Dynamic mocks we can mutate per test
let mockPairingDocs = [];
let mockChildrenAdd;
let mockDevicesDoc;
let mockChildrenDoc;

jest.mock('../config/firebase', () => {

  const serverTimestamp = jest.fn(() => 'server-ts');

  const firestore = { FieldValue: { serverTimestamp: jest.fn(() => 'server-ts') } };


  const pairingCodes = {
    where: jest.fn(() => pairingCodes),
    limit: jest.fn(() => pairingCodes),
    get: jest.fn(async () => ({ empty: mockPairingDocs.length === 0, docs: mockPairingDocs })),
  };

  mockChildrenAdd = jest.fn(async (payload) => ({ id: 'new-child-id', payload }));
  mockChildrenDoc = jest.fn(() => ({
    update: jest.fn(async () => {}),
    get: jest.fn(async () => ({ exists: true, data: () => ({ name: 'Child X' }) })),
    set: jest.fn(async () => {}),
  }));
  const children = {
    add: mockChildrenAdd,
    doc: mockChildrenDoc,
    where: jest.fn(() => children),
    get: jest.fn(async () => ({ empty: true, docs: [] })),
    limit: jest.fn(() => children),
  };

  mockDevicesDoc = jest.fn(() => ({
    set: jest.fn(async () => {}),
    get: jest.fn(async () => ({ exists: false })),
    ref: { update: jest.fn(async () => {}) },
  }));
  const devices = { doc: mockDevicesDoc };

  return {
    collections: {
      pairingCodes,
      children,
      devices,
    },

    serverTimestamp,

    firestore,

  };
});

jest.mock('react-native-device-info', () => ({
  getUniqueId: jest.fn(async () => 'device-123'),
  getDeviceName: jest.fn(async () => 'Demo Device'),
  getModel: jest.fn(() => 'DemoModel'),
  getBrand: jest.fn(() => 'DemoBrand'),
  getSystemName: jest.fn(() => 'Android'),
  getVersion: jest.fn(async () => '1.0.0'),
}));

describe('pairingService.validateAndPairDevice', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockPairingDocs = [];
  });

  test('pairs successfully, creates child and device, marks code used', async () => {
    const pairingData = {
      code: '123456',
      isUsed: false,
      parentId: 'parent-1',
      childName: 'Alex',
      createdAt: recentTs,
    };
    const pairingDoc = makeDoc(pairingData, 'pair-1');
    mockPairingDocs = [pairingDoc];

    const result = await validateAndPairDevice('123456');

    expect(result).toEqual({
      success: true,
      childId: 'new-child-id',
      childName: 'Alex',
      deviceId: 'device-123',
      parentId: 'parent-1',
    });

    // child created with parentId and name
    expect(mockChildrenAdd).toHaveBeenCalledWith(
      expect.objectContaining({ parentId: 'parent-1', name: 'Alex' }),
    );

    // device document set called
    expect(mockDevicesDoc).toHaveBeenCalledWith('device-123');

    // pairing code marked as used
    expect(pairingDoc.ref.update).toHaveBeenCalledWith(
      expect.objectContaining({ isUsed: true }),
    );
  });

  test('reuses pairing when code already used and device exists', async () => {
    // pairing marked used
    const pairingData = {
      code: '654321',
      isUsed: true,
      parentId: 'parent-2',
      childName: 'Sam',
      createdAt: recentTs,
    };
    const pairingDoc = makeDoc(pairingData, 'pair-2');
    mockPairingDocs = [pairingDoc];

    // Make device doc exist and point to a child
    const deviceDoc = mockDevicesDoc();
    deviceDoc.get = jest.fn(async () => ({ exists: true, data: () => ({ childId: 'child-existing', parentId: 'parent-2' }), ref: { update: jest.fn(async () => {}) } }));
    mockDevicesDoc.mockReturnValueOnce(deviceDoc);

    const childDoc = mockChildrenDoc();
    childDoc.get = jest.fn(async () => ({ exists: true, data: () => ({ name: 'Sam' }) }));
    mockChildrenDoc.mockReturnValueOnce(childDoc);

    const result = await validateAndPairDevice('654321');

    expect(result).toEqual({
      success: true,
      childId: 'child-existing',
      childName: 'Sam',
      deviceId: 'device-123',
      parentId: 'parent-2',
    });
  });

  test('throws for invalid pairing code (not found)', async () => {
    await expect(validateAndPairDevice('000000')).rejects.toThrow(/Invalid pairing code/);
  });

  test('throws when code expired', async () => {
    const pairingData = {
      code: '999999',
      isUsed: false,
      parentId: 'p',
      childName: 'C',
      createdAt: oldTs,
    };
    mockPairingDocs = [makeDoc(pairingData, 'pair-exp')];

    await expect(validateAndPairDevice('999999')).rejects.toThrow(/expired/);
  });
});





