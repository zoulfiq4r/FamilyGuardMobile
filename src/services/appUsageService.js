import { NativeModules, Platform } from 'react-native';
import BackgroundTimer from 'react-native-background-timer';
import DeviceInfo from 'react-native-device-info';

import { collections, increment, serverTimestamp, Timestamp } from '../config/firebase';

import { collections, firestore } from '../config/firebase';

import { toDateKey } from './appUsageAnalytics';

const { AppUsageModule } = NativeModules;

const isAndroid = Platform.OS === 'android';
let pollingIntervalId = null;
let childContext = null;

let usageTrackingActive = false;


let deviceIdCache = null;
let lastEventTimestamp = Date.now() - 5 * 60 * 1000; // look back 5 minutes by default
let isProcessing = false;

const activeSessions = new Map(); // packageName -> { appName, startTime }
const listeners = new Set();
const usageTotals = new Map(); // packageName -> { packageName, appName, durationMs, sessions }
const recentSessions = [];
let activeApp = null;
let usageTimezone = 'UTC';
try {
  if (typeof Intl !== 'undefined' && typeof Intl.DateTimeFormat === 'function') {
    const resolved = new Intl.DateTimeFormat().resolvedOptions();
    if (resolved && resolved.timeZone) {
      usageTimezone = resolved.timeZone;
    }
  }
} catch (error) {
  console.warn('Failed to detect device timezone', error);
}
let currentDateKey = null;

const createFormatter = (timeZone) => {
  try {
    return new Intl.DateTimeFormat('en-US', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    });
  } catch (error) {
    console.warn('Failed to create timezone formatter', error);
    return null;
  }
};

let zonedFormatter = createFormatter(usageTimezone);

const buildSnapshot = () => {
  const totalsArray = Array.from(usageTotals.values()).sort(
    (a, b) => b.durationMs - a.durationMs,
  );
  const totalDurationMs = totalsArray.reduce((sum, item) => sum + (item.durationMs || 0), 0);
  return {
    activeApp,
    totals: totalsArray,
    totalDurationMs,
    dateKey: currentDateKey,
    recentSessions: [...recentSessions].sort(
      (a, b) => b.startTimeMs - a.startTimeMs,
    ),
    updatedAt: Date.now(),
  };
};

const ensureCurrentDateKey = (timestampMs = Date.now()) => {
  const nextKey = formatDateKey(timestampMs);
  if (currentDateKey === nextKey) {
    return;
  }
  currentDateKey = nextKey;
  usageTotals.clear();
  recentSessions.length = 0;
  const resetStart = timestampMs;
  activeSessions.forEach((entry, key) => {
    activeSessions.set(key, {
      ...entry,
      startTime: resetStart,
    });
  });
  notifyListeners();
};

const notifyListeners = () => {
  const snapshot = buildSnapshot();
  listeners.forEach((callback) => {
    try {
      callback(snapshot);
    } catch (error) {
      console.warn('AppUsageService listener error', error);
    }
  });
};

const getZonedParts = (timestampMs) => {
  if (!zonedFormatter) {
    return null;
  }
  try {
    const parts = zonedFormatter.formatToParts(new Date(timestampMs));
    return parts.reduce((acc, part) => {
      if (part.type !== 'literal') {
        acc[part.type] = part.value;
      }
      return acc;
    }, {});
  } catch (error) {
    console.warn('Failed to parse zoned date parts', error);
    return null;
  }
};

const formatDateKey = (timestampMs) => {
  const parts = getZonedParts(timestampMs);
  if (!parts?.year) {
    return toDateKey(new Date(timestampMs));
  }
  return `${parts.year}-${parts.month}-${parts.day}`;
};

const getHourBucket = (timestampMs) => {
  const parts = getZonedParts(timestampMs);
  if (!parts?.hour) {
    const date = new Date(timestampMs);
    return `${String(date.getHours()).padStart(2, '0')}:00`;
  }
  return `${parts.hour}:00`;
};

