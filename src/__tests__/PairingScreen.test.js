import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import PairingScreen from '../screens/PairingScreen';

jest.mock('../services/pairingService', () => ({
  validateAndPairDevice: jest.fn(async () => ({
    success: true,
    childId: 'cid',
    childName: 'Alex',
    deviceId: 'device-123',
    parentId: 'pid',
  })),
}));

const RNAlert = require('react-native/Libraries/Alert/Alert');
const { validateAndPairDevice } = require('../services/pairingService');

describe('PairingScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    RNAlert.alert.mockReset();
  });

  test('keeps connect button disabled until all digits are filled', () => {
    const onPaired = jest.fn();
    const { getByTestId } = render(<PairingScreen onPaired={onPaired} />);

    const button = getByTestId('connect-button');
    expect(button.props.accessibilityState?.disabled).toBe(true);

    const inputs = [0, 1, 2, 3, 4, 5].map((i) => getByTestId(`code-input-${i}`));
    const digits = ['1', '2', '3', '4', '5'];
    digits.forEach((digit, index) => {
      fireEvent.changeText(inputs[index], digit);
    });

    expect(getByTestId('connect-button').props.accessibilityState?.disabled).toBe(true);
  });

  test('enters code and triggers onPaired on success', async () => {
    RNAlert.alert.mockImplementation((_title, _msg, buttons) => {
      buttons?.[0]?.onPress?.();
    });
    const onPaired = jest.fn();
    const { getByTestId } = render(<PairingScreen onPaired={onPaired} />);

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

    await waitFor(() => expect(validateAndPairDevice).toHaveBeenCalled());
    await waitFor(() => expect(onPaired).toHaveBeenCalled());
  });

  test('shows error alert and clears code when pairing fails', async () => {
    const error = new Error('Invalid code');
    validateAndPairDevice.mockRejectedValueOnce(error);

    const onPaired = jest.fn();
    const { getByTestId } = render(<PairingScreen onPaired={onPaired} />);

    const inputs = [0, 1, 2, 3, 4, 5].map((i) => getByTestId(`code-input-${i}`));
    const digits = ['1', '2', '3', '4', '5', '6'];
    digits.forEach((digit, index) => fireEvent.changeText(inputs[index], digit));

    await waitFor(() => {
      const btn = getByTestId('connect-button');
      expect(btn.props.accessibilityState?.disabled).not.toBe(true);
    });

    fireEvent.press(getByTestId('connect-button'));

    await waitFor(() =>
      expect(RNAlert.alert).toHaveBeenCalledWith('Pairing Failed', error.message, [{ text: 'OK' }]),
    );
    inputs.forEach((input) => {
      expect(input.props.value).toBe('');
    });
    expect(onPaired).not.toHaveBeenCalled();
  });
});


