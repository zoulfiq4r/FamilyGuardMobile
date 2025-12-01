import DeviceInfo from 'react-native-device-info';
import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  limit as limitQuery,
  query,
  setDoc,
  updateDoc,
  where,
} from '@react-native-firebase/firestore';
import auth from '@react-native-firebase/auth';
import { collections, serverTimestamp } from '../config/firebase';

const PAIRING_EXPIRY_MS = 10 * 60 * 1000;

const normalizeTimestamp = (value) => {
  if (!value) {
    return null;
  }
  if (typeof value.toMillis === 'function') {
    return value.toMillis();
  }
  if (typeof value.seconds === 'number') {
    return value.seconds * 1000 + Math.round((value.nanoseconds || 0) / 1_000_000);
  }
  if (typeof value === 'number') {
    return value;
  }
  return null;
};

const assertField = (value, label) => {
  if (!value) {
    throw new Error(`Invalid pairing code. Missing ${label}.`);
  }
};

export const validateAndPairDevice = async (pairingCode) => {
  try {
    if (!pairingCode) {
      throw new Error('Pairing code is required.');
    }

    console.log('🔍 Validating pairing code:', pairingCode);

    const pairingCodesSnapshot = await getDocs(
      query(collections.pairingCodes, where('code', '==', pairingCode), limitQuery(1)),
    );

    if (pairingCodesSnapshot.empty) {
      throw new Error('Invalid pairing code. Please check the code and try again.');
    }

    const pairingDoc = pairingCodesSnapshot.docs[0];
    const pairingData = pairingDoc.data() || {};
    const deviceId = await DeviceInfo.getUniqueId();

    const markDeviceHeartbeat = async (deviceDoc) => {
      await updateDoc(deviceDoc.ref, {
        lastSeen: serverTimestamp(),
        isActive: true,
      });
    };

    if (pairingData.isUsed || pairingData.used) {
      const existingDeviceDoc = await getDoc(doc(collections.devices, deviceId));
      if (existingDeviceDoc.exists) {
        const existingDevice = existingDeviceDoc.data() || {};
        if (existingDevice.childId) {
          const childSnapshot = await getDoc(doc(collections.children, existingDevice.childId));
          const childData = childSnapshot.exists ? childSnapshot.data() : {};
          await markDeviceHeartbeat(existingDeviceDoc);
          return {
            success: true,
            childId: existingDevice.childId,
            childName: childData?.name || pairingData.childName,
            deviceId,
            parentId: existingDevice.parentId || pairingData.parentId,
          };
        }
      }
      throw new Error('This pairing code has already been used');
    }

    const createdAt =
      normalizeTimestamp(pairingData.createdAt) ?? normalizeTimestamp(pairingData.timestamp);
    const now = Date.now();
    if (!createdAt || now - createdAt > PAIRING_EXPIRY_MS) {
      throw new Error('Pairing code has expired. Please generate a new code.');
    }

    const parentId = pairingData.parentId;
    const childName = pairingData.childName;
    assertField(parentId, 'parentId');
    assertField(childName, 'childName');

    await updateDoc(pairingDoc.ref, {
      isUsed: true,
      usedAt: serverTimestamp(),
    });

    const childRef = await addDoc(collections.children, {
      parentId,
      name: childName,
      createdAt: serverTimestamp(),
      isPaired: false,
    });
    const childId = childRef.id;

    const [deviceName, deviceModel, deviceBrand, systemName, systemVersion] = await Promise.all([
      DeviceInfo.getDeviceName(),
      DeviceInfo.getModel(),
      DeviceInfo.getBrand(),
      DeviceInfo.getSystemName(),
      DeviceInfo.getVersion(),
    ]);

    const deviceRef = doc(collections.devices, deviceId);
    await setDoc(
      deviceRef,
      {
        deviceId,
        childId,
        parentId,
        deviceName,
        deviceModel,
        deviceBrand,
        platform: systemName,
        version: systemVersion,
        pairedAt: serverTimestamp(),
        lastSeen: serverTimestamp(),
        isActive: true,
      },
      { merge: true },
    );

    await updateDoc(doc(collections.children, childId), {
      deviceId,
      deviceName,
      lastPaired: serverTimestamp(),
      isPaired: true,
      authUid: auth().currentUser?.uid, // Store anonymous auth UID for security rules
    });

    console.log('✅ Device paired successfully:', {
      deviceId,
      childId,
      childName,
      parentId,
    });

    return {
      success: true,
      childId,
      childName,
      deviceId,
      parentId,
    };
  } catch (error) {
    console.error('❌ Pairing error:', error);
    if (error instanceof Error) {
      throw error;
    }
    throw new Error('Failed to pair device. Please try again.');
  }
};

export const fetchExistingDevicePairing = async () => {
  try {
    const deviceId = await DeviceInfo.getUniqueId();
    const deviceRef = doc(collections.devices, deviceId);
    const deviceSnapshot = await getDoc(deviceRef);

    if (!deviceSnapshot.exists) {
      return null;
    }

    const deviceData = deviceSnapshot.data() || {};
    if (!deviceData.childId) {
      return null;
    }

    let childName = deviceData.childName;
    if (!childName) {
      const childSnapshot = await getDoc(doc(collections.children, deviceData.childId));
      if (childSnapshot.exists) {
        const childData = childSnapshot.data() || {};
        childName = childData.name || childName;
      }
    }

    await updateDoc(deviceRef, {
      lastSeen: serverTimestamp(),
      isActive: true,
    });

    return {
      success: true,
      deviceId,
      childId: deviceData.childId,
      childName,
      parentId: deviceData.parentId,
    };
  } catch (error) {
    console.error('❌ Pairing restore error:', error);
    return null;
  }
};