const ensureDeviceId = async () => {
  if (!deviceIdCache) {
    deviceIdCache = await DeviceInfo.getUniqueId();
  }
  return deviceIdCache;
};

const appendRecentSession = (session) => {
  recentSessions.push(session);
  if (recentSessions.length > 50) {
    recentSessions.shift();
  }
};

const updateTotals = (session) => {
  const existing = usageTotals.get(session.packageName) || {
    packageName: session.packageName,
    appName: session.appName,
    durationMs: 0,
    sessions: 0,
  };
  existing.durationMs += session.durationMs;
  existing.sessions += 1;
  existing.lastUsed = session.endTimeMs;
  usageTotals.set(session.packageName, existing);
};

const syncSessionToFirestore = async (session) => {
  if (!childContext?.childId) {
    console.warn('Skipping Firestore sync due to missing child context', {
      packageName: session.packageName,
    });
    return;
  }

  const deviceId = await ensureDeviceId();
  const sessionDoc = {
    childId: childContext.childId,
    parentId: childContext.parentId,
    deviceId,
    packageName: session.packageName,
    appName: session.appName,

    startTime: Timestamp.fromDate(new Date(session.startTimeMs)),
    endTime: Timestamp.fromDate(new Date(session.endTimeMs)),
    durationMs: session.durationMs,
    durationSeconds: Math.round(session.durationMs / 1000),
    createdAt: serverTimestamp(),

    startTime: firestore.Timestamp.fromDate(new Date(session.startTimeMs)),
    endTime: firestore.Timestamp.fromDate(new Date(session.endTimeMs)),
    durationMs: session.durationMs,
    durationSeconds: Math.round(session.durationMs / 1000),
    createdAt: firestore.FieldValue.serverTimestamp(),

    dateKey: session.dateKey,
    hourBucket: session.hourBucket,
    isOngoing: false,
  };

  try {
    console.log('📤 Writing app usage session document', {
      collection: 'appUsageSessions',
      childId: sessionDoc.childId,
      packageName: sessionDoc.packageName,
      durationMs: sessionDoc.durationMs,
    });
    const sessionRef = await collections.appUsageSessions.add(sessionDoc);
    console.log('✅ App usage session stored', {
      collection: 'appUsageSessions',
      documentId: sessionRef.id,
    });
  } catch (error) {
    console.error('❌ Failed to write app usage session document', error);
    throw error;
  }

  const aggregateRef = collections.appUsageAggregates.doc(
    `${childContext.childId}_${session.dateKey}`,
  );
  const aggregateUpdate = {
    childId: childContext.childId,
    parentId: childContext.parentId,
    dateKey: session.dateKey,

    lastUpdated: serverTimestamp(),
    totalDurationMs: increment(session.durationMs),
  };
  aggregateUpdate[`apps.${session.packageName}.packageName`] = session.packageName;
  aggregateUpdate[`apps.${session.packageName}.appName`] = session.appName;
  aggregateUpdate[`apps.${session.packageName}.durationMs`] = increment(session.durationMs);
  aggregateUpdate[`apps.${session.packageName}.sessions`] = increment(1);
  aggregateUpdate[`apps.${session.packageName}.lastUsed`] = session.endTimeMs;
  aggregateUpdate[`hours.${session.hourBucket}`] = increment(session.durationMs);

    lastUpdated: firestore.FieldValue.serverTimestamp(),
    totalDurationMs: firestore.FieldValue.increment(session.durationMs),
  };
  aggregateUpdate[`apps.${session.packageName}.packageName`] = session.packageName;
  aggregateUpdate[`apps.${session.packageName}.appName`] = session.appName;
  aggregateUpdate[`apps.${session.packageName}.durationMs`] = firestore.FieldValue.increment(
    session.durationMs,
  );
  aggregateUpdate[`apps.${session.packageName}.sessions`] = firestore.FieldValue.increment(1);
  aggregateUpdate[`apps.${session.packageName}.lastUsed`] = session.endTimeMs;
  aggregateUpdate[`hours.${session.hourBucket}`] = firestore.FieldValue.increment(
    session.durationMs,
  );


  try {
    console.log('📤 Updating aggregated usage document', {
      collection: 'appUsageAggregates',
      documentId: `${childContext.childId}_${session.dateKey}`,
      packageName: session.packageName,
      durationMsIncrement: session.durationMs,
    });
    await aggregateRef.set(aggregateUpdate, { merge: true });
    console.log('✅ Aggregated usage updated', {
      collection: 'appUsageAggregates',
      documentId: `${childContext.childId}_${session.dateKey}`,
    });
  } catch (error) {
    console.error('❌ Failed to update aggregated usage document', error);
    throw error;
  }

  const appDocRef = collections.children
    .doc(childContext.childId)
    .collection('apps')
    .doc(session.packageName);
  const usageMinutesIncrement = session.durationMs / 60000;
  const childAppUpdate = {
    name: session.appName,
    packageName: session.packageName,

    usageMinutes: increment(usageMinutesIncrement),
    isBlocked: false,
    updatedAt: serverTimestamp(),

    usageMinutes: firestore.FieldValue.increment(usageMinutesIncrement),
    isBlocked: false,
    updatedAt: firestore.FieldValue.serverTimestamp(),

  };

  try {
    console.log('📤 Upserting child app usage document', {
      path: `children/${childContext.childId}/apps/${session.packageName}`,
      name: session.appName,
      usageMinutesIncrement: Number(usageMinutesIncrement.toFixed(3)),
    });
    await appDocRef.set(childAppUpdate, { merge: true });
    console.log('✅ Child app usage document updated', {
      path: `children/${childContext.childId}/apps/${session.packageName}`,
    });
  } catch (error) {
    console.error('❌ Failed to upsert child app usage document', error);
    throw error;
  }
};

