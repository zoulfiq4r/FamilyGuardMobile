import AsyncStorage from '@react-native-async-storage/async-storage';

const CHILD_CONTEXT_KEY = 'familyGuard.childContext';
const APP_VERSION_KEY = 'familyGuard.appVersion';
const CURRENT_APP_VERSION = '1.0.1'; // Increment to force clear

/**
 * Check if this is the first launch after install
 * Clears test data on fresh install
 */
const checkAndClearOnFreshInstall = async () => {
  try {
    const storedVersion = await AsyncStorage.getItem(APP_VERSION_KEY);
    if (storedVersion !== CURRENT_APP_VERSION) {
      // Fresh install or version update - clear test data
      await AsyncStorage.removeItem(CHILD_CONTEXT_KEY);
      await AsyncStorage.setItem(APP_VERSION_KEY, CURRENT_APP_VERSION);
      console.log('🔄 Fresh install detected - cleared test data');
      return true;
    }
    return false;
  } catch (error) {
    console.warn('Failed to check app version', error);
    return false;
  }
};

export const loadStoredChildContext = async () => {
  try {
    // Check for fresh install first
    await checkAndClearOnFreshInstall();
    
    const rawValue = await AsyncStorage.getItem(CHILD_CONTEXT_KEY);
    if (!rawValue) {
      return null;
    }
    const parsedValue = JSON.parse(rawValue);
    if (parsedValue?.childId) {
      return parsedValue;
    }
    return null;
  } catch (error) {
    console.warn('Failed to load child context from storage', error);
    return null;
  }
};

export const persistChildContext = async (context) => {
  try {
    await AsyncStorage.setItem(CHILD_CONTEXT_KEY, JSON.stringify(context));
  } catch (error) {
    console.warn('Failed to persist child context', error);
  }
};

export const clearStoredChildContext = async () => {
  try {
    await AsyncStorage.removeItem(CHILD_CONTEXT_KEY);
  } catch (error) {
    console.warn('Failed to clear child context from storage', error);
  }
};
