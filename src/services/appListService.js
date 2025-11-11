import { collections } from '../config/firebase';
import { subscribeToLocalUsageState } from './appUsageService';

const buildAppStatus = (data = {}) => {
  const status = data.status || {};
  const fromStatus = typeof status.isBlocked === 'boolean' ? status.isBlocked : null;
  return {
    isBlocked: fromStatus !== null ? fromStatus : Boolean(data.isBlocked),
    message: status.message || data.blockMessage || null,
    reason: status.reason || data.blockReason || null,
  };
};

/**
 * Get list of apps from the child's apps collection in Firestore
 * @param {string} childId - The child ID
 * @returns {Promise<Array>} Array of app objects with packageName, appName, etc.
 */
export const getChildApps = async (childId) => {
  if (!childId) {
    return [];
  }

  try {
    const appsSnapshot = await collections.children
      .doc(childId)
      .collection('apps')
      .get();

    const apps = [];
    appsSnapshot.forEach((doc) => {
      const data = doc.data() || {};
      const status = buildAppStatus(data);
      apps.push({
        packageName: doc.id,
        appName: data.name || data.appName || doc.id,
        usageMinutes: data.usageMinutes || 0,
        isBlocked: status.isBlocked,
        status,
        updatedAt: data.updatedAt?.toDate?.()?.getTime?.() || null,
      });
    });

    return apps.sort((a, b) => {
      // Sort by app name
      return a.appName.localeCompare(b.appName);
    });
  } catch (error) {
    console.error('Failed to get child apps', error);
    return [];
  }
};

/**
 * Subscribe to child apps collection
 * @param {string} childId - The child ID
 * @param {Function} callback - Callback function that receives apps array
 * @returns {Function} Unsubscribe function
 */
export const subscribeToChildApps = (childId, callback) => {
  if (!childId) {
    return () => {};
  }

  const unsubscribe = collections.children
    .doc(childId)
    .collection('apps')
    .onSnapshot(
      (snapshot) => {
        const apps = [];
        snapshot.forEach((doc) => {
          const data = doc.data() || {};
          const status = buildAppStatus(data);
          apps.push({
            packageName: doc.id,
            appName: data.name || data.appName || doc.id,
            usageMinutes: data.usageMinutes || 0,
            isBlocked: status.isBlocked,
            status,
            updatedAt: data.updatedAt?.toDate?.()?.getTime?.() || null,
          });
        });

        apps.sort((a, b) => a.appName.localeCompare(b.appName));
        callback?.(apps);
      },
      (error) => {
        console.error('Failed to listen to child apps', error);
      },
    );

  return unsubscribe;
};

/**
 * Get apps from local usage state (apps that have been used)
 * @returns {Promise<Array>} Array of app objects from local usage
 */
export const getAppsFromLocalUsage = () =>
  new Promise((resolve) => {
    let cleanup = null;
    let shouldCleanup = false;
    const runCleanup = () => {
      if (typeof cleanup === 'function') {
        cleanup();
      } else {
        shouldCleanup = true;
      }
    };

    const unsubscribe = subscribeToLocalUsageState((snapshot) => {
      const apps = (snapshot?.totals || []).map((app) => ({
        packageName: app.packageName,
        appName: app.appName || app.packageName,
        durationMs: app.durationMs || 0,
        sessions: app.sessions || 0,
        lastUsed: app.lastUsed || null,
      }));

      runCleanup();
      resolve(apps);
    });

    cleanup = typeof unsubscribe === 'function' ? unsubscribe : null;
    if (shouldCleanup) {
      cleanup?.();
    }
  });