const updateDeviceCurrentApp = async (appInfo) => {
  const deviceId = await ensureDeviceId();
  await collections.devices.doc(deviceId).set(
    {
      currentApp: appInfo
        ? {
            packageName: appInfo.packageName,
            appName: appInfo.appName,

            since: Timestamp.fromDate(new Date(appInfo.since)),
            updatedAt: serverTimestamp(),
          }
        : null,
      lastUsageHeartbeat: serverTimestamp(),

            since: firestore.Timestamp.fromDate(new Date(appInfo.since)),
            updatedAt: firestore.FieldValue.serverTimestamp(),
          }
        : null,
      lastUsageHeartbeat: firestore.FieldValue.serverTimestamp(),

    },
    { merge: true },
  );
};

const recordCompletedSession = async ({ packageName, appName, startTimeMs, endTimeMs }) => {
  const durationMs = endTimeMs - startTimeMs;
  if (!childContext || durationMs < 1_000) {
    return;
  }

  ensureCurrentDateKey(startTimeMs);

  const session = {
    packageName,
    appName,
    startTimeMs,
    endTimeMs,
    durationMs,
    dateKey: formatDateKey(startTimeMs),
    hourBucket: getHourBucket(startTimeMs),
  };

  appendRecentSession(session);
  updateTotals(session);
  notifyListeners();

  try {
    await syncSessionToFirestore(session);
  } catch (error) {
    console.error('Failed to sync app usage session', error);
  }
};

const processUsageEvents = async (events) => {
  if (!events || events.length === 0) {
    return;
  }

  events.sort((a, b) => a.timestamp - b.timestamp);

  for (const event of events) {
    const { packageName, appName, eventType, timestamp } = event;
    if (!packageName || !timestamp) {
      continue;
    }

    if (eventType === 'FOREGROUND') {
      ensureCurrentDateKey(timestamp);
      activeSessions.set(packageName, { appName, startTime: timestamp });
      activeApp = {
        packageName,
        appName,
        since: timestamp,
        timestamp: Date.now(),
      };
      notifyListeners();
      updateDeviceCurrentApp({
        packageName,
        appName,
        since: timestamp,
      }).catch((error) => {
        console.warn('Failed to update current app', error);
      });
    } else if (eventType === 'BACKGROUND') {
      const activeEntry = activeSessions.get(packageName);
      const start = activeEntry?.startTime ?? lastEventTimestamp;
      activeSessions.delete(packageName);
      if (activeApp?.packageName === packageName) {
        activeApp = null;
        notifyListeners();
        updateDeviceCurrentApp(null).catch(() => {});
      }
      if (start < timestamp) {
        await recordCompletedSession({
          packageName,
          appName: activeEntry?.appName || appName || packageName,
          startTimeMs: start,
          endTimeMs: timestamp,
        });
      }
      ensureCurrentDateKey(timestamp);
    }
    lastEventTimestamp = Math.max(lastEventTimestamp, timestamp);
  }
};

