import { collections } from '../config/firebase';

const toDateKey = (date) => {
  const target = typeof date === 'number' ? new Date(date) : date;
  const year = target.getFullYear();
  const month = String(target.getMonth() + 1).padStart(2, '0');
  const day = String(target.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const sortHourBuckets = (hours = {}) => {
  return Object.entries(hours)
    .map(([hour, durationMs]) => ({
      hour,
      durationMs,
    }))
    .sort((a, b) => {
      const hourA = parseInt(a.hour, 10);
      const hourB = parseInt(b.hour, 10);
      return hourA - hourB;
    });
};

const mapAppTotals = (apps = {}) => {
  return Object.entries(apps)
    .map(([packageName, value]) => ({
      packageName,
      appName: value.appName || packageName,
      durationMs: value.durationMs || 0,
      sessions: value.sessions || 0,
      lastUsed: value.lastUsed || 0,
    }))
    .sort((a, b) => b.durationMs - a.durationMs);
};

export const listenToDailyUsageAggregate = (childId, dateKey, callback) => {
  if (!childId || !dateKey) {
    return () => {};
  }
  const docRef = collections.appUsageAggregates.doc(`${childId}_${dateKey}`);
  return docRef.onSnapshot(
    (snapshot) => {
      if (!snapshot.exists) {
        callback?.({
          totalDurationMs: 0,
          apps: [],
          hours: [],
          updatedAt: null,
        });
        return;
      }

      const data = snapshot.data() || {};

      const data = snapshot.data();

      callback?.({
        totalDurationMs: data.totalDurationMs || 0,
        apps: mapAppTotals(data.apps),
        hours: sortHourBuckets(data.hours),
        updatedAt:
          data.lastUpdated?.toDate?.()?.getTime?.() ||
          data.lastUpdated?.toMillis?.() ||
          null,
      });
    },
    (error) => {
      console.error('Failed to listen to daily usage aggregate', error);
    },
  );
};

export const listenToRecentSessions = (childId, dateKey, limit = 20, callback) => {
  if (!childId || !dateKey) {
    return () => {};
  }
  const query = collections.appUsageSessions
    .where('childId', '==', childId)
    .where('dateKey', '==', dateKey)
    .orderBy('endTime', 'desc')
    .limit(limit);

  return query.onSnapshot(
    (snapshot) => {
      const sessions = [];
      snapshot.forEach((doc) => {
        const data = doc.data();
        sessions.push({
          id: doc.id,
          packageName: data.packageName,
          appName: data.appName,
          durationMs: data.durationMs,
          startTime: data.startTime?.toDate?.() || null,
          endTime: data.endTime?.toDate?.() || null,
        });
      });
      callback?.(sessions);
    },
    (error) => {
      console.error('Failed to listen to recent sessions', error);
    },
  );
};

export const fetchUsageWindowSummary = async (childId, days) => {
  if (!childId || !days) {
    return {
      totalDurationMs: 0,
      averagePerDayMs: 0,
      days: [],
    };
  }

  const endDate = new Date();
  const startDate = new Date();
  startDate.setDate(endDate.getDate() - (days - 1));
  const endKey = toDateKey(endDate);
  const startKey = toDateKey(startDate);

  try {
    const snapshot = await collections.appUsageAggregates
      .where('childId', '==', childId)
      .where('dateKey', '>=', startKey)
      .where('dateKey', '<=', endKey)
      .orderBy('dateKey', 'desc')
      .get();

    const result = [];
    let totalDurationMs = 0;
    snapshot.forEach((doc) => {
      const data = doc.data();
      const duration = data.totalDurationMs || 0;
      totalDurationMs += duration;
      result.push({
        id: doc.id,
        dateKey: data.dateKey,
        totalDurationMs: duration,
      });
    });

    return {
      totalDurationMs,
      averagePerDayMs: totalDurationMs / Math.max(days, 1),
      days: result,
    };
  } catch (error) {
    console.error('Failed to fetch usage window summary', error);
    return {
      totalDurationMs: 0,
      averagePerDayMs: 0,
      days: [],
      error,
    };
  }
};

export const listenToDeviceCurrentApp = (deviceId, callback) => {
  if (!deviceId) {
    return () => {};
  }
  return collections.devices.doc(deviceId).onSnapshot(
    (snapshot) => {
      if (!snapshot.exists) {
        callback?.(null);
        return;
      }
      const data = snapshot.data();
      const currentApp = data.currentApp;
      if (!currentApp) {
        callback?.(null);
        return;
      }
      callback?.({
        packageName: currentApp.packageName,
        appName: currentApp.appName || currentApp.packageName,
        since:
          currentApp.since?.toDate?.()?.getTime?.() ||
          currentApp.since?.toMillis?.() ||
          null,
        updatedAt:
          currentApp.updatedAt?.toDate?.()?.getTime?.() ||
          currentApp.updatedAt?.toMillis?.() ||
          null,
      });
    },
    (error) => {
      console.error('Failed to listen to current app', error);
    },
  );
};

export { toDateKey };
