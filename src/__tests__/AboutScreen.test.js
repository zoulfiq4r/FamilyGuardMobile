import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import AboutScreen from '../screens/AboutScreen';

describe('AboutScreen', () => {
  test('shows feature list and triggers back handler', () => {
    const onBack = jest.fn();
    const { getByText, getByTestId } = render(<AboutScreen onBack={onBack} />);

    expect(getByText('Features:')).toBeTruthy();
    expect(getByText('Support')).toBeTruthy();

    fireEvent.press(getByTestId('about-back-button'));
    expect(onBack).toHaveBeenCalled();
  });
});