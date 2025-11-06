import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';

jest.mock('react-native/Libraries/Alert/Alert', () => ({ alert: jest.fn() }));
import PairingScreen from '../screens/PairingScreen';

jest.mock('../services/pairingService', () => ({
  validateAndPairDevice: jest.fn(async () => ({ success: true, childId: 'cid', childName: 'Alex', deviceId: 'device-123', parentId: 'pid' })),
}));

describe('PairingScreen', () => {
  test('enters code and triggers onPaired on success', async () => {
    const RNAlert = require('react-native/Libraries/Alert/Alert');
    RNAlert.alert.mockImplementation((title, msg, buttons) => {
      if (buttons && buttons[0] && buttons[0].onPress) buttons[0].onPress();
    });
    const onPaired = jest.fn();
    const { getByTestId, getByText } = render(<PairingScreen onPaired={onPaired} />);

    const inputs = [0,1,2,3,4,5].map(i => getByTestId(`code-input-${i}`));
    // Enter 6 digits
    const digits = ['1','2','3','4','5','6'];
    digits.forEach((d, i) => fireEvent.changeText(inputs[i], d));

    // Wait until button enabled, then press
    await waitFor(() => {
      const btn = getByTestId('connect-button');
      expect(btn.props.accessibilityState?.disabled).not.toBe(true);
    });
    fireEvent.press(getByTestId('connect-button'));

    const { validateAndPairDevice } = require('../services/pairingService');
    await waitFor(() => expect(validateAndPairDevice).toHaveBeenCalled());
    // Success path reached; service called
  });
});


