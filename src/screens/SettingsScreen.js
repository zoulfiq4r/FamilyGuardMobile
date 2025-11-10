
import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  StatusBar,
  Alert,
} from 'react-native';

export default function SettingsScreen({ 
  onBack, 
  onNavigateToPermissions,
  onNavigateToProfile,
  onNavigateToAbout,
  onNavigateToBlockApps,
  onLogout 
}) {
  const handleLogout = () => {
    Alert.alert(
      'Disconnect Device',
      'Are you sure you want to disconnect from your parent? You will need to pair again.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Disconnect',
          style: 'destructive',
          onPress: onLogout,
        },
      ]
    );
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
      
      {/* Header */}
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
        <Text style={styles.headerTitle}>Settings</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        {/* Main Settings Card */}
        <View style={styles.card}>
          <TouchableOpacity 
            style={styles.menuItem} 
            onPress={onNavigateToProfile}
            activeOpacity={0.7}
          >
            <View style={[styles.iconContainer, styles.blueIcon]}>
              <Text style={styles.iconEmoji}>👤</Text>
            </View>
            <View style={styles.menuText}>
              <Text style={styles.menuTitle}>Profile</Text>
              <Text style={styles.menuSubtitle}>View device information</Text>
            </View>
            <Text style={styles.chevron}>›</Text>
          </TouchableOpacity>

          <View style={styles.separator} />

          <TouchableOpacity 
            style={styles.menuItem} 
            onPress={onNavigateToPermissions}
            activeOpacity={0.7}
          >
            <View style={[styles.iconContainer, styles.greenIcon]}>
              <Text style={styles.iconEmoji}>🛡️</Text>
            </View>
            <View style={styles.menuText}>
              <Text style={styles.menuTitle}>Permissions</Text>
              <Text style={styles.menuSubtitle}>Manage app permissions</Text>
            </View>
            <Text style={styles.chevron}>›</Text>
          </TouchableOpacity>

          <View style={styles.separator} />

          <TouchableOpacity 
            style={styles.menuItem} 
            onPress={onNavigateToBlockApps}
            activeOpacity={0.7}
          >
            <View style={[styles.iconContainer, styles.redIcon]}>
              <Text style={styles.iconEmoji}>🚫</Text>
            </View>
            <View style={styles.menuText}>
              <Text style={styles.menuTitle}>Block Apps</Text>
              <Text style={styles.menuSubtitle}>Manage blocked applications</Text>
            </View>
            <Text style={styles.chevron}>›</Text>
          </TouchableOpacity>

          <View style={styles.separator} />

          <TouchableOpacity 
            style={styles.menuItem} 
            onPress={onNavigateToAbout}
            activeOpacity={0.7}
          >
            <View style={[styles.iconContainer, styles.purpleIcon]}>
              <Text style={styles.iconEmoji}>ℹ️</Text>
            </View>
            <View style={styles.menuText}>
              <Text style={styles.menuTitle}>About</Text>
              <Text style={styles.menuSubtitle}>App version & info</Text>
            </View>
            <Text style={styles.chevron}>›</Text>
          </TouchableOpacity>
        </View>

        {/* Logout Card */}
        <View style={styles.card}>
          <TouchableOpacity 
            style={styles.menuItem} 
            onPress={handleLogout}
            activeOpacity={0.7}
          >
            <View style={[styles.iconContainer, styles.redIcon]}>
              <Text style={styles.iconEmoji}>🚪</Text>
            </View>
            <View style={styles.menuText}>
              <Text style={styles.logoutTitle}>Disconnect</Text>
              <Text style={styles.menuSubtitle}>Remove parent connection</Text>
            </View>
            <Text style={styles.chevron}>›</Text>
          </TouchableOpacity>
        </View>

        {/* Footer Info */}
        <View style={styles.footer}>
          <Text style={styles.footerVersion}>FamilyGuard Child v1.0.0</Text>
          <Text style={styles.footerTagline}>Keeping families connected safely</Text>
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
    paddingTop: 8,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { 
      width: 0, 
      height: 2 
    },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    gap: 12,
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  blueIcon: {
    backgroundColor: '#DBEAFE',
  },
  greenIcon: {
    backgroundColor: '#DCFCE7',
  },
  purpleIcon: {
    backgroundColor: '#F3E8FF',
  },
  redIcon: {
    backgroundColor: '#FEE2E2',
  },
  orangeIcon: {
    backgroundColor: '#FED7AA',
  },
  iconEmoji: {
    fontSize: 20,
  },
  menuText: {
    flex: 1,
  },
  menuTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 2,
  },
  menuSubtitle: {
    fontSize: 14,
    color: '#6B7280',
    lineHeight: 18,
  },
  logoutTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#DC2626',
    marginBottom: 2,
  },
  chevron: {
    fontSize: 20,
    color: '#9CA3AF',
    fontWeight: 'bold',
  },
  separator: {
    height: 1,
    backgroundColor: '#F3F4F6',
    marginLeft: 76,
    marginRight: 16,
  },
  footer: {
    paddingTop: 24,
    paddingHorizontal: 8,
    alignItems: 'center',
  },
  footerVersion: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
    marginBottom: 4,
  },
  footerTagline: {
    fontSize: 12,
    color: '#9CA3AF',
    textAlign: 'center',
  },

