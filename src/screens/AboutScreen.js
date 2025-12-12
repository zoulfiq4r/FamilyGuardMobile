
import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  StatusBar,
} from 'react-native';

export default function AboutScreen({ onBack }) {
  const features = [
    {
      icon: '📍',
      title: 'Live location safety',
      description: 'Real-time location updates with safe zone awareness.',
    },
    {
      icon: '🛡️',
      title: 'Permission guardrails',
      description: 'Guided setup to keep required permissions healthy.',
    },
    {
      icon: '🚨',
      title: 'Smart alerts',
      description: 'Notifies parents when risky activity or content is detected.',
    },
    {
      icon: '⏱️',
      title: 'Usage insights',
      description: 'Screen time and app activity to encourage healthy habits.',
    },
  ];

  const supportChannels = [
    { label: 'Email', value: 'zoulfiqar.kanso@gmail.com' },
    { label: 'Phone', value: '+961 79 171 194' },
  ];

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
      
      {/* Header - UPDATED */}
      <View style={styles.header}>
        <TouchableOpacity
          testID="about-back-button"
          style={styles.backButton}
          onPress={onBack}
          activeOpacity={0.7}
        >
          <Text style={styles.backIcon}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>About</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView style={styles.scrollView}>
        <View style={styles.card}>
          <View style={styles.logoContainer}>
            <Text style={styles.logoEmoji}>🛡️</Text>
          </View>
          <Text style={styles.appName}>FamilyGuard Child</Text>
          <View style={styles.tagRow}>
            <Text style={styles.versionTag}>v1.0.0</Text>
            <Text style={styles.tagline}>Keeping families connected and safe</Text>
          </View>

          <View style={styles.features}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Feature Highlights</Text>
              <Text style={styles.sectionSubtitle}>What you get out of the box</Text>
            </View>
            {features.map((item) => (
              <View key={item.title} style={styles.featureItem}>
                <View style={[styles.iconPill, styles.featurePill]}>
                  <Text style={styles.featureIcon}>{item.icon}</Text>
                </View>
                <View style={styles.featureCopy}>
                  <Text style={styles.featureTitle}>{item.title}</Text>
                  <Text style={styles.featureDescription}>{item.description}</Text>
                </View>
              </View>
            ))}
          </View>

          <View style={styles.contact}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Support</Text>
              <Text style={styles.sectionSubtitle}>We respond within one business day</Text>
            </View>
            {supportChannels.map((channel) => (
              <View key={channel.label} style={styles.supportRow}>
                <Text style={styles.supportLabel}>{channel.label}</Text>
                <Text style={styles.supportValue}>{channel.value}</Text>
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
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  backButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 22,
    backgroundColor: '#F3F4F6',
  },
  backIcon: {
    fontSize: 20,
    color: '#111827',
    fontWeight: 'bold',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
  },
  placeholder: {
    width: 44,
  },
  scrollView: {
    flex: 1,
    padding: 16,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 24,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    alignItems: 'center',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 5,
  },
  logoContainer: {
    width: 80,
    height: 80,
    borderRadius: 20,
    backgroundColor: '#3B82F6',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  logoEmoji: {
    fontSize: 32,
  },
  appName: {
    fontSize: 24,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 8,
  },
  tagRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 24,
  },
  versionTag: {
    backgroundColor: '#E0F2FE',
    color: '#0369A1',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
    fontWeight: '700',
    fontSize: 14,
  },
  tagline: {
    color: '#475569',
    fontSize: 14,
  },
  features: {
    alignSelf: 'stretch',
    marginBottom: 24,
  },
  sectionHeader: {
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: 4,
  },
  sectionSubtitle: {
    fontSize: 14,
    color: '#6B7280',
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    gap: 12,
  },
  featurePill: {
    backgroundColor: '#EEF2FF',
  },
  iconPill: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  featureIcon: {
    fontSize: 20,
  },
  featureCopy: {
    flex: 1,
  },
  featureTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 4,
  },
  featureDescription: {
    fontSize: 14,
    color: '#6B7280',
    lineHeight: 20,
  },
  contact: {
    alignSelf: 'stretch',
  },
  supportRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  supportLabel: {
    fontSize: 15,
    color: '#475569',
    fontWeight: '600',
  },
  supportValue: {
    fontSize: 15,
    color: '#0F172A',
    fontWeight: '600',
  },


});
