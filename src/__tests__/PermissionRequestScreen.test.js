import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import PermissionRequestScreen from '../screens/PermissionRequestScreen';

describe('PermissionRequestScreen', () => {
  test('renders and triggers actions', () => {
    const onBack = jest.fn();
    const onResolvePermissions = jest.fn();
    const onRequestLocation = jest.fn();
    const onRequestUsageAccess = jest.fn();
    const onRequestAccessibility = jest.fn();
    const onRequestOverlay = jest.fn();
    const onRequestBatteryOptimization = jest.fn();

    const { getByText, getAllByText } = render(
      <PermissionRequestScreen
        onBack={onBack}
        onResolvePermissions={onResolvePermissions}
        onRequestLocation={onRequestLocation}
        onRequestUsageAccess={onRequestUsageAccess}
        onRequestAccessibility={onRequestAccessibility}
        onRequestOverlay={onRequestOverlay}
        onRequestBatteryOptimization={onRequestBatteryOptimization}
        permissionState={{}}
      />
    );

    // Tapping back
    fireEvent.press(getByText('←'));
    expect(onBack).toHaveBeenCalled();

    // Tap action buttons
    fireEvent.press(getByText('Grant Location'));
    const openSettingsButtons = getAllByText('Open Settings');
    fireEvent.press(openSettingsButtons[0]);
    fireEvent.press(openSettingsButtons[1]);
    fireEvent.press(getByText('Grant Overlay'));
    fireEvent.press(getByText('Allow Background'));

    expect(onRequestLocation).toHaveBeenCalled();
    expect(onRequestUsageAccess).toHaveBeenCalled();
    expect(onRequestAccessibility).toHaveBeenCalled();
    expect(onRequestOverlay).toHaveBeenCalled();
    expect(onRequestBatteryOptimization).toHaveBeenCalled();

    // Done button
    fireEvent.press(getByText("I've Granted Permissions"));
    expect(onResolvePermissions).toHaveBeenCalled();
  });
});