import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  StatusBar,
  Alert,
} from 'react-native';

export default function SettingsScreen({ 
  onBack, 
  onNavigateToPermissions,
  onNavigateToProfile,
  onNavigateToAbout,
  onLogout 
}) {
  const handleLogout = () => {
    Alert.alert(
      'Disconnect Device',
      'Are you sure you want to disconnect from your parent? You will need to pair again.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Disconnect',
          style: 'destructive',
          onPress: onLogout,
        },
      ]
    );
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
      
      {/* Header */}
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
        <Text style={styles.headerTitle}>Settings</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        {/* Main Settings Card */}
        <View style={styles.card}>
          <TouchableOpacity 
            style={styles.menuItem} 
            onPress={onNavigateToProfile}
            activeOpacity={0.7}
          >
            <View style={[styles.iconContainer, styles.blueIcon]}>
              <Text style={styles.iconEmoji}>👤</Text>
            </View>
            <View style={styles.menuText}>
              <Text style={styles.menuTitle}>Profile</Text>
              <Text style={styles.menuSubtitle}>View device information</Text>
            </View>
            <Text style={styles.chevron}>›</Text>
          </TouchableOpacity>

          <View style={styles.separator} />

          <TouchableOpacity 
            style={styles.menuItem} 
            onPress={onNavigateToPermissions}
            activeOpacity={0.7}
          >
            <View style={[styles.iconContainer, styles.greenIcon]}>
              <Text style={styles.iconEmoji}>🛡️</Text>
            </View>
            <View style={styles.menuText}>
              <Text style={styles.menuTitle}>Permissions</Text>
              <Text style={styles.menuSubtitle}>Manage app permissions</Text>
            </View>
            <Text style={styles.chevron}>›</Text>
          </TouchableOpacity>

          <View style={styles.separator} />

          <TouchableOpacity 
            style={styles.menuItem} 
            onPress={onNavigateToAbout}
            activeOpacity={0.7}
          >
            <View style={[styles.iconContainer, styles.purpleIcon]}>
              <Text style={styles.iconEmoji}>ℹ️</Text>
            </View>
            <View style={styles.menuText}>
              <Text style={styles.menuTitle}>About</Text>
              <Text style={styles.menuSubtitle}>App version & info</Text>
            </View>
            <Text style={styles.chevron}>›</Text>
          </TouchableOpacity>
        </View>

        {/* Logout Card */}
        <View style={styles.card}>
          <TouchableOpacity 
            style={styles.menuItem} 
            onPress={handleLogout}
            activeOpacity={0.7}
          >
            <View style={[styles.iconContainer, styles.redIcon]}>
              <Text style={styles.iconEmoji}>🚪</Text>
            </View>
            <View style={styles.menuText}>
              <Text style={styles.logoutTitle}>Disconnect</Text>
              <Text style={styles.menuSubtitle}>Remove parent connection</Text>
            </View>
            <Text style={styles.chevron}>›</Text>
          </TouchableOpacity>
        </View>

        {/* Footer Info */}
        <View style={styles.footer}>
          <Text style={styles.footerVersion}>FamilyGuard Child v1.0.0</Text>
          <Text style={styles.footerTagline}>Keeping families connected safely</Text>
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
    paddingTop: 8,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { 
      width: 0, 
      height: 2 
    },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    gap: 12,
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  blueIcon: {
    backgroundColor: '#DBEAFE',
  },
  greenIcon: {
    backgroundColor: '#DCFCE7',
  },
  purpleIcon: {
    backgroundColor: '#F3E8FF',
  },
  redIcon: {
    backgroundColor: '#FEE2E2',
  },
  iconEmoji: {
    fontSize: 20,
  },
  menuText: {
    flex: 1,
  },
  menuTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 2,
  },
  menuSubtitle: {
    fontSize: 14,
    color: '#6B7280',
    lineHeight: 18,
  },
  logoutTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#DC2626',
    marginBottom: 2,
  },
  chevron: {
    fontSize: 20,
    color: '#9CA3AF',
    fontWeight: 'bold',
  },
  separator: {
    height: 1,
    backgroundColor: '#F3F4F6',
    marginLeft: 76,
    marginRight: 16,
  },
  footer: {
    paddingTop: 24,
    paddingHorizontal: 8,
    alignItems: 'center',
  },
  footerVersion: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
    marginBottom: 4,
  },
  footerTagline: {
    fontSize: 12,
    color: '#9CA3AF',
    textAlign: 'center',
  },

});
