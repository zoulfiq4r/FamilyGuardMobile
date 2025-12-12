import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  StatusBar,
} from 'react-native';
import { requestPermission as requestScreenshotPermission } from '../services/screenshotMonitoringService';

export default function PermissionRequestScreen({
  onBack,
  onResolvePermissions,
  permissionState,
  onRequestUsageAccess,
  onRequestAccessibility,
  onRequestOverlay,
  onRequestBatteryOptimization,
  onRequestLocation,
  onRequestScreenshotPermission = requestScreenshotPermission,
}) {
  const permissions = [
    {
      id: 'location',
      icon: '📍',
      title: 'Location Access',
      description: 'Allow parent to view your location for safety',
      status: permissionState?.location ? 'granted' : 'pending',
      color: 'blue',
      action: onRequestLocation,
      actionLabel: 'Grant Location',
    },
    {
      id: 'usage',
      icon: '📊',
      title: 'Usage Access',
      description: 'Track screen time and app usage',
      status: permissionState?.usage ? 'granted' : 'pending',
      color: 'green',
      action: onRequestUsageAccess,
      actionLabel: 'Open Settings',
    },
    {
      id: 'accessibility',
      icon: '🛡️',
      title: 'Accessibility Service',
      description: 'Allow FamilyGuard to detect active apps',
      status: permissionState?.accessibility ? 'granted' : 'pending',
      color: 'purple',
      action: onRequestAccessibility,
      actionLabel: 'Open Settings',
    },
    {
      id: 'overlay',
      icon: '🪟',
      title: 'Display Over Apps',
      description: 'Show blocking overlay on restricted apps',
      status: permissionState?.overlay ? 'granted' : 'pending',
      color: 'indigo',
      action: onRequestOverlay,
      actionLabel: 'Grant Overlay',
    },
    {
      id: 'battery',
      icon: '🔋',
      title: 'Battery Optimization',
      description: 'Keep FamilyGuard active in the background',
      status: permissionState?.batteryOptimization ? 'granted' : 'pending',
      color: 'amber',
      action: onRequestBatteryOptimization,
      actionLabel: 'Allow Background',
    },
    {
      id: 'screenshot',
      icon: '📸',
      title: 'Screenshot Monitoring',
      description: 'Allow screen capture for content alerts',
      status: permissionState?.screenshot ? 'granted' : 'pending',
      color: 'amber',
      action: onRequestScreenshotPermission,
      actionLabel: 'Grant Screenshot',
    },
  ];

  const getIconContainerStyle = (color) => {
    const styles = {
      blue: iconStyles.blueIcon,
      green: iconStyles.greenIcon,
      amber: iconStyles.amberIcon,
      purple: iconStyles.purpleIcon,
      indigo: iconStyles.indigoIcon,
    };
    return styles[color] || iconStyles.blueIcon;
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />

      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={onBack}
          activeOpacity={0.7}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <View style={styles.backButtonInner}>
            <Text style={styles.backIcon}>←</Text>
          </View>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Permissions</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        <View style={styles.infoCard}>
          <Text style={styles.infoIcon}>ℹ️</Text>
          <View style={styles.infoText}>
            <Text style={styles.infoTitle}>Why permissions matter</Text>
            <Text style={styles.infoDescription}>
              These permissions keep you safe and allow your parent to receive live updates.
            </Text>
          </View>
        </View>

        <View style={styles.permissionsContainer}>
          {permissions.map((permission) => (
            <View key={permission.id} style={styles.permissionCard}>
              <View style={styles.permissionHeader}>
                <View style={[styles.iconContainer, getIconContainerStyle(permission.color)]}>
                  <Text style={styles.iconEmoji}>{permission.icon}</Text>
                </View>
                <View style={styles.permissionText}>
                  <View style={styles.permissionTitleRow}>
                    <Text style={styles.permissionTitle}>{permission.title}</Text>
                    {permission.status === 'granted' ? (
                      <View style={styles.grantedBadge}>
                        <Text style={styles.grantedBadgeText}>✓ Granted</Text>
                      </View>
                    ) : (
                      <View style={styles.pendingBadge}>
                        <Text style={styles.pendingBadgeText}>Pending</Text>
                      </View>
                    )}
                  </View>
                  <Text style={styles.permissionDescription}>{permission.description}</Text>
                </View>
              </View>

              {permission.status === 'granted' ? (
                <TouchableOpacity
                  style={[styles.grantButton, styles.grantButtonActive]}
                  activeOpacity={0.8}
                  onPress={permission.action}
                >
                  <Text style={styles.grantButtonText}>
                    ✓ Re-enable {permission.title}
                  </Text>
                </TouchableOpacity>
              ) : (
                <TouchableOpacity
                  style={styles.grantButton}
                  activeOpacity={0.8}
                  onPress={permission.action}
                >
                  <Text style={styles.grantButtonText}>
                    {permission.actionLabel || 'Grant Permission'}
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          ))}
        </View>

        <View style={styles.privacyCard}>
          <Text style={styles.privacyTitle}>Privacy Notice</Text>
          <Text style={styles.privacyDescription}>
            All data is encrypted and only shared with your connected parent. You can revoke
            permissions any time in device settings.
          </Text>
        </View>

        <TouchableOpacity
          style={styles.doneButton}
          activeOpacity={0.85}
          onPress={onResolvePermissions}
        >
          <Text style={styles.doneButtonText}>I've Granted Permissions</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F0F9FF',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  backButton: {
    padding: 8,
  },
  backButtonInner: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 20,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  backIcon: {
    fontSize: 18,
    color: '#374151',
    fontWeight: '600',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
  },
  placeholder: {
    width: 48,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
  },
  infoCard: {
    backgroundColor: '#EFF6FF',
    borderRadius: 16,
    padding: 16,
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  infoIcon: {
    fontSize: 20,
  },
  infoText: {
    flex: 1,
  },
  infoTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1E3A8A',
    marginBottom: 4,
  },
  infoDescription: {
    fontSize: 14,
    color: '#1E40AF',
    lineHeight: 20,
  },
  permissionsContainer: {
    gap: 12,
    marginBottom: 16,
  },
  permissionCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  permissionHeader: {
    flexDirection: 'row',
    gap: 12,
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconEmoji: {
    fontSize: 24,
  },
  permissionText: {
    flex: 1,
  },
  permissionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  permissionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
  },
  permissionDescription: {
    fontSize: 14,
    color: '#475569',
    lineHeight: 20,
  },
  grantedBadge: {
    backgroundColor: '#DCFCE7',
    borderRadius: 999,
    paddingVertical: 4,
    paddingHorizontal: 10,
  },
  grantedBadgeText: {
    fontSize: 12,
    color: '#15803D',
    fontWeight: '600',
  },
  pendingBadge: {
    backgroundColor: '#FEF3C7',
    borderRadius: 999,
    paddingVertical: 4,
    paddingHorizontal: 10,
  },
  pendingBadgeText: {
    fontSize: 12,
    color: '#B45309',
    fontWeight: '600',
  },
  grantButton: {
    marginTop: 16,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: '#2563EB',
    alignItems: 'center',
  },
  grantButtonActive: {
    backgroundColor: '#1D4ED8',
  },
  grantButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
  },
  privacyCard: {
    backgroundColor: '#F8FAFC',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginTop: 8,
  },
  privacyTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#0F172A',
    marginBottom: 8,
  },
  privacyDescription: {
    fontSize: 14,
    color: '#475569',
    lineHeight: 20,
  },
  doneButton: {
    backgroundColor: '#3B82F6',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 24,
    marginBottom: 32,
    shadowColor: '#3B82F6',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },
  doneButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
});

const iconStyles = StyleSheet.create({
  blueIcon: {
    backgroundColor: '#DBEAFE',
  },
  greenIcon: {
    backgroundColor: '#DCFCE7',
  },
  amberIcon: {
    backgroundColor: '#FEF3C7',
  },
  purpleIcon: {
    backgroundColor: '#EDE9FE',
  },
  indigoIcon: {
    backgroundColor: '#E0E7FF',
  },
});
