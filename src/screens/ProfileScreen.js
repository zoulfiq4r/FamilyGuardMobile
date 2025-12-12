import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  StatusBar,
} from 'react-native';
import DeviceInfo from 'react-native-device-info';
import pkg from '../../package.json';

export default function ProfileScreen({ onBack, childContext, permissionState, deviceInfoOverride }) {
  const [deviceInfo, setDeviceInfo] = useState({
    name: 'Loading...',
    id: 'Loading...',
    platform: '-',
    version: '-',
  });

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      try {
        const [name, id, platform, version] = await Promise.all([
          DeviceInfo.getDeviceName(),
          DeviceInfo.getUniqueId(),
          DeviceInfo.getSystemName(),
          DeviceInfo.getVersion(),
        ]);
        if (mounted) {
          setDeviceInfo({ name, id, platform, version });
        }
      } catch (_error) {
        // Keep defaults if device info fails
      }
    };

    if (!deviceInfoOverride) {
      load();
    }

    return () => {
      mounted = false;
    };
  }, [deviceInfoOverride]);

  const computedDevice = deviceInfoOverride || deviceInfo;
  const childName = childContext?.childName || 'Child Device';
  const childInitials = useMemo(() => {
    const parts = childName.split(' ').filter(Boolean);
    if (!parts.length) return 'CD';
    return parts
      .slice(0, 2)
      .map((p) => p[0]?.toUpperCase())
      .join('');
  }, [childName]);

  const status = childContext?.childId ? 'Connected' : 'Not paired';
  const permissionsOk = permissionState
    ? Object.values(permissionState).every(Boolean)
    : false;

  const stats = [
    { label: 'App Usage', value: permissionsOk ? 'Healthy' : 'Unknown' },
    { label: 'Location', value: permissionState?.location ? 'Sharing' : 'Pending' },
    { label: 'Permissions', value: permissionsOk ? 'All set' : 'Needs review' },
  ];

  const infoRows = [
    { label: 'Child ID', value: childContext?.childId || '-' },
    { label: 'Parent ID', value: childContext?.parentId || '-' },
    { label: 'Device Name', value: computedDevice.name || '-' },
    { label: 'Device ID', value: computedDevice.id || '-' },
    { label: 'OS', value: `${computedDevice.platform || '-'} ${computedDevice.version || ''}`.trim() },
  ];

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
      <View style={styles.header}>
        <TouchableOpacity
          testID="profile-back-button"
          style={styles.backButton}
          onPress={onBack}
          activeOpacity={0.7}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <View style={styles.backButtonInner}>
            <Text style={styles.backIcon}>←</Text>
          </View>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Profile</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView style={styles.scrollView}>
        <View style={styles.card}>
          <View style={styles.heroRow}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{childInitials}</Text>
            </View>
            <View style={styles.heroCopy}>
              <Text style={styles.heroName}>{childName}</Text>
              <Text style={styles.heroSub}>Child profile · v{pkg.version}</Text>
            </View>
            <View style={styles.statusPill}>
              <Text style={styles.statusText}>{status}</Text>
            </View>
          </View>

          <View style={styles.statRow}>
            {stats.map((item) => (
              <View key={item.label} style={styles.statCard}>
                <Text style={styles.statLabel}>{item.label}</Text>
                <Text style={styles.statValue}>{item.value}</Text>
              </View>
            ))}
          </View>

          <View style={styles.infoList}>
            {infoRows.map((row) => (
              <View key={row.label} style={styles.infoItem}>
                <Text style={styles.infoLabel}>{row.label}</Text>
                <Text style={styles.infoValue}>{row.value}</Text>
              </View>
            ))}
          </View>
        </View>
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
    // Large touch area but invisible
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
    padding: 16,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 18,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 5,
  },
  heroRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 16,
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 16,
    backgroundColor: '#E0F2FE',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: 20,
    fontWeight: '700',
    color: '#0369A1',
  },
  heroCopy: {
    flex: 1,
  },
  heroName: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: 4,
  },
  heroSub: {
    fontSize: 14,
    color: '#64748B',
  },
  statusPill: {
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
  },
  statusText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#166534',
  },
  statRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
    marginBottom: 16,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  statLabel: {
    fontSize: 13,
    color: '#64748B',
    marginBottom: 6,
  },
  statValue: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0F172A',
  },
  infoList: {
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: '#E5E7EB',
  },
  infoItem: {
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  infoLabel: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 4,
  },
  infoValue: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
  },



});
