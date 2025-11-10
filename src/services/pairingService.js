
import { collections, serverTimestamp } from '../config/firebase';
import DeviceInfo from 'react-native-device-info';

/**
 * Validates a pairing code and pairs the device with a child
 * @param {string} pairingCode - The 6-digit pairing code
 * @returns {Promise<{success: boolean, childId: string, childName: string}>}
 */
export const validateAndPairDevice = async (pairingCode) => {
  try {
    console.log('🔍 Validating pairing code:', pairingCode);


import { collections } from '../config/firebase';
import firestore from '@react-native-firebase/firestore';
import DeviceInfo from 'react-native-device-info';

/**
 * Validates a pairing code and pairs the device with a child
 * @param {string} pairingCode - The 6-digit pairing code
 * @returns {Promise<{success: boolean, childId: string, childName: string}>}
 */
export const validateAndPairDevice = async (pairingCode) => {
  try {
    console.log('🔍 Validating pairing code:', pairingCode);


    // Query pairingCodes collection using the code (some docs may not have isUsed field yet)
    const pairingCodesSnapshot = await collections.pairingCodes
      .where('code', '==', pairingCode)
      .limit(1)
      .get();

    if (pairingCodesSnapshot.empty) {
      throw new Error('Invalid pairing code. Please check the code and try again.');
    }

    const pairingDoc = pairingCodesSnapshot.docs[0];
    const pairingData = pairingDoc.data();

    // Log all fields in the pairing code document for debugging
    console.log('📋 Pairing code data (all fields):', JSON.stringify(pairingData, null, 2));
    console.log('📋 Pairing code fields:', Object.keys(pairingData));

    const deviceId = await DeviceInfo.getUniqueId();

    if (pairingData.isUsed === true || pairingData.used === true) {
      console.log('🔁 Pairing code already marked used. Checking existing device entry...');

      const existingDeviceDoc = await collections.devices.doc(deviceId).get();
      if (existingDeviceDoc.exists) {
        const existingDevice = existingDeviceDoc.data();
        const existingChildId = existingDevice.childId;
        if (existingChildId) {
          const childSnapshot = await collections.children.doc(existingChildId).get();
          const childData = childSnapshot.exists ? childSnapshot.data() : {};

          await existingDeviceDoc.ref.update({

            lastSeen: serverTimestamp(),

            lastSeen: firestore.FieldValue.serverTimestamp(),

            isActive: true,
          });

          console.log('✅ Reusing existing pairing for device:', {
            deviceId,
            childId: existingChildId,
            childName: childData?.name,
          });

          return {
            success: true,
            childId: existingChildId,
            childName: childData?.name || pairingData.childName,
            deviceId,
            parentId: existingDevice.parentId || pairingData.parentId,
          };
        }
      }

      throw new Error('This pairing code has already been used');
    }


    // Check if code is expired (10 minutes = 600000 ms)
    const createdAt = pairingData.createdAt?.toMillis?.() || 
                      (pairingData.createdAt?.seconds ? pairingData.createdAt.seconds * 1000 : null) ||
                      pairingData.timestamp?.toMillis?.() ||
                      (pairingData.timestamp?.seconds ? pairingData.timestamp.seconds * 1000 : null);
    const now = Date.now();
    const tenMinutes = 10 * 60 * 1000; // 10 minutes in milliseconds

    if (!createdAt || (now - createdAt > tenMinutes)) {
      throw new Error('Pairing code has expired. Please generate a new code.');
    }

    // Get parentId and childName from pairing code document (STEP 2)
    const parentId = pairingData.parentId;
    const childName = pairingData.childName;

    console.log('🔍 Extracted data:', { parentId, childName });

    // Validate required fields
    if (!parentId) {
      console.error('❌ Missing parentId in pairing code. Available fields:', Object.keys(pairingData));
      throw new Error('Invalid pairing code. Missing parentId.');
    }

    if (!childName) {
      console.error('❌ Missing childName in pairing code. Available fields:', Object.keys(pairingData));
      throw new Error('Invalid pairing code. Missing childName.');
    }

    // Mark code as used (STEP 3)
    console.log('📝 Marking pairing code as used...');
    await pairingDoc.ref.update({
      isUsed: true,
      usedAt: serverTimestamp(),
    });

    // Create child document (STEP 4 - REQUIRED)
    console.log('👤 Creating child document...');
    const newChildRef = await collections.children.add({
      parentId: parentId, // MUST match the parentId shown in console
      name: childName,
      createdAt: serverTimestamp(),
      isPaired: false,
    });

    const childId = newChildRef.id;
    console.log('✅ Created child document:', childId, { parentId, childName });

    // Get device information
    const deviceName = await DeviceInfo.getDeviceName();
    const deviceModel = await DeviceInfo.getModel();
    const deviceBrand = await DeviceInfo.getBrand();

    // Create or update device entry
    const deviceRef = collections.devices.doc(deviceId);
    await deviceRef.set({
      deviceId,
      childId,
      parentId,
      deviceName,
      deviceModel,
      deviceBrand,
      pairedAt: serverTimestamp(),
      lastSeen: serverTimestamp(),
      isActive: true,
      platform: DeviceInfo.getSystemName(),
      version: await DeviceInfo.getVersion(),
    }, { merge: true });

    // Update child document to include this device
    await collections.children.doc(childId).update({
      deviceId,
      deviceName,
      lastPaired: serverTimestamp(),
      isPaired: true,
    });

    console.log('✅ Device paired successfully:', {
      deviceId,
      childId,
      childName: childName,
      parentId: parentId,
    });

    return {
      success: true,
      childId,
      childName: childName,
      deviceId,
      parentId,
    };
  } catch (error) {
    console.error('❌ Pairing error:', error);
    
    // Re-throw with a user-friendly message if it's not already an Error object
    if (error instanceof Error) {
      throw error;
    } else {
      throw new Error('Failed to pair device. Please try again.');
    }
  }
};


    // Check if code is expired (10 minutes = 600000 ms)
    const createdAt = pairingData.createdAt?.toMillis?.() || 
                      (pairingData.createdAt?.seconds ? pairingData.createdAt.seconds * 1000 : null) ||
                      pairingData.timestamp?.toMillis?.() ||
                      (pairingData.timestamp?.seconds ? pairingData.timestamp.seconds * 1000 : null);
    const now = Date.now();
    const tenMinutes = 10 * 60 * 1000; // 10 minutes in milliseconds

    if (!createdAt || (now - createdAt > tenMinutes)) {
      throw new Error('Pairing code has expired. Please generate a new code.');
    }

    // Get parentId and childName from pairing code document (STEP 2)
    const parentId = pairingData.parentId;
    const childName = pairingData.childName;

    console.log('🔍 Extracted data:', { parentId, childName });

    // Validate required fields
    if (!parentId) {
      console.error('❌ Missing parentId in pairing code. Available fields:', Object.keys(pairingData));
      throw new Error('Invalid pairing code. Missing parentId.');
    }

    if (!childName) {
      console.error('❌ Missing childName in pairing code. Available fields:', Object.keys(pairingData));
      throw new Error('Invalid pairing code. Missing childName.');
    }

    // Mark code as used (STEP 3)
    console.log('📝 Marking pairing code as used...');
    await pairingDoc.ref.update({ 
      isUsed: true,
      usedAt: firestore.FieldValue.serverTimestamp(),
    });

    // Create child document (STEP 4 - REQUIRED)
    console.log('👤 Creating child document...');
    const newChildRef = await collections.children.add({
      parentId: parentId,  // MUST match the parentId shown in console
      name: childName,
      createdAt: firestore.FieldValue.serverTimestamp(),
      isPaired: false,
    });

    const childId = newChildRef.id;
    console.log('✅ Created child document:', childId, { parentId, childName });

    // Get device information
    const deviceName = await DeviceInfo.getDeviceName();
    const deviceModel = await DeviceInfo.getModel();
    const deviceBrand = await DeviceInfo.getBrand();

    // Create or update device entry
    const deviceRef = collections.devices.doc(deviceId);
    await deviceRef.set({
      deviceId,
      childId,
      parentId,
      deviceName,
      deviceModel,
      deviceBrand,
      pairedAt: firestore.FieldValue.serverTimestamp(),
      lastSeen: firestore.FieldValue.serverTimestamp(),
      isActive: true,
      platform: DeviceInfo.getSystemName(),
      version: await DeviceInfo.getVersion(),
    }, { merge: true });

    // Update child document to include this device
    await collections.children.doc(childId).update({
      deviceId,
      deviceName,
      lastPaired: firestore.FieldValue.serverTimestamp(),
      isPaired: true,
    });

    console.log('✅ Device paired successfully:', {
      deviceId,
      childId,
      childName: childName,
      parentId: parentId,
    });

    return {
      success: true,
      childId,
      childName: childName,
      deviceId,
      parentId,
    };
  } catch (error) {
    console.error('❌ Pairing error:', error);
    
    // Re-throw with a user-friendly message if it's not already an Error object
    if (error instanceof Error) {
      throw error;
    } else {
      throw new Error('Failed to pair device. Please try again.');
    }
  }
};

