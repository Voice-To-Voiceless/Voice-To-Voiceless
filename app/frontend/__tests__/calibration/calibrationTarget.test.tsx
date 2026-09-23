import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import { CalibrationTarget } from '../../src/browser/components/CalibrationTarget';

test('renders validation calibration target with the blue target class', () => {
  let renderer: ReactTestRenderer.ReactTestRenderer | null = null;
  ReactTestRenderer.act(() => {
    renderer = ReactTestRenderer.create(
      <CalibrationTarget gazePoint={null} target={{ x: 0.9, y: 0.1 }} progress={0.5} passKind="validation" />,
    );
  });

  expect(renderer!.root.findByProps({ 'aria-hidden': 'true' }).props.className).toBe('calibration-target calibration-target--validation');
});