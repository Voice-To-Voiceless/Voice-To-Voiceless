/**
 * @format
 */

import React from 'react';
import ReactTestRenderer from 'react-test-renderer';

jest.mock('react-native-vision-camera', () => ({
  Camera: () => null,
  useCameraDevice: () => ({ id: 'mock-front-camera' }),
  useCameraPermission: () => ({
    hasPermission: true,
    requestPermission: jest.fn(),
  }),
}));

import App from '../App';

test('renders the communication application', async () => {
  await ReactTestRenderer.act(() => {
    ReactTestRenderer.create(<App />);
  });
});