const pollUsageStats = async () => {
  if (!childContext || !AppUsageModule || !isAndroid || isProcessing) {
    return;
  }

  isProcessing = true;
  try {
    const events = await AppUsageModule.getUsageEvents(lastEventTimestamp);
    await processUsageEvents(events ?? []);
  } catch (error) {
    console.error('App usage poll failed', error);
  } finally {
    isProcessing = false;
  }
};

export const startAppUsageTracking = async (context) => {
  if (!isAndroid) {
    console.log('App usage tracking is only supported on Android devices.');
    return false;
  }

  if (!AppUsageModule) {
    console.warn('AppUsageModule native module is unavailable.');
    return false;
  }

  if (!context?.childId) {
    console.warn('Missing child context for app usage tracking');
    return false;
  }


  if (usageTrackingActive && childContext?.childId === context.childId) {
    return true;
  }



  ensureCurrentDateKey(Date.now());

  childContext = context;
  lastEventTimestamp = Date.now() - 5 * 60 * 1000;

  try {
    const hasPermission = await AppUsageModule.hasUsageAccessPermission();
    if (!hasPermission) {
      AppUsageModule.openUsageAccessSettings();
      return false;
    }
  } catch (error) {
    console.warn('Unable to verify usage access permission', error);
  }

  await pollUsageStats();
  if (pollingIntervalId) {
    BackgroundTimer.clearInterval(pollingIntervalId);
  }
  pollingIntervalId = BackgroundTimer.setInterval(pollUsageStats, 30_000);

  usageTrackingActive = true;


  console.log('📱 App usage tracking started');
  return true;
};

export const stopAppUsageTracking = () => {

  const wasTracking = usageTrackingActive || Boolean(pollingIntervalId);


  if (pollingIntervalId) {
    BackgroundTimer.clearInterval(pollingIntervalId);
    pollingIntervalId = null;
  }
  childContext = null;
  activeSessions.clear();
  activeApp = null;
  usageTotals.clear();
  recentSessions.length = 0;
  currentDateKey = null;
  notifyListeners();

  usageTrackingActive = false;
  if (wasTracking) {
    console.log('📱 App usage tracking stopped');
  }

  console.log('📱 App usage tracking stopped');

};

export const subscribeToLocalUsageState = (callback) => {
  if (typeof callback !== 'function') {
    return () => {};
  }
  listeners.add(callback);
  try {
    callback(buildSnapshot());
  } catch (error) {
    console.warn('AppUsageService listener callback error', error);
  }
  return () => {
    listeners.delete(callback);
  };
};

export const setUsageTimezone = (timeZone) => {
  if (!timeZone || typeof timeZone !== 'string') {
    return;
  }
  if (usageTimezone === timeZone) {
    return;
  }
  usageTimezone = timeZone;
  zonedFormatter = createFormatter(usageTimezone);
  ensureCurrentDateKey(Date.now());
};

export const refreshForegroundApp = async () => {
  if (!AppUsageModule || !isAndroid) {
    return null;
  }
  try {
    const result = await AppUsageModule.getCurrentForegroundApp();
    if (result) {
      activeApp = {
        packageName: result.packageName,
        appName: result.appName,
        since: result.since,
        timestamp: Date.now(),
      };
      notifyListeners();
    }
    return result;
  } catch (error) {
    console.warn('Failed to refresh foreground app', error);
    return null;
  }
};
