import { db } from '../config/firebase';

const defaultState = {
  meta: {
    globalDailyLimitMillis: null,
    graceMillis: 0,
    timezone: null,
  },
  apps: {},
};

const toNumberOrNull = (value) => {
  if (value === null || value === undefined) {
    return null;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const buildBasePath = (familyId, childId) =>
  `families/${familyId}/children/${childId}`;

export const subscribeToAppControls = (familyId, childId, callback) => {
  if (!familyId || !childId) {
    console.warn('subscribeToAppControls missing identifiers', { familyId, childId });
    return () => {};
  }

  const basePath = buildBasePath(familyId, childId);
  const appControlsCollectionRef = db.collection(`${basePath}/appControls`);

  let state = { ...defaultState };

  const emit = () => {
    callback?.(state);
  };

  const unsubscribe = appControlsCollectionRef.onSnapshot(
    (snapshot) => {
      const nextState = {
        ...defaultState,
        apps: {},
      };

      snapshot.forEach((doc) => {
        const data = doc.data() || {};
        if (doc.id === 'meta') {
          nextState.meta = {
            globalDailyLimitMillis: toNumberOrNull(data.globalDailyLimitMillis),
            graceMillis: toNumberOrNull(data.graceMillis) || 0,
            timezone: data.timezone || null,
          };
        } else {
          nextState.apps[doc.id] = {
            blocked: Boolean(data.blocked),
            dailyLimitMillis: toNumberOrNull(data.dailyLimitMillis),
          };
        }
      });

      state = nextState;
      emit();
    },
    (error) => {
      console.error('Failed to load app controls', error);
    },
  );

  return () => {
    unsubscribe?.();
  };
};

export const getAppControlsOnce = async (familyId, childId) => {
  const basePath = buildBasePath(familyId, childId);
  const collectionSnapshot = await db.collection(`${basePath}/appControls`).get();

  const state = {
    meta: { ...defaultState.meta },
    apps: {},
  };

  collectionSnapshot.forEach((doc) => {
    const data = doc.data() || {};
    if (doc.id === 'meta') {
      state.meta = {
        globalDailyLimitMillis: toNumberOrNull(data.globalDailyLimitMillis),
        graceMillis: toNumberOrNull(data.graceMillis) || 0,
        timezone: data.timezone || null,
      };
    } else {
      state.apps[doc.id] = {
        blocked: Boolean(data.blocked),
        dailyLimitMillis: toNumberOrNull(data.dailyLimitMillis),
      };
    }
  });

  return state;
};


export const setAppBlocked = async (familyId, childId, packageName, blocked) => {
  if (!familyId || !childId || !packageName) {
    throw new Error('Missing required parameters: familyId, childId, packageName');
  }

  const basePath = buildBasePath(familyId, childId);
  const appControlRef = db.collection(`${basePath}/appControls`).doc(packageName);

  try {
    await appControlRef.set(
      {
        blocked: Boolean(blocked),
      },
      { merge: true },
    );
    console.log(`✅ App ${blocked ? 'blocked' : 'unblocked'}:`, packageName);
    return true;
  } catch (error) {
    console.error('Failed to update app blocked status', error);
    throw error;
  }
};

export const setAppDailyLimit = async (familyId, childId, packageName, dailyLimitMillis) => {
  if (!familyId || !childId || !packageName) {
    throw new Error('Missing required parameters: familyId, childId, packageName');
  }

  const basePath = buildBasePath(familyId, childId);
  const appControlRef = db.collection(`${basePath}/appControls`).doc(packageName);

  try {
    const update = {};
    if (dailyLimitMillis !== null && dailyLimitMillis !== undefined) {
      update.dailyLimitMillis = Number(dailyLimitMillis);
    } else {
      update.dailyLimitMillis = null;
    }

    await appControlRef.set(update, { merge: true });
    console.log('✅ App daily limit updated:', packageName, dailyLimitMillis);
    return true;
  } catch (error) {
    console.error('Failed to update app daily limit', error);
    throw error;
  }
};

export const removeAppControl = async (familyId, childId, packageName) => {
  if (!familyId || !childId || !packageName) {
    throw new Error('Missing required parameters: familyId, childId, packageName');
  }

  const basePath = buildBasePath(familyId, childId);
  const appControlRef = db.collection(`${basePath}/appControls`).doc(packageName);

  try {
    await appControlRef.delete();
    console.log('✅ App control removed:', packageName);
    return true;
  } catch (error) {
    console.error('Failed to remove app control', error);
    throw error;
  }
};


