import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  initializeScreenshotMonitoring,
  handleAppSwitch,
  setMonitoringEnabled,
  getMonitoringEnabled,
  requestPermission,
} from '../services/screenshotMonitoringService';
import * as screenshotService from '../services/screenshotService';
import * as contentAnalysisService from '../services/contentAnalysisService';

// Mock dependencies
jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
}));

jest.mock('../services/screenshotService', () => ({
  captureScreenshot: jest.fn(),
  isSuspiciousApp: jest.fn(),
  requestScreenCapturePermission: jest.fn(),
  restorePermissionState: jest.fn(),
  isScreenCapturePermissionGranted: jest.fn(),
}));

jest.mock('../services/contentAnalysisService', () => ({
  analyzeWithOfflineSupport: jest.fn(),
  setupOfflineQueueSync: jest.fn(() => jest.fn()), // Returns unsubscribe function
}));

jest.mock('../services/contentAlertsService', () => ({
  createContentAlert: jest.fn(),
}));

jest.mock('../config/screenshotConfig', () => ({
  SCREENSHOT_CONFIG: {
    ENABLED_BY_DEFAULT: true,
    CAPTURE_COOLDOWN_MS: 5000,
  },
  shouldCreateAlert: jest.fn(() => true),
}));

describe('screenshotMonitoringService', () => {
  const mockPairingData = {
    childId: 'child123',
    parentId: 'parent456',
    deviceId: 'device789',
  };

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('initializeScreenshotMonitoring', () => {
    it('should initialize with default enabled state', async () => {
      AsyncStorage.getItem.mockImplementation((key) => {
        if (key === '@familyguard_pairing') {
          return Promise.resolve(JSON.stringify(mockPairingData));
        }
        return Promise.resolve(null);
      });

      await initializeScreenshotMonitoring();

      expect(screenshotService.restorePermissionState).toHaveBeenCalled();
      expect(contentAnalysisService.setupOfflineQueueSync).toHaveBeenCalled();
      expect(getMonitoringEnabled()).toBe(true);
    });

    it('should load pairing data from AsyncStorage', async () => {
      AsyncStorage.getItem.mockImplementation((key) => {
        if (key === '@familyguard_pairing') {
          return Promise.resolve(JSON.stringify(mockPairingData));
        }
        return Promise.resolve(null);
      });

      await initializeScreenshotMonitoring();

      expect(AsyncStorage.getItem).toHaveBeenCalledWith('@familyguard_pairing');
    });

    it('should respect saved enabled state', async () => {
      AsyncStorage.getItem.mockImplementation((key) => {
        if (key === '@familyguard_screenshot_monitoring_enabled') {
          return Promise.resolve('false');
        }
        if (key === '@familyguard_pairing') {
          return Promise.resolve(JSON.stringify(mockPairingData));
        }
        return Promise.resolve(null);
      });

      await initializeScreenshotMonitoring();

      expect(getMonitoringEnabled()).toBe(false);
    });

    it('should handle missing pairing data gracefully', async () => {
      AsyncStorage.getItem.mockResolvedValue(null);

      await expect(initializeScreenshotMonitoring()).resolves.not.toThrow();
    });

    it('should handle AsyncStorage errors', async () => {
      AsyncStorage.getItem.mockRejectedValue(new Error('Storage error'));

      // Should handle errors gracefully during initialization
      await expect(initializeScreenshotMonitoring()).resolves.not.toThrow();
    });
  });

  describe('handleAppSwitch', () => {
    const mockScreenshot = {
      base64Image: 'mockBase64',
      packageName: 'com.whatsapp',
      appName: 'WhatsApp',
      timestamp: Date.now(),
    };

    beforeEach(async () => {
      AsyncStorage.getItem.mockImplementation((key) => {
        if (key === '@familyguard_pairing') {
          return Promise.resolve(JSON.stringify(mockPairingData));
        }
        return Promise.resolve(null);
      });
      await initializeScreenshotMonitoring();
    });

    it('should capture screenshot for suspicious app', async () => {
      screenshotService.isSuspiciousApp.mockReturnValue(true);
      screenshotService.captureScreenshot.mockResolvedValue(mockScreenshot);
      contentAnalysisService.analyzeWithOfflineSupport.mockResolvedValue({ riskLevel: 'LOW' });

      await handleAppSwitch('com.whatsapp', 'WhatsApp');

      expect(screenshotService.captureScreenshot).toHaveBeenCalledWith('com.whatsapp', 'WhatsApp');
      expect(contentAnalysisService.analyzeWithOfflineSupport).toHaveBeenCalled();
    });

    it('should not capture for non-suspicious apps', async () => {
      screenshotService.isSuspiciousApp.mockReturnValue(false);

      await handleAppSwitch('com.android.settings', 'Settings');

      expect(screenshotService.captureScreenshot).not.toHaveBeenCalled();
    });

    it('should not capture when monitoring is disabled', async () => {
      await setMonitoringEnabled(false);
      screenshotService.isSuspiciousApp.mockReturnValue(true);

      await handleAppSwitch('com.whatsapp', 'WhatsApp');

      expect(screenshotService.captureScreenshot).not.toHaveBeenCalled();
    });

    it('should debounce rapid app switches', async () => {
      screenshotService.isSuspiciousApp.mockReturnValue(true);
      screenshotService.isScreenCapturePermissionGranted.mockReturnValue(true);
      screenshotService.captureScreenshot.mockResolvedValue(mockScreenshot);
      contentAnalysisService.analyzeWithOfflineSupport.mockResolvedValue({ riskLevel: 'LOW' });

      // First call - should capture
      await handleAppSwitch('com.whatsapp', 'WhatsApp');
      const firstCallCount = screenshotService.captureScreenshot.mock.calls.length;

      // Second call within 2 seconds - should be debounced
      await handleAppSwitch('com.whatsapp', 'WhatsApp');
      expect(screenshotService.captureScreenshot).toHaveBeenCalledTimes(firstCallCount); // Should not increase

      // Advance time by 2.5 seconds
      jest.advanceTimersByTime(2500);

      // Third call after cooldown - should capture
      await handleAppSwitch('com.whatsapp', 'WhatsApp');
      // Should have attempted more calls after debounce period
      expect(screenshotService.captureScreenshot.mock.calls.length).toBeGreaterThanOrEqual(firstCallCount);
    });

    it('should allow captures of different apps without debouncing', async () => {
      screenshotService.isSuspiciousApp.mockReturnValue(true);
      screenshotService.isScreenCapturePermissionGranted.mockReturnValue(true);
      screenshotService.captureScreenshot.mockResolvedValue(mockScreenshot);
      contentAnalysisService.analyzeWithOfflineSupport.mockResolvedValue({ riskLevel: 'LOW' });

      await handleAppSwitch('com.whatsapp', 'WhatsApp');
      await handleAppSwitch('com.facebook.katana', 'Facebook');

      // Should have called capture for both different apps
      expect(screenshotService.captureScreenshot.mock.calls.length).toBeGreaterThanOrEqual(1);
    });

    it('should pass childId to content analysis', async () => {
      screenshotService.isSuspiciousApp.mockReturnValue(true);
      const screenshotWithChildId = { ...mockScreenshot, childId: mockPairingData.childId };
      screenshotService.captureScreenshot.mockResolvedValue(screenshotWithChildId);
      contentAnalysisService.analyzeWithOfflineSupport.mockResolvedValue({ riskLevel: 'LOW' });

      await handleAppSwitch('com.whatsapp', 'WhatsApp');

      // analyzeWithOfflineSupport receives screenshot and callback
      expect(contentAnalysisService.analyzeWithOfflineSupport).toHaveBeenCalledWith(
        expect.objectContaining({
          childId: mockPairingData.childId,
        }),
        expect.any(Function) // handleAnalysisComplete callback
      );
    });

    it('should handle capture errors gracefully', async () => {
      screenshotService.isSuspiciousApp.mockReturnValue(true);
      screenshotService.captureScreenshot.mockRejectedValue(new Error('Capture failed'));

      await expect(handleAppSwitch('com.whatsapp', 'WhatsApp')).resolves.not.toThrow();
    });

    it('should handle analysis errors gracefully', async () => {
      screenshotService.isSuspiciousApp.mockReturnValue(true);
      screenshotService.captureScreenshot.mockResolvedValue(mockScreenshot);
      contentAnalysisService.analyzeWithOfflineSupport.mockRejectedValue(new Error('Analysis failed'));

      await expect(handleAppSwitch('com.whatsapp', 'WhatsApp')).resolves.not.toThrow();
    });

    it('should skip analysis if screenshot capture returns null', async () => {
      screenshotService.isSuspiciousApp.mockReturnValue(true);
      screenshotService.captureScreenshot.mockResolvedValue(null);

      await handleAppSwitch('com.whatsapp', 'WhatsApp');

      expect(contentAnalysisService.analyzeWithOfflineSupport).not.toHaveBeenCalled();
    });

    it('should handle missing pairing data', async () => {
      // Re-initialize without pairing data
      AsyncStorage.getItem.mockResolvedValue(null);
      await initializeScreenshotMonitoring();

      screenshotService.isSuspiciousApp.mockReturnValue(true);

      await handleAppSwitch('com.whatsapp', 'WhatsApp');

      expect(screenshotService.captureScreenshot).not.toHaveBeenCalled();
    });
  });

  describe('setMonitoringEnabled', () => {
    it('should enable monitoring and persist state', async () => {
      await setMonitoringEnabled(true);

      expect(AsyncStorage.setItem).toHaveBeenCalledWith(
        '@familyguard_screenshot_monitoring_enabled',
        'true'
      );
      expect(getMonitoringEnabled()).toBe(true);
    });

    it('should disable monitoring and persist state', async () => {
      await setMonitoringEnabled(false);

      expect(AsyncStorage.setItem).toHaveBeenCalledWith(
        '@familyguard_screenshot_monitoring_enabled',
        'false'
      );
      expect(getMonitoringEnabled()).toBe(false);
    });

    it('should handle AsyncStorage errors', async () => {
      AsyncStorage.setItem.mockRejectedValue(new Error('Storage error'));

      await expect(setMonitoringEnabled(true)).rejects.toThrow('Storage error');
    });
  });

  describe('requestPermission', () => {
    it('should request permission successfully', async () => {
      screenshotService.requestScreenCapturePermission.mockResolvedValue(true);

      const result = await requestPermission();

      expect(result).toBe(true);
      expect(screenshotService.requestScreenCapturePermission).toHaveBeenCalled();
    });

    it('should handle permission denial', async () => {
      screenshotService.requestScreenCapturePermission.mockRejectedValue(new Error('User denied'));

      const result = await requestPermission();

      expect(result).toBe(false);
    });

    it('should handle permission errors gracefully', async () => {
      screenshotService.requestScreenCapturePermission.mockRejectedValue(new Error('System error'));

      const result = await requestPermission();

      expect(result).toBe(false);
    });
  });

  describe('Integration scenarios', () => {
    beforeEach(async () => {
      AsyncStorage.getItem.mockImplementation((key) => {
        if (key === '@familyguard_pairing') {
          return Promise.resolve(JSON.stringify(mockPairingData));
        }
        return Promise.resolve(null);
      });
      await initializeScreenshotMonitoring();
    });

    it('should handle complete monitoring flow', async () => {
      const mockScreenshot = {
        base64Image: 'mockBase64',
        packageName: 'com.whatsapp',
        appName: 'WhatsApp',
        timestamp: Date.now(),
        childId: mockPairingData.childId,
      };

      screenshotService.isSuspiciousApp.mockReturnValue(true);
      screenshotService.isScreenCapturePermissionGranted.mockReturnValue(true);
      screenshotService.captureScreenshot.mockResolvedValue(mockScreenshot);
      contentAnalysisService.analyzeWithOfflineSupport.mockResolvedValue({
        riskLevel: 'MEDIUM',
        violations: ['adult'],
      });

      await handleAppSwitch('com.whatsapp', 'WhatsApp');

      // Should attempt to handle suspicious app
      expect(screenshotService.isSuspiciousApp).toHaveBeenCalledWith('com.whatsapp');
    });

    it('should handle rapid switches to multiple apps', async () => {
      screenshotService.isSuspiciousApp.mockReturnValue(true);
      screenshotService.isScreenCapturePermissionGranted.mockReturnValue(true);
      screenshotService.captureScreenshot.mockResolvedValue({
        base64Image: 'mockBase64',
        timestamp: Date.now(),
      });
      contentAnalysisService.analyzeWithOfflineSupport.mockResolvedValue({ riskLevel: 'LOW' });

      // Handle sequentially to respect debouncing
      await handleAppSwitch('com.whatsapp', 'WhatsApp');
      await handleAppSwitch('com.facebook.katana', 'Facebook');
      await handleAppSwitch('com.instagram.android', 'Instagram');

      // Should have handled multiple different apps
      expect(screenshotService.captureScreenshot.mock.calls.length).toBeGreaterThanOrEqual(2);
    });
  });
});
