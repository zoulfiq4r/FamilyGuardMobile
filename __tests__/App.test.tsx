/**
 * @format
 */

import React from 'react';
import ReactTestRenderer from 'react-test-renderer';

jest.useFakeTimers();
import App from '../App';

test('renders correctly', async () => {
  await ReactTestRenderer.act(() => {
    ReactTestRenderer.create(<App />);
  });
  // advance timers to avoid act warnings
  ReactTestRenderer.act(() => {
    jest.runOnlyPendingTimers();
  });
});
