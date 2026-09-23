import { getEyePositionDiagnostics } from '../../src/vision/estimation/eyePosition';
import { findGazeTarget } from '../../src/vision/estimation/gazeTarget';

test('compares projected and direct midpoint iris horizontal positions', () => {
  const diagnostics = getEyePositionDiagnostics({
    innerCorner: { x: 0.2, y: 0.4 },
    outerCorner: { x: 0.4, y: 0.4 },
    upperLid: { x: 0.3, y: 0.3 },
    lowerLid: { x: 0.3, y: 0.5 },
    irisCenter: { x: 0.34, y: 0.4 },
    confidence: 0.9,
  });

  expect(diagnostics.eyeMidpoint).toEqual({ x: 0.30000000000000004, y: 0.4 });
  expect(diagnostics.eyeWidth).toBeCloseTo(0.2);
  expect(diagnostics.position?.x).toBeCloseTo(0.7);
  expect(diagnostics.position?.y).toBeCloseTo(0.5);
  expect(diagnostics.directHorizontalPosition).toBeCloseTo(0.7);
  expect(diagnostics.verticalFeatureCandidates.eyelidRelative).toBeCloseTo(0.5);
  expect(diagnostics.verticalFeatureCandidates.cornerMidpoint).toBeCloseTo(0.5);
});

test('normalizes vertical iris position from the eye-corner midpoint and eye width', () => {
  const diagnostics = getEyePositionDiagnostics({
    innerCorner: { x: 0.2, y: 0.4 },
    outerCorner: { x: 0.4, y: 0.4 },
    upperLid: { x: 0.3, y: 0.3 },
    lowerLid: { x: 0.3, y: 0.5 },
    irisCenter: { x: 0.3, y: 0.5 },
    confidence: 0.9,
  });

  expect(diagnostics.position?.y).toBeCloseTo(1);
});

test('reports iris-ring and depth vertical feature candidates', () => {
  const diagnostics = getEyePositionDiagnostics({
    innerCorner: { x: 0.2, y: 0.4, z: 0.1 },
    outerCorner: { x: 0.4, y: 0.4, z: 0.1 },
    upperLid: { x: 0.3, y: 0.3, z: 0.05 },
    lowerLid: { x: 0.3, y: 0.5, z: 0.05 },
    irisCenter: { x: 0.3, y: 0.4, z: 0.08 },
    irisRing: [
      { x: 0.3, y: 0.4, z: 0.08 },
      { x: 0.3, y: 0.41, z: 0.08 },
    ],
    confidence: 0.9,
  });

  expect(diagnostics.verticalFeatureCandidates.irisRing).toBeCloseTo(0.525);
  expect(diagnostics.verticalFeatureCandidates.irisDepth).toBeCloseTo(-0.02);
});

test('normalizes mapped eyes into the same screen-horizontal direction', () => {
  const baseEye = {
    innerCorner: { x: 0.4, y: 0.4 },
    outerCorner: { x: 0.2, y: 0.4 },
    upperLid: { x: 0.3, y: 0.3 },
    lowerLid: { x: 0.3, y: 0.5 },
    irisCenter: { x: 0.35, y: 0.4 },
    confidence: 0.9,
  };
  const screenLeft = getEyePositionDiagnostics({ ...baseEye, screenSide: 'left' });
  const screenRight = getEyePositionDiagnostics({
    ...baseEye,
    innerCorner: { x: 0.6, y: 0.4 },
    outerCorner: { x: 0.8, y: 0.4 },
    irisCenter: { x: 0.75, y: 0.4 },
    screenSide: 'right',
  });

  expect(screenLeft.position?.x).toBeCloseTo(0.75);
  expect(screenRight.position?.x).toBeCloseTo(0.75);
  expect(screenLeft.directHorizontalPosition).toBeCloseTo(0.75);
  expect(screenRight.directHorizontalPosition).toBeCloseTo(0.75);
});

test('selects the nearest normalized card and rejects outside or ambiguous points', () => {
  const targets = [
    { id: 'left', left: 0.1, top: 0.4, right: 0.4, bottom: 0.6 },
    { id: 'right', left: 0.6, top: 0.4, right: 0.9, bottom: 0.6 },
  ];

  expect(findGazeTarget({ x: 0.28, y: 0.5, confidence: 1, timestamp: 0 }, targets)).toBe('left');
  expect(findGazeTarget({ x: 0.5, y: 0.5, confidence: 1, timestamp: 0 }, targets)).toBeNull();
  expect(findGazeTarget({ x: 0.05, y: 0.5, confidence: 1, timestamp: 0 }, targets)).toBeNull();
});