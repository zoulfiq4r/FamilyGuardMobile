import { getApp } from '@react-native-firebase/app';
import { getAuth } from '@react-native-firebase/auth';
import {
  getFirestore,
  collection,
  doc,
  setDoc,
  serverTimestamp as firestoreServerTimestamp,
  increment as firestoreIncrement,
  Timestamp,
} from '@react-native-firebase/firestore';

const app = getApp();
const auth = getAuth(app);
const db = getFirestore(app);

const buildCollection = (name) => collection(db, name);

export const collections = {
  users: buildCollection('users'),
  children: buildCollection('children'),
  families: buildCollection('families'),
  devices: buildCollection('devices'),
  pairingCodes: buildCollection('pairingCodes'),
  locations: buildCollection('locations'),
  activityLogs: buildCollection('activityLogs'),
  controls: buildCollection('controls'),
  alerts: buildCollection('alerts'),
  appUsageSessions: buildCollection('appUsageSessions'),
  appUsageAggregates: buildCollection('appUsageAggregates'),
};

export const serverTimestamp = () => firestoreServerTimestamp();
export const increment = (value = 1) => firestoreIncrement(value);
export { Timestamp };

export const generatePairingCode = () =>
  Math.floor(100000 + Math.random() * 900000).toString();

export const testFirebaseConnection = async () => {
  // This diagnostic write can fail if rules don't allow /test/**.
  // We keep it silent on permission errors.
  try {
    console.log('🔥 Testing Firebase connection...');
    const connectionDoc = doc(buildCollection('test'), 'connection');
    await setDoc(connectionDoc, {
      timestamp: serverTimestamp(),
      ok: true,
    });
    console.log('✅ Firebase Firestore test write succeeded');
    return true;
  } catch (error) {
    if (String(error?.code).includes('permission')) {
      console.log('ℹ️ Firebase test skipped due to rules (permission-denied).');
      return false;
    }
    console.error('❌ Firebase connection test error:', error);
    return false;
  }
};

export { app, auth, db };
