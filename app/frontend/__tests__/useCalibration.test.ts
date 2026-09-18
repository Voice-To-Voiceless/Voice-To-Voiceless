import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import {
  CALIBRATION_SAMPLE_DURATION_MS,
  CALIBRATION_SETTLE_DURATION_MS,
  CALIBRATION_TARGETS,
  useCalibration,
} from '../src/browser/hooks/useCalibration';
import { ModelTestingSession } from '../src/modelTesting/modelTestingSession';
import { NormalizedGazePoint } from '../src/vision/gazeTypes';

type CalibrationHandle = ReturnType<typeof useCalibration>;

function createGaze(x: number, y: number, timestamp: number): NormalizedGazePoint {
  return { x, y, confidence: 0.9, timestamp };
}

function renderCalibration(session?: ModelTestingSession): { handle: CalibrationHandle; unmount: () => void } {
  let handle: CalibrationHandle | null = null;
  let renderer: ReactTestRenderer.ReactTestRenderer;
  ReactTestRenderer.act(() => {
    renderer = ReactTestRenderer.create(
      React.createElement(CalibrationHarness, {
        session,
        onRender: value => { handle = value; },
      }),
    );
  });

  if (handle === null) {
    throw new Error('Calibration hook did not render');
  }
  return { handle, unmount: () => renderer.unmount() };
}

function CalibrationHarness({ session, onRender }: { session?: ModelTestingSession; onRender: (value: CalibrationHandle) => void }) {
  const calibration = useCalibration(session);
  onRender(calibration);
  return null;
}

function completeCalibration(handle: CalibrationHandle, gazeForTarget: (index: number) => NormalizedGazePoint): void {
  let timestamp = 0;
  handle.start();
  for (let index = 0; index < CALIBRATION_TARGETS.length; index += 1) {
    timestamp += CALIBRATION_SETTLE_DURATION_MS;
    for (let sampleIndex = 0; sampleIndex < 20; sampleIndex += 1) {
      handle.process(gazeForTarget(index), timestamp + sampleIndex);
    }
    timestamp += CALIBRATION_SAMPLE_DURATION_MS;
    handle.process(gazeForTarget(index), timestamp);
  }
}

beforeEach(() => {
  jest.spyOn(performance, 'now').mockReturnValue(0);
});

afterEach(() => {
  jest.restoreAllMocks();
});

test('ignores settle samples and resets the point buffer between targets', () => {
  const recordPrimarySample = jest.fn();
  const session = {
    reset: jest.fn(),
    startPass: jest.fn(() => ({ id: 0, kind: 'training', targetOrder: CALIBRATION_TARGETS })),
    nextPassKind: 'training',
    recordPrimarySample,
    recordCalibrationSample: jest.fn(),
    recordQualityDecision: jest.fn(),
    completePass: jest.fn(),
  } as unknown as ModelTestingSession;
  const { handle, unmount } = renderCalibration(session);
  handle.start();

  handle.process(createGaze(0.1, 0.1, 100), CALIBRATION_SETTLE_DURATION_MS - 1);
  expect(recordPrimarySample).not.toHaveBeenCalled();

  handle.process(createGaze(0.1, 0.1, 101), CALIBRATION_SETTLE_DURATION_MS);
  expect(recordPrimarySample).toHaveBeenCalledTimes(1);

  for (let sampleIndex = 1; sampleIndex < 20; sampleIndex += 1) {
    handle.process(createGaze(0.1, 0.1, 102), CALIBRATION_SETTLE_DURATION_MS + sampleIndex);
  }
  handle.process(createGaze(0.1, 0.1, 102), CALIBRATION_SETTLE_DURATION_MS + CALIBRATION_SAMPLE_DURATION_MS);
  handle.process(createGaze(0.5, 0.1, 103), CALIBRATION_SETTLE_DURATION_MS * 2 + CALIBRATION_SAMPLE_DURATION_MS);
  for (let sampleIndex = 1; sampleIndex < 20; sampleIndex += 1) {
    handle.process(createGaze(0.5, 0.1, 103), CALIBRATION_SETTLE_DURATION_MS * 2 + CALIBRATION_SAMPLE_DURATION_MS + sampleIndex);
  }
  expect(recordPrimarySample).toHaveBeenCalledTimes(40);

  unmount();
});

test('installs a mapper after every target has a stable sample', () => {
  const { handle, unmount } = renderCalibration();
  completeCalibration(handle, index => createGaze(CALIBRATION_TARGETS[index].x, CALIBRATION_TARGETS[index].y, index));

  expect(handle.mapper.current).not.toBeNull();
  expect(handle.readyRef.current).toBe(true);
  expect(handle.state.active).toBe(false);
  unmount();
});

test('uses reversed target order for validation and preserves the training mapper', () => {
  const session = new ModelTestingSession();
  const { handle, unmount } = renderCalibration(session);

  completeCalibration(handle, index => createGaze(CALIBRATION_TARGETS[index].x, CALIBRATION_TARGETS[index].y, index));
  const trainingMapper = handle.mapper.current;
  expect(trainingMapper).not.toBeNull();

  expect(session.nextPassKind).toBe('validation');
  handle.start();
  expect(handle.mapper.current).toBe(trainingMapper);
  unmount();
});

test('defines distinct training and validation target orders', () => {
  const session = new ModelTestingSession();
  const training = session.startPass(CALIBRATION_TARGETS);
  const validation = session.startPass([...CALIBRATION_TARGETS].reverse());

  expect(training?.kind).toBe('training');
  expect(validation?.kind).toBe('validation');
  expect(validation?.targetOrder).toEqual([...CALIBRATION_TARGETS].reverse());
});

test('leaves calibrated mode unavailable when the fit is rejected', () => {
  const { handle, unmount } = renderCalibration();
  completeCalibration(handle, () => createGaze(0.5, 0.5, 0));

  expect(handle.mapper.current).toBeNull();
  expect(handle.readyRef.current).toBe(false);
  expect(handle.state.active).toBe(false);
  unmount();
});

test('resets the sample window when no samples arrive', () => {
  const { handle, unmount } = renderCalibration();
  handle.start();

  const result = handle.process(
    createGaze(0.1, 0.1, 0),
    CALIBRATION_SETTLE_DURATION_MS + CALIBRATION_SAMPLE_DURATION_MS,
  );

  expect(result.resetSmoother).toBe(true);
  expect(result.complete).toBe(true);
  expect(handle.indexRef.current).toBe(0);
  unmount();
});
