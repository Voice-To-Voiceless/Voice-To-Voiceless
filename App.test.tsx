/**
 * @format
 */

import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import App from '../App';
import { DwellSelector } from '../src/interaction/dwellSelector';

test('renders correctly', async () => {
  await ReactTestRenderer.act(() => {
    ReactTestRenderer.create(<App />);
  });
});

test('completes a dwell only after the configured duration', () => {
  const selector = new DwellSelector(1500);

  selector.begin('help', 1000);

  expect(selector.update('help', 2499)).toBeNull();
  expect(selector.update('help', 2500)).toEqual({
    targetId: 'help',
    completedAt: 2500,
  });
});

test('restarts the dwell when the target changes', () => {
  const selector = new DwellSelector(1000);

  selector.begin('help', 1000);

  expect(selector.update('water', 1900)).toBeNull();
  expect(selector.update('water', 2899)).toBeNull();
  expect(selector.update('water', 2900)).toEqual({
    targetId: 'water',
    completedAt: 2900,
  });
});
