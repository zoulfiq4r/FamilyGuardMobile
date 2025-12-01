import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import SplashScreen from './src/screens/SplashScreen';
import PairingScreen from './src/screens/PairingScreen';
import HomeScreen from './src/screens/HomeScreen';
import SettingsScreen from './src/screens/SettingsScreen';
import PermissionRequestScreen from './src/screens/PermissionRequestScreen';
import ProfileScreen from './src/screens/ProfileScreen';
import AboutScreen from './src/screens/AboutScreen';
import BlockAppsScreen from './src/screens/BlockAppsScreen';

import { testFirebaseConnection } from './src/config/firebase';
import auth from '@react-native-firebase/auth';
import { startLocationTracking, stopLocationTracking } from './src/services/locationService';
import { refreshForegroundApp, startAppUsageTracking, stopAppUsageTracking } from './src/services/appUsageService';
import { fetchExistingDevicePairing } from './src/services/pairingService';
import {
  getBlockerPermissionsStatus,
  openAccessibilitySettings,
  requestIgnoreBatteryOptimizations,
  requestOverlayPermission,
  startAppEnforcement,
  stopAppEnforcement,
} from './src/services/appEnforcementService';
import {
  clearStoredChildContext,
  loadStoredChildContext,
  persistChildContext,
} from './src/services/storageService';

type Screen =
  | 'splash'
  | 'pairing'
  | 'home'
  | 'settings'
  | 'permissions'
  | 'profile'
  | 'about'
  | 'blockApps';

type ChildContext = {
  childId: string;
  parentId?: string;
  childName?: string;
};

type PermissionState = {
  location: boolean;
  usage: boolean;
  accessibility: boolean;
  overlay: boolean;
  batteryOptimization: boolean;
};

const SPLASH_DELAY_MS = 2000;
const delay = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

function App() {
  const [currentScreen, setCurrentScreen] = useState<Screen>('splash');
  const [childContext, setChildContext] = useState<ChildContext | null>(null);
  const [permissionState, setPermissionState] = useState<PermissionState>({
    location: false,
    usage: false,
    accessibility: false,
    overlay: false,
    batteryOptimization: false,
  });
  const [authReady, setAuthReady] = useState(false);

  // Authenticate (anonymous) first, then test connection (after auth).
  useEffect(() => {
    let cancelled = false;
    const init = async () => {
      try {
        const instance = auth();
        if (!instance.currentUser) {
          await instance.signInAnonymously();
          if (!cancelled) {
            console.log('🔐 Anonymous Firebase auth established');
          }
        } else if (!cancelled) {
          console.log('🔐 Firebase user already signed in');
        }
      } catch (error) {
        console.error('❌ Anonymous auth failed (provider disabled?):', error);
      } finally {
        if (!cancelled) {
          setAuthReady(true);
          // Connection test after auth; ignore permission issues silently here.
          testFirebaseConnection();
        }
      }
    };
    init();
    return () => {
      cancelled = true;
    };
  }, []);

  const refreshBlockerPermissions = useCallback(async () => {
    try {
      const status = await getBlockerPermissionsStatus();
      setPermissionState((prev) => ({
        ...prev,
        accessibility: Boolean(status?.accessibility),
        overlay: Boolean(status?.overlay),
        batteryOptimization: Boolean(status?.batteryOptimization),
      }));
      return status;
    } catch (error) {
      console.warn('Failed to refresh blocker permissions', error);
      return null;
    }
  }, []);

  const refreshUsageTracking = useCallback(async () => {
    if (!childContext) {
      return false;
    }
    const usageGranted = await startAppUsageTracking(childContext);
    setPermissionState((prev) => ({
      ...prev,
      usage: usageGranted,
    }));
    if (usageGranted) {
      refreshForegroundApp().catch(() => {});
    }
    return usageGranted;
  }, [childContext]);

  useEffect(() => {
    if (currentScreen !== 'permissions') {
      return;
    }
    refreshBlockerPermissions();
  }, [currentScreen, refreshBlockerPermissions]);

  useEffect(() => {
    return () => {
      stopLocationTracking();
      stopAppUsageTracking();
      stopAppEnforcement();
    };
  }, []);

  useEffect(() => {
    if (!authReady || !childContext?.childId) {
      stopAppEnforcement();
      return undefined;
    }

    startAppEnforcement({
      childId: childContext.childId,
      parentId: childContext.parentId,
      familyId: childContext.parentId,
    });

    refreshBlockerPermissions();

    return () => {
      stopAppEnforcement();
    };
  }, [childContext, refreshBlockerPermissions, authReady]);

  const handlePaired = useCallback(
    async (result: { success: boolean; childId?: string; parentId?: string; childName?: string }) => {
      if (!result.success || !result.childId) {
        setCurrentScreen('home');
        return;
      }

      const context: ChildContext = {
        childId: result.childId,
        parentId: result.parentId,
        childName: result.childName,
      };

      setChildContext(context);
      await persistChildContext(context);

      try {
        console.log('🚀 Starting location tracking for child:', result.childId);
        const locationGranted = await startLocationTracking(result.childId);
        const usageGranted = await startAppUsageTracking(context);

        setPermissionState((prev) => ({
          ...prev,
          location: locationGranted,
          usage: usageGranted,
        }));

        refreshBlockerPermissions();

        if (usageGranted) {
          refreshForegroundApp().catch(() => {});
        }

        if (!locationGranted) {
          console.log('⚠️ Location permission missing, showing permissions screen');
          setCurrentScreen('permissions');
          return;
        }

        if (!usageGranted) {
          console.log('⚠️ Usage access missing, continuing to home but prompting user');
        }

        setCurrentScreen('home');
      } catch (error) {
        console.error('Failed to start tracking:', error);
        setPermissionState((prev) => ({
          ...prev,
          location: false,
          usage: false,
        }));
        refreshBlockerPermissions();
        setCurrentScreen('permissions');
      }
    },
    [refreshBlockerPermissions],
  );

  useEffect(() => {
    if (!authReady) {
      return;
    }
    let isActive = true;

    const restorePairingState = async () => {
      await delay(SPLASH_DELAY_MS);

      if (!isActive) {
        return;
      }

      try {
        const storedContext = await loadStoredChildContext();

        if (!isActive) {
          return;
        }

        if (storedContext?.childId) {
          await handlePaired({
            success: true,
            childId: storedContext.childId,
            parentId: storedContext.parentId,
            childName: storedContext.childName,
          });
          return;
        }

        const restoredContext = await fetchExistingDevicePairing();

        if (!isActive) {
          return;
        }

        if (restoredContext?.childId) {
          await handlePaired({
            success: true,
            childId: restoredContext.childId,
            parentId: restoredContext.parentId,
            childName: restoredContext.childName,
          });
          return;
        }

        setCurrentScreen('pairing');
      } catch (error) {
        console.warn('Failed to restore pairing data', error);
        if (isActive) {
          setCurrentScreen('pairing');
        }
      }
    };

    restorePairingState();

    return () => {
      isActive = false;
    };
  }, [handlePaired, authReady]);

  const handleNavigateToSettings = useCallback(() => {
    setCurrentScreen('settings');
  }, []);

  const handleNavigateToPermissions = useCallback(() => {
    setCurrentScreen('permissions');
  }, []);

  const allCriticalPermissionsGranted = useMemo(
    () =>
      permissionState.location &&
      permissionState.usage &&
      permissionState.accessibility &&
      permissionState.overlay,
    [
      permissionState.accessibility,
      permissionState.location,
      permissionState.overlay,
      permissionState.usage,
    ],
  );

  const handleBack = useCallback(() => {
    if (currentScreen === 'blockApps' || currentScreen === 'profile' || currentScreen === 'about') {
      setCurrentScreen('settings');
      return;
    }

    if (currentScreen === 'permissions') {
      setCurrentScreen(allCriticalPermissionsGranted ? 'home' : childContext ? 'home' : 'pairing');
      return;
    }

    if (currentScreen === 'settings') {
      setCurrentScreen(childContext ? 'home' : 'pairing');
      return;
    }

    if (currentScreen === 'home' && !childContext) {
      setCurrentScreen('pairing');
      return;
    }

    setCurrentScreen(childContext ? 'home' : 'pairing');
  }, [allCriticalPermissionsGranted, childContext, currentScreen]);

  const handleLogout = useCallback(() => {
    stopLocationTracking();
    stopAppUsageTracking();
    stopAppEnforcement();

    clearStoredChildContext();

    setChildContext(null);
    setPermissionState({
      location: false,
      usage: false,
      accessibility: false,
      overlay: false,
      batteryOptimization: false,
    });
    setCurrentScreen('pairing');
  }, []);

  const handlePermissionsCheck = useCallback(async () => {
    let locationGranted = permissionState.location;
    if (childContext?.childId && !permissionState.location) {
      try {
        locationGranted = await startLocationTracking(childContext.childId);
      } catch (error) {
        console.error('Failed to refresh location tracking', error);
      }
    }

    const usageGranted = await refreshUsageTracking();
    const blockerStatus = await refreshBlockerPermissions();

    const mergedPermissions = {
      location: locationGranted,
      usage: Boolean(usageGranted),
      accessibility: blockerStatus?.accessibility ?? permissionState.accessibility ?? false,
      overlay: blockerStatus?.overlay ?? permissionState.overlay ?? false,
      batteryOptimization:
        blockerStatus?.batteryOptimization ?? permissionState.batteryOptimization ?? false,
    };

    setPermissionState((prev) => ({
      ...prev,
      ...mergedPermissions,
    }));

    if (
      mergedPermissions.location &&
      mergedPermissions.usage &&
      mergedPermissions.accessibility &&
      mergedPermissions.overlay
    ) {
      setCurrentScreen('home');
    }
  }, [
    childContext,
    permissionState.accessibility,
    permissionState.batteryOptimization,
    permissionState.location,
    permissionState.overlay,
    refreshBlockerPermissions,
    refreshUsageTracking,
  ]);

  const handleRequestUsageAccess = useCallback(() => {
    if (!childContext?.childId) {
      console.log('Pairing required before requesting usage access permission.');
      return;
    }
    refreshUsageTracking();
  }, [childContext, refreshUsageTracking]);

  const handleRequestAccessibility = useCallback(() => {
    openAccessibilitySettings();
  }, []);

  const handleRequestOverlayPermission = useCallback(() => {
    requestOverlayPermission();
  }, []);

  const handleRequestBatteryOptimization = useCallback(() => {
    requestIgnoreBatteryOptimizations();
  }, []);

  const handleRequestLocationPermission = useCallback(async () => {
    if (!childContext?.childId) {
      return;
    }
    try {
      const granted = await startLocationTracking(childContext.childId);
      setPermissionState((prev) => ({
        ...prev,
        location: granted,
      }));
    } catch (error) {
      console.error('Failed to request location permission', error);
    }
  }, [childContext]);

  return (
    <SafeAreaProvider>
      {currentScreen === 'splash' && <SplashScreen />}
      {currentScreen === 'pairing' && <PairingScreen onPaired={handlePaired} />}
      {currentScreen === 'home' && (
        <HomeScreen
          onNavigateToSettings={handleNavigateToSettings}
          childContext={childContext}
          permissionState={permissionState}
        />
      )}
      {currentScreen === 'settings' && (
        <SettingsScreen
          onBack={handleBack}
          onNavigateToPermissions={handleNavigateToPermissions}
          onNavigateToProfile={() => setCurrentScreen('profile')}
          onNavigateToAbout={() => setCurrentScreen('about')}
          onNavigateToBlockApps={() => setCurrentScreen('blockApps')}
          onLogout={handleLogout}
        />
      )}
      {currentScreen === 'permissions' && (
        <PermissionRequestScreen
          onBack={handleBack}
          onResolvePermissions={handlePermissionsCheck}
          permissionState={permissionState}
          onRequestUsageAccess={handleRequestUsageAccess}
          onRequestAccessibility={handleRequestAccessibility}
          onRequestOverlay={handleRequestOverlayPermission}
          onRequestBatteryOptimization={handleRequestBatteryOptimization}
          onRequestLocation={handleRequestLocationPermission}
        />
      )}
      {currentScreen === 'profile' && <ProfileScreen onBack={handleBack} />}
      {currentScreen === 'about' && <AboutScreen onBack={handleBack} />}
      {currentScreen === 'blockApps' && (
        <BlockAppsScreen onBack={handleBack} childContext={childContext} />
      )}
    </SafeAreaProvider>
  );
}

export default App;
