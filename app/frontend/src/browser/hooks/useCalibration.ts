import { useCallback, useRef, useState } from 'react';
import { GazeCalibrationMapper, CalibrationSample, getCalibrationFitDiagnostics } from '../../vision/gazeCalibration';
import { NormalizedGazePoint } from '../../vision/gazeTypes';
import { getPoseConditionedCalibrationFitDiagnostics } from '../../vision/poseCalibrationDiagnostics';

export const CALIBRATION_TARGETS = [
  { x: 0.1, y: 0.1 }, { x: 0.5, y: 0.1 }, { x: 0.9, y: 0.1 },
  { x: 0.1, y: 0.5 }, { x: 0.5, y: 0.5 }, { x: 0.9, y: 0.5 },
  { x: 0.1, y: 0.9 }, { x: 0.5, y: 0.9 }, { x: 0.9, y: 0.9 },
];

export const CALIBRATION_SETTLE_DURATION_MS = 1800;
export const CALIBRATION_SAMPLE_DURATION_MS = 900;

type CalibrationState = { active: boolean; index: number; ready: boolean };
type CalibrationResult = {
  target: { x: number; y: number } | null;
  status: string | null;
  complete: boolean;
  settleProgress: number;
  resetSmoother: boolean;
};

type CalibrationDiagnosticPoints = {
  raw: NormalizedGazePoint;
  compensated: NormalizedGazePoint;
  pose: { yaw: number; pitch: number } | null;
};

export function useCalibration() {
  const [state, setState] = useState<CalibrationState>({ active: false, index: 0, ready: false });
  const activeRef = useRef(false);
  const indexRef = useRef(0);
  const readyRef = useRef(false);
  const mapperRef = useRef<GazeCalibrationMapper | null>(null);
  const dataRef = useRef({
    started: 0,
    all: [] as CalibrationSample[],
    point: [] as CalibrationSample[],
    raw: [] as CalibrationSample[],
    compensated: [] as CalibrationSample[],
    poseConditioned: [] as Array<CalibrationSample & { pose: { yaw: number; pitch: number } }>,
  });

  const start = useCallback(() => {
    mapperRef.current = null;
    activeRef.current = true;
    indexRef.current = 0;
    readyRef.current = false;
    dataRef.current = { started: performance.now(), all: [], point: [], raw: [], compensated: [], poseConditioned: [] };
    setState({ active: true, index: 0, ready: false });
  }, []);

  const reset = useCallback(() => {
    dataRef.current = { started: 0, all: [], point: [], raw: [], compensated: [], poseConditioned: [] };
    activeRef.current = false;
    indexRef.current = 0;
    setState(value => ({ ...value, active: false }));
  }, []);

  const process = useCallback((gaze: NormalizedGazePoint, timestamp: number, diagnosticPoints?: CalibrationDiagnosticPoints): CalibrationResult => {
    const index = indexRef.current;
    const target = CALIBRATION_TARGETS[index];
    const elapsed = timestamp - dataRef.current.started;
    const settleProgress = Math.min(1, Math.max(0, elapsed / CALIBRATION_SETTLE_DURATION_MS));
    if (elapsed >= CALIBRATION_SETTLE_DURATION_MS && elapsed < CALIBRATION_SETTLE_DURATION_MS + CALIBRATION_SAMPLE_DURATION_MS) {
      const sample = { gaze, target };
      dataRef.current.point.push(sample);
      dataRef.current.all.push(sample);
      if (diagnosticPoints) {
        dataRef.current.raw.push({ gaze: diagnosticPoints.raw, target });
        dataRef.current.compensated.push({ gaze: diagnosticPoints.compensated, target });
        if (diagnosticPoints.pose !== null) dataRef.current.poseConditioned.push({ gaze: diagnosticPoints.raw, target, pose: diagnosticPoints.pose });
      }
    }
    if (elapsed < CALIBRATION_SETTLE_DURATION_MS) {
      return {
        target,
        status: `Calibration point ${index + 1} of ${CALIBRATION_TARGETS.length}. Hold your gaze on the dot.`,
        complete: false,
        settleProgress,
        resetSmoother: false,
      };
    }
    if (elapsed < CALIBRATION_SETTLE_DURATION_MS + CALIBRATION_SAMPLE_DURATION_MS) {
      return { target, status: 'Hold steady. Recording your gaze.', complete: false, settleProgress: 1, resetSmoother: false };
    }
    if (dataRef.current.point.length === 0) {
      dataRef.current.started = timestamp;
      return { target, status: 'No stable gaze detected. Keep looking at the yellow dot.', complete: false, settleProgress: 0, resetSmoother: true };
    }
    if (index === CALIBRATION_TARGETS.length - 1) {
      mapperRef.current = GazeCalibrationMapper.fit(dataRef.current.all);
      downloadCalibrationFitComparison({
        smoothed: getCalibrationFitDiagnostics(dataRef.current.all),
        raw: getCalibrationFitDiagnostics(dataRef.current.raw),
        compensated: getCalibrationFitDiagnostics(dataRef.current.compensated),
        poseConditioned: getPoseConditionedCalibrationFitDiagnostics(dataRef.current.poseConditioned),
      });
      activeRef.current = false;
      readyRef.current = mapperRef.current !== null;
      console.info('[gaze-calibration] completed', {
        sampleCount: dataRef.current.all.length,
        targetCount: CALIBRATION_TARGETS.length,
        mapperReady: readyRef.current,
      });
      setState({ active: false, index, ready: readyRef.current });
      return {
        target: null,
        status: mapperRef.current ? 'Calibration complete. Look at a communication action.' : 'Calibration failed. Try again.',
        complete: true,
        settleProgress: 0,
        resetSmoother: false,
      };
    }
    dataRef.current.started = timestamp;
    dataRef.current.point = [];
    indexRef.current += 1;
    setState(value => ({ ...value, index: indexRef.current }));
    return { target, status: null, complete: false, settleProgress: 0, resetSmoother: true };
  }, []);

  return { state, activeRef, indexRef, readyRef, mapper: mapperRef, start, reset, process };
}

function downloadCalibrationFitComparison(comparison: Record<string, unknown>): void {
  if (typeof document === 'undefined' || typeof Blob === 'undefined' || typeof URL === 'undefined' || typeof URL.createObjectURL !== 'function') return;
  const blob = new Blob([JSON.stringify(comparison, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `gaze-calibration-fit-comparison-${Date.now()}.json`;
  link.click();
  URL.revokeObjectURL(url);
}
