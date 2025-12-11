import { addDoc, collection, doc, getDocs, limit as limitQuery, orderBy, query, updateDoc, where } from '@react-native-firebase/firestore';
import { collections, serverTimestamp } from '../config/firebase';
import { uploadScreenshot } from './screenshotStorageService';

/**
 * Create a new content alert in Firestore
 * @param {object} alertData - Alert data including childId, appName, riskLevel, safeSearchScores
 * @returns {Promise<string>} - Document ID of created alert
 */
export const createContentAlert = async (alertData) => {
  try {
    const {
      childId,
      parentId,
      appName,
      packageName,
      riskLevel,
      safeSearchScores,
      base64Screenshot = null,
      timestamp,
    } = alertData;

    if (!childId || !appName || !riskLevel || !safeSearchScores) {
      throw new Error('Missing required fields for content alert');
    }

    let screenshotUrl = null;

    // Upload screenshot to Cloud Storage if provided
    if (base64Screenshot) {
      try {
        screenshotUrl = await uploadScreenshot(base64Screenshot, childId, packageName, timestamp);
      } catch (error) {
        console.warn('⚠️  Failed to upload screenshot, continuing without it:', error.message);
        // Don't throw - continue creating alert without screenshot
      }
    }

    const alertDoc = {
      childId,
      parentId: parentId || null,
      appName,
      packageName: packageName || null,
      riskLevel, // 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'
      safeSearchScores: {
        adult: safeSearchScores.adult || 'UNKNOWN',
        violence: safeSearchScores.violence || 'UNKNOWN',
        racy: safeSearchScores.racy || 'UNKNOWN',
        medical: safeSearchScores.medical || 'UNKNOWN',
        spoof: safeSearchScores.spoof || 'UNKNOWN',
      },
      screenshotUrl,
      reviewed: false,
      createdAt: serverTimestamp(),
      capturedAt: timestamp || Date.now(),
    };

    const docRef = await addDoc(collections.contentAlerts || collection(collections.firestore, 'contentAlerts'), alertDoc);

    console.log(`🚨 Content alert created: ${docRef.id} (${riskLevel} risk - ${appName})`);

    return docRef.id;
  } catch (error) {
    console.error('❌ Failed to create content alert:', error);
    throw error;
  }
};

/**
 * Mark a content alert as reviewed
 * @param {string} alertId - Alert document ID
 * @returns {Promise<void>}
 */
export const markAlertAsReviewed = async (alertId) => {
  try {
    const alertRef = doc(collections.contentAlerts || collection(collections.firestore, 'contentAlerts'), alertId);
    await updateDoc(alertRef, {
      reviewed: true,
      reviewedAt: serverTimestamp(),
    });

    console.log(`✅ Content alert marked as reviewed: ${alertId}`);
  } catch (error) {
    console.error('Failed to mark alert as reviewed', error);
    throw error;
  }
};

/**
 * Get unreviewed alerts for a child
 * @param {string} childId - Child ID
 * @param {number} limitCount - Max number of alerts to fetch
 * @returns {Promise<Array>}
 */
export const getUnreviewedAlerts = async (childId, limitCount = 20) => {
  try {
    const alertsQuery = query(
      collections.contentAlerts || collection(collections.firestore, 'contentAlerts'),
      where('childId', '==', childId),
      where('reviewed', '==', false),
      orderBy('createdAt', 'desc'),
      limitQuery(limitCount),
    );

    const snapshot = await getDocs(alertsQuery);
    const alerts = [];

    snapshot.forEach((doc) => {
      alerts.push({
        id: doc.id,
        ...doc.data(),
      });
    });

    return alerts;
  } catch (error) {
    console.error('Failed to fetch unreviewed alerts', error);
    return [];
  }
};

/**
 * Get recent alerts for a child (reviewed and unreviewed)
 * @param {string} childId - Child ID
 * @param {number} limitCount - Max number of alerts to fetch
 * @returns {Promise<Array>}
 */
export const getRecentAlerts = async (childId, limitCount = 50) => {
  try {
    const alertsQuery = query(
      collections.contentAlerts || collection(collections.firestore, 'contentAlerts'),
      where('childId', '==', childId),
      orderBy('createdAt', 'desc'),
      limitQuery(limitCount),
    );

    const snapshot = await getDocs(alertsQuery);
    const alerts = [];

    snapshot.forEach((doc) => {
      alerts.push({
        id: doc.id,
        ...doc.data(),
      });
    });

    return alerts;
  } catch (error) {
    console.error('Failed to fetch recent alerts', error);
    return [];
  }
};

/**
 * Get alerts by risk level
 * @param {string} childId - Child ID
 * @param {string} riskLevel - 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'
 * @param {number} limitCount - Max number of alerts to fetch
 * @returns {Promise<Array>}
 */
export const getAlertsByRiskLevel = async (childId, riskLevel, limitCount = 20) => {
  try {
    const alertsQuery = query(
      collections.contentAlerts || collection(collections.firestore, 'contentAlerts'),
      where('childId', '==', childId),
      where('riskLevel', '==', riskLevel),
      orderBy('createdAt', 'desc'),
      limitQuery(limitCount),
    );

    const snapshot = await getDocs(alertsQuery);
    const alerts = [];

    snapshot.forEach((doc) => {
      alerts.push({
        id: doc.id,
        ...doc.data(),
      });
    });

    return alerts;
  } catch (error) {
    console.error(`Failed to fetch ${riskLevel} alerts`, error);
    return [];
  }
};

/**
 * Get alert statistics for a child
 * @param {string} childId - Child ID
 * @returns {Promise<{total: number, unreviewed: number, byRiskLevel: object}>}
 */
export const getAlertStats = async (childId) => {
  try {
    const alertsQuery = query(
      collections.contentAlerts || collection(collections.firestore, 'contentAlerts'),
      where('childId', '==', childId),
    );

    const snapshot = await getDocs(alertsQuery);
    
    const stats = {
      total: 0,
      unreviewed: 0,
      byRiskLevel: {
        LOW: 0,
        MEDIUM: 0,
        HIGH: 0,
        CRITICAL: 0,
      },
    };

    snapshot.forEach((doc) => {
      const data = doc.data();
      stats.total++;
      
      if (!data.reviewed) {
        stats.unreviewed++;
      }

      if (data.riskLevel && stats.byRiskLevel.hasOwnProperty(data.riskLevel)) {
        stats.byRiskLevel[data.riskLevel]++;
      }
    });

    return stats;
  } catch (error) {
    console.error('Failed to fetch alert statistics', error);
    return {
      total: 0,
      unreviewed: 0,
      byRiskLevel: { LOW: 0, MEDIUM: 0, HIGH: 0, CRITICAL: 0 },
    };
  }
};

/**
 * Batch mark multiple alerts as reviewed
 * @param {Array<string>} alertIds - Array of alert document IDs
 * @returns {Promise<void>}
 */
export const markMultipleAlertsAsReviewed = async (alertIds) => {
  try {
    const promises = alertIds.map((alertId) => markAlertAsReviewed(alertId));
    await Promise.all(promises);
    console.log(`✅ Marked ${alertIds.length} alerts as reviewed`);
  } catch (error) {
    console.error('Failed to mark multiple alerts as reviewed', error);
    throw error;
  }
};
