
import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  StatusBar,
} from 'react-native';

export default function ProfileScreen({ onBack }) {
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
  <Text style={styles.headerTitle}>Profile</Text>
  <View style={styles.placeholder} />
</View>

      <ScrollView style={styles.scrollView}>
        <View style={styles.card}>
          <View style={styles.infoItem}>
            <Text style={styles.infoLabel}>Device Name</Text>
            <Text style={styles.infoValue}>Child's Phone</Text>
          </View>
          <View style={styles.separator} />
          <View style={styles.infoItem}>
            <Text style={styles.infoLabel}>Device ID</Text>
            <Text style={styles.infoValue}>FG-123456</Text>
          </View>
          <View style={styles.separator} />
          <View style={styles.infoItem}>
            <Text style={styles.infoLabel}>Connected Since</Text>
            <Text style={styles.infoValue}>January 15, 2024</Text>
          </View>
          <View style={styles.separator} />
          <View style={styles.infoItem}>
            <Text style={styles.infoLabel}>Parent Device</Text>
            <Text style={styles.infoValue}>Parent's Phone</Text>
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
    padding: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  infoItem: {
    paddingVertical: 12,
  },
  infoLabel: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 4,
  },
  infoValue: {
    fontSize: 16,
    fontWeight: '500',
    color: '#111827',
  },
  separator: {
    height: 1,
    backgroundColor: '#E5E7EB',
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

export default function ProfileScreen({ onBack }) {
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
  <Text style={styles.headerTitle}>Profile</Text>
  <View style={styles.placeholder} />
</View>

      <ScrollView style={styles.scrollView}>
        <View style={styles.card}>
          <View style={styles.infoItem}>
            <Text style={styles.infoLabel}>Device Name</Text>
            <Text style={styles.infoValue}>Child's Phone</Text>
          </View>
          <View style={styles.separator} />
          <View style={styles.infoItem}>
            <Text style={styles.infoLabel}>Device ID</Text>
            <Text style={styles.infoValue}>FG-123456</Text>
          </View>
          <View style={styles.separator} />
          <View style={styles.infoItem}>
            <Text style={styles.infoLabel}>Connected Since</Text>
            <Text style={styles.infoValue}>January 15, 2024</Text>
          </View>
          <View style={styles.separator} />
          <View style={styles.infoItem}>
            <Text style={styles.infoLabel}>Parent Device</Text>
            <Text style={styles.infoValue}>Parent's Phone</Text>
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
    padding: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  infoItem: {
    paddingVertical: 12,
  },
  infoLabel: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 4,
  },
  infoValue: {
    fontSize: 16,
    fontWeight: '500',
    color: '#111827',
  },
  separator: {
    height: 1,
    backgroundColor: '#E5E7EB',
  },

});
