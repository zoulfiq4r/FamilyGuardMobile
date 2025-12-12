import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import ProfileScreen from '../screens/ProfileScreen';

describe('ProfileScreen', () => {
  test('renders profile details and handles back presses', () => {
    const onBack = jest.fn();
    const childContext = {
      childId: 'child-123',
      parentId: 'parent-999',
      childName: 'Ava Doe',
    };
    const permissionState = {
      location: true,
      usage: true,
      accessibility: true,
      overlay: true,
      batteryOptimization: true,
    };

    const deviceInfoOverride = {
      name: 'Galaxy S22',
      id: 'device-abc',
      platform: 'Android',
      version: '14',
    };

    const { getByText, getByTestId } = render(
      <ProfileScreen
        onBack={onBack}
        childContext={childContext}
        permissionState={permissionState}
        deviceInfoOverride={deviceInfoOverride}
      />
    );

    expect(getByText('Ava Doe')).toBeTruthy();
    expect(getByText('Galaxy S22')).toBeTruthy();
    expect(getByText('device-abc')).toBeTruthy();
    expect(getByText('parent-999')).toBeTruthy();

    fireEvent.press(getByTestId('profile-back-button'));
    expect(onBack).toHaveBeenCalled();
  });
});

