import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import { DebugOverlay } from '../src/browser/components/DebugOverlay';

test('renders raw and calibrated markers as detachable debug output', async () => {
  Object.assign(window, {
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
  });
  let renderer: ReturnType<typeof ReactTestRenderer.create> | null = null;
  await ReactTestRenderer.act(() => {
    renderer = ReactTestRenderer.create(
      <DebugOverlay
        rawGaze={{ x: 0.25, y: 0.3 }}
        calibratedGaze={{ x: 0.7, y: 0.8 }}
      />,
    );
  });

  const root = renderer!.root;
  expect(root.findByProps({ 'aria-label': 'Raw gaze' }).props.style).toEqual({ left: '75%', top: '30%' });
  expect(root.findByProps({ 'aria-label': 'Calibrated gaze' }).props.style).toEqual({ left: '70%', top: '80%' });
  expect(root.findByProps({ 'aria-label': 'Eye tracking debug overlay' })).toBeDefined();
});

test('shows the communication target beneath the mouse cursor', async () => {
  const card = { querySelector: () => ({ textContent: 'Water' }) };
  const elementFromPoint = jest.fn().mockReturnValue({ closest: () => card });
  Object.defineProperty(globalThis, 'document', { configurable: true, value: { elementFromPoint } });
  const addEventListener = jest.fn();
  Object.assign(window, { addEventListener, removeEventListener: jest.fn() });
  let renderer: ReturnType<typeof ReactTestRenderer.create> | null = null;
  await ReactTestRenderer.act(() => {
    renderer = ReactTestRenderer.create(<DebugOverlay rawGaze={null} calibratedGaze={null} />);
  });
  const pointerMove = addEventListener.mock.calls[0][1] as (event: PointerEvent) => void;
  await ReactTestRenderer.act(() => pointerMove({ clientX: 100, clientY: 200 } as PointerEvent));

  expect(renderer!.root.findByProps({ className: 'debug-overlay__target' }).children).toEqual(['Target: ', 'Water']);
});