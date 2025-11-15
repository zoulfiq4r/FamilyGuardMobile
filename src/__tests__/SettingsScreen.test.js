import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import SettingsScreen from '../screens/SettingsScreen';

const RNAlert = require('react-native/Libraries/Alert/Alert');

const createProps = () => ({
  onBack: jest.fn(),
  onNavigateToPermissions: jest.fn(),
  onNavigateToProfile: jest.fn(),
  onNavigateToAbout: jest.fn(),
  onNavigateToBlockApps: jest.fn(),
  onLogout: jest.fn(),
});

describe('SettingsScreen', () => {
  beforeEach(() => {
    RNAlert.alert.mockReset();
  });

  test('invokes navigation callbacks for each menu option', () => {
    const props = createProps();
    const { getByText } = render(<SettingsScreen {...props} />);

    fireEvent.press(getByText('←'));
    expect(props.onBack).toHaveBeenCalled();

    fireEvent.press(getByText('Profile'));
    expect(props.onNavigateToProfile).toHaveBeenCalled();

    fireEvent.press(getByText('Permissions'));
    expect(props.onNavigateToPermissions).toHaveBeenCalled();

    fireEvent.press(getByText('Block Apps'));
    expect(props.onNavigateToBlockApps).toHaveBeenCalled();

    fireEvent.press(getByText('About'));
    expect(props.onNavigateToAbout).toHaveBeenCalled();
  });

  test('confirms logout before calling onLogout', () => {
    const props = createProps();
    RNAlert.alert.mockImplementation((_title, _message, buttons) => {
      const confirm = buttons?.find((button) => button.text === 'Disconnect');
      confirm?.onPress?.();
    });

    const { getByText } = render(<SettingsScreen {...props} />);
    fireEvent.press(getByText('Disconnect'));

    expect(RNAlert.alert).toHaveBeenCalled();
    expect(props.onLogout).toHaveBeenCalled();
  });
});
