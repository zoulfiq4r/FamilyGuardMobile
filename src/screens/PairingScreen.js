
import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { validateAndPairDevice } from '../services/pairingService';

export default function PairingScreen({ onPaired }) {
  const [code, setCode] = useState(['', '', '', '', '', '']);
  const [loading, setLoading] = useState(false);
  const inputRefs = useRef([]);

  const handleCodeChange = (text, index) => {
    // Only allow numbers
    if (text && !/^\d+$/.test(text)) return;

    const newCode = [...code];
    newCode[index] = text;
    setCode(newCode);

    // Auto-focus next input
    if (text && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyPress = (e, index) => {
    // Handle backspace
    if (e.nativeEvent.key === 'Backspace' && !code[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handleConnect = async () => {
    const pairingCode = code.join('');

    if (pairingCode.length !== 6) {
      Alert.alert('Error', 'Please enter a complete 6-digit code');
      return;
    }

    setLoading(true);

    try {
      const result = await validateAndPairDevice(pairingCode);
      
      Alert?.alert && Alert.alert(
        'Success! 🎉',
        `Device paired successfully!\nWelcome, ${result.childName}!`,
        [{ 
          text: 'Continue', 
          onPress: () => onPaired(result)  // Pass the result object
        }]
      );
    } catch (error) {
      Alert?.alert && Alert.alert(
        'Pairing Failed',
        error.message || 'Invalid or expired pairing code. Please try again.',
        [{ text: 'OK' }],
      );
      // Clear code on error
      setCode(['', '', '', '', '', '']);
      inputRefs.current[0]?.focus();
    } finally {
      setLoading(false);
    }
  };

  const isCodeComplete = code.every(digit => digit !== '');

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.iconContainer}>
          <Text style={styles.icon}>🛡️</Text>
        </View>
        <Text style={styles.title}>Pair Your Device</Text>
        <Text style={styles.subtitle}>
          Enter the 6-digit code shown on your parent's dashboard
        </Text>
      </View>

      <View style={styles.codeContainer}>
        {code.map((digit, index) => (
          <TextInput
            key={index}
            ref={ref => (inputRefs.current[index] = ref)}
            style={[
              styles.codeInput,
              digit && styles.codeInputFilled,
            ]}
            testID={`code-input-${index}`}
            value={digit}
            onChangeText={text => handleCodeChange(text, index)}
            onKeyPress={e => handleKeyPress(e, index)}
            keyboardType="number-pad"
            maxLength={1}
            selectTextOnFocus
            autoFocus={index === 0}
          />
        ))}
      </View>

      <TouchableOpacity
        style={[
          styles.connectButton,
          (!isCodeComplete || loading) && styles.connectButtonDisabled,
        ]}
        onPress={handleConnect}
        disabled={!isCodeComplete || loading}
        testID="connect-button"
      >
        {loading ? (
          <ActivityIndicator color="#FFFFFF" />
        ) : (
          <Text style={styles.connectButtonText}>Connect Device</Text>
        )}
      </TouchableOpacity>

      <View style={styles.infoBox}>
        <Text style={styles.infoIcon}>ℹ️</Text>
        <Text style={styles.infoText}>
          The pairing code expires after 10 minutes for security
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F0F9FF',
    padding: 24,
    justifyContent: 'center',
  },
  header: {
    alignItems: 'center',
    marginBottom: 48,
  },
  iconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#3B82F6',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  icon: {
    fontSize: 40,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#1E293B',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#64748B',
    textAlign: 'center',
    paddingHorizontal: 32,
  },
  codeContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 12,
    marginBottom: 32,
  },
  codeInput: {
    width: 48,
    height: 56,
    borderWidth: 2,
    borderColor: '#CBD5E1',
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
    color: '#1E293B',
  },
  codeInputFilled: {
    borderColor: '#3B82F6',
    backgroundColor: '#EFF6FF',
  },
  connectButton: {
    backgroundColor: '#3B82F6',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 24,
    shadowColor: '#3B82F6',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  connectButtonDisabled: {
    backgroundColor: '#CBD5E1',
    shadowOpacity: 0,
    elevation: 0,
  },
  connectButtonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '600',
  },
  infoBox: {
    flexDirection: 'row',
    backgroundColor: '#FEF3C7',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  infoIcon: {
    fontSize: 20,
    marginRight: 12,
  },
  infoText: {
    flex: 1,
    fontSize: 14,
    color: '#92400E',
  },

import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { validateAndPairDevice } from '../services/pairingService';

export default function PairingScreen({ onPaired }) {
  const [code, setCode] = useState(['', '', '', '', '', '']);
  const [loading, setLoading] = useState(false);
  const inputRefs = useRef([]);

  const handleCodeChange = (text, index) => {
    // Only allow numbers
    if (text && !/^\d+$/.test(text)) return;

    const newCode = [...code];
    newCode[index] = text;
    setCode(newCode);

    // Auto-focus next input
    if (text && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyPress = (e, index) => {
    // Handle backspace
    if (e.nativeEvent.key === 'Backspace' && !code[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handleConnect = async () => {
    const pairingCode = code.join('');

    if (pairingCode.length !== 6) {
      Alert.alert('Error', 'Please enter a complete 6-digit code');
      return;
    }

    setLoading(true);

    try {
      const result = await validateAndPairDevice(pairingCode);
      
      Alert?.alert && Alert.alert(
        'Success! 🎉',
        `Device paired successfully!\nWelcome, ${result.childName}!`,
        [{ 
          text: 'Continue', 
          onPress: () => onPaired(result)  // Pass the result object
        }]
      );
    } catch (error) {
      Alert?.alert && Alert.alert(
        'Pairing Failed',
        error.message || 'Invalid or expired pairing code. Please try again.',
        [{ text: 'OK' }],
      );
      // Clear code on error
      setCode(['', '', '', '', '', '']);
      inputRefs.current[0]?.focus();
    } finally {
      setLoading(false);
    }
  };

  const isCodeComplete = code.every(digit => digit !== '');

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.iconContainer}>
          <Text style={styles.icon}>🛡️</Text>
        </View>
        <Text style={styles.title}>Pair Your Device</Text>
        <Text style={styles.subtitle}>
          Enter the 6-digit code shown on your parent's dashboard
        </Text>
      </View>

      <View style={styles.codeContainer}>
        {code.map((digit, index) => (
          <TextInput
            key={index}
            ref={ref => (inputRefs.current[index] = ref)}
            style={[
              styles.codeInput,
              digit && styles.codeInputFilled,
            ]}
            testID={`code-input-${index}`}
            value={digit}
            onChangeText={text => handleCodeChange(text, index)}
            onKeyPress={e => handleKeyPress(e, index)}
            keyboardType="number-pad"
            maxLength={1}
            selectTextOnFocus
            autoFocus={index === 0}
          />
        ))}
      </View>

      <TouchableOpacity
        style={[
          styles.connectButton,
          (!isCodeComplete || loading) && styles.connectButtonDisabled,
        ]}
        onPress={handleConnect}
        disabled={!isCodeComplete || loading}
        testID="connect-button"
      >
        {loading ? (
          <ActivityIndicator color="#FFFFFF" />
        ) : (
          <Text style={styles.connectButtonText}>Connect Device</Text>
        )}
      </TouchableOpacity>

      <View style={styles.infoBox}>
        <Text style={styles.infoIcon}>ℹ️</Text>
        <Text style={styles.infoText}>
          The pairing code expires after 10 minutes for security
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F0F9FF',
    padding: 24,
    justifyContent: 'center',
  },
  header: {
    alignItems: 'center',
    marginBottom: 48,
  },
  iconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#3B82F6',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  icon: {
    fontSize: 40,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#1E293B',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#64748B',
    textAlign: 'center',
    paddingHorizontal: 32,
  },
  codeContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 12,
    marginBottom: 32,
  },
  codeInput: {
    width: 48,
    height: 56,
    borderWidth: 2,
    borderColor: '#CBD5E1',
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
    color: '#1E293B',
  },
  codeInputFilled: {
    borderColor: '#3B82F6',
    backgroundColor: '#EFF6FF',
  },
  connectButton: {
    backgroundColor: '#3B82F6',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 24,
    shadowColor: '#3B82F6',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  connectButtonDisabled: {
    backgroundColor: '#CBD5E1',
    shadowOpacity: 0,
    elevation: 0,
  },
  connectButtonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '600',
  },
  infoBox: {
    flexDirection: 'row',
    backgroundColor: '#FEF3C7',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  infoIcon: {
    fontSize: 20,
    marginRight: 12,
  },
  infoText: {
    flex: 1,
    fontSize: 14,
    color: '#92400E',
  },

});
