
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
  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
      
      {/* Header - UPDATED */}
      <View style={styles.header}>
        <TouchableOpacity
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
          <Text style={styles.version}>Version 1.0.0</Text>
          
          <View style={styles.features}>
            <Text style={styles.featuresTitle}>Features:</Text>
            <Text style={styles.feature}>• Location sharing</Text>
            <Text style={styles.feature}>• Emergency alerts</Text>
            <Text style={styles.feature}>• Safe browsing</Text>
            <Text style={styles.feature}>• Parent notifications</Text>
          </View>

          <View style={styles.contact}>
            <Text style={styles.contactTitle}>Support</Text>
            <Text style={styles.contactText}>support@familyguard.app</Text>
            <Text style={styles.contactText}>+961 79 171 194</Text>
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
  version: {
    fontSize: 16,
    color: '#6B7280',
    marginBottom: 24,
  },
  features: {
    alignSelf: 'stretch',
    marginBottom: 24,
  },
  featuresTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 12,
  },
  feature: {
    fontSize: 16,
    color: '#6B7280',
    marginBottom: 8,
  },
  contact: {
    alignSelf: 'stretch',
  },
  contactTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 12,
  },
  contactText: {
    fontSize: 16,
    color: '#6B7280',
    marginBottom: 4,
  },

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
  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
      
      {/* Header - UPDATED */}
      <View style={styles.header}>
        <TouchableOpacity
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
          <Text style={styles.version}>Version 1.0.0</Text>
          
          <View style={styles.features}>
            <Text style={styles.featuresTitle}>Features:</Text>
            <Text style={styles.feature}>• Location sharing</Text>
            <Text style={styles.feature}>• Emergency alerts</Text>
            <Text style={styles.feature}>• Safe browsing</Text>
            <Text style={styles.feature}>• Parent notifications</Text>
          </View>

          <View style={styles.contact}>
            <Text style={styles.contactTitle}>Support</Text>
            <Text style={styles.contactText}>support@familyguard.app</Text>
            <Text style={styles.contactText}>+961 79 171 194</Text>
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
  version: {
    fontSize: 16,
    color: '#6B7280',
    marginBottom: 24,
  },
  features: {
    alignSelf: 'stretch',
    marginBottom: 24,
  },
  featuresTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 12,
  },
  feature: {
    fontSize: 16,
    color: '#6B7280',
    marginBottom: 8,
  },
  contact: {
    alignSelf: 'stretch',
  },
  contactTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 12,
  },
  contactText: {
    fontSize: 16,
    color: '#6B7280',
    marginBottom: 4,
  },

});
