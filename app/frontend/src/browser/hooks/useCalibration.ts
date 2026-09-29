import { useCallback, useRef, useState } from 'react';
import { GazeCalibrationMapper, CalibrationSample } from '../../vision/calibration/gazeCalibration';
import { NormalizedGazePoint } from '../../vision/types/gazeTypes';
import { CalibrationDiagnosticPoints, CalibrationPassKind, ModelTestingSession } from '../../modelTesting/modelTestingSession';
import { DEFAULT_CALIBRATION_QUALITY_POLICY } from '../../vision/calibration/calibrationQuality';
import { GazeCalibrationMapperLike } from '../../vision/calibration/gazeCalibration';
import { ExternalCalibrationBackend } from '../../vision/webgazer/webgazerCalibration';

export const CALIBRATION_TARGETS = [
  { x: 0.1, y: 0.1 }, { x: 0.5, y: 0.1 }, { x: 0.9, y: 0.1 },
  { x: 0.1, y: 0.5 }, { x: 0.5, y: 0.5 }, { x: 0.9, y: 0.5 },
  { x: 0.1, y: 0.9 }, { x: 0.5, y: 0.9 }, { x: 0.9, y: 0.9 },
];

export const CALIBRATION_SETTLE_DURATION_MS = 1800;
// Keep calibration practical while allowing the current L2CS stream to collect
// as many accepted samples as its ~4 estimates/s throughput permits.
export const CALIBRATION_SAMPLE_DURATION_MS = 3000;
export const CALIBRATION_MAX_RECORDING_DURATION_MS = CALIBRATION_SAMPLE_DURATION_MS;
const L2CS_MINIMUM_ACCEPTED_SAMPLES_PER_TARGET = 10;
export const CALIBRATION_INTERLEAVED_TARGETS = [CALIBRATION_TARGETS[4], CALIBRATION_TARGETS[1], CALIBRATION_TARGETS[7], CALIBRATION_TARGETS[3], CALIBRATION_TARGETS[5], CALIBRATION_TARGETS[0], CALIBRATION_TARGETS[2], CALIBRATION_TARGETS[6], CALIBRATION_TARGETS[8]] as const;
export const CALIBRATION_TARGET_ORDERS = [
  CALIBRATION_INTERLEAVED_TARGETS,
  [...CALIBRATION_INTERLEAVED_TARGETS].reverse(),
] as const;

type CalibrationState = { active: boolean; index: number; ready: boolean };
type CalibrationResult = {
  target: { x: number; y: number } | null;
  status: string | null;
  complete: boolean;
  settleProgress: number;
  resetSmoother: boolean;
  failed?: boolean;
};

export function useCalibration(modelTestingSession?: ModelTestingSession, calibrationBackendRef?: { current: ExternalCalibrationBackend | null }) {
  const [state, setState] = useState<CalibrationState>({ active: false, index: 0, ready: false });
  const activeRef = useRef(false);
  const indexRef = useRef(0);
  const readyRef = useRef(false);
  const mapperRef = useRef<GazeCalibrationMapperLike | null>(null);
  const passKindRef = useRef<CalibrationPassKind>('training');
  const targetsRef = useRef(CALIBRATION_TARGETS);
  const trainingSamplesRef = useRef<CalibrationSample[]>([]);
  const lastSampleTimestampRef = useRef(Number.NEGATIVE_INFINITY);
  const dataRef = useRef({
    started: 0,
    all: [] as CalibrationSample[],
    point: [] as CalibrationSample[],
    poseSource: null as CalibrationDiagnosticPoints['poseSource'],
  });

  const start = useCallback(() => {
    if (activeRef.current) return;
    if (!modelTestingSession) mapperRef.current = null;
    const nextPassKind = modelTestingSession?.nextPassKind;
    const pass = nextPassKind
      ? modelTestingSession?.startPass(nextPassKind === 'training' ? [...CALIBRATION_TARGET_ORDERS[0]] : [...CALIBRATION_TARGET_ORDERS[1]])
      : null;
    if (pass) {
      passKindRef.current = pass.kind;
      targetsRef.current = pass.targetOrder;
    } else {
      passKindRef.current = 'training';
      targetsRef.current = CALIBRATION_TARGETS;
    }
    const isValidation = passKindRef.current === 'validation';
    const retainingValidatedMapper = !nextPassKind && mapperRef.current !== null;
    activeRef.current = true;
    indexRef.current = 0;
    if (!isValidation && !retainingValidatedMapper) readyRef.current = false;
    dataRef.current = { started: performance.now(), all: [], point: [], poseSource: null };
    lastSampleTimestampRef.current = Number.NEGATIVE_INFINITY;
    setState({ active: true, index: 0, ready: readyRef.current });
  }, [modelTestingSession]);

  const reset = useCallback(() => {
    modelTestingSession?.reset();
    dataRef.current = { started: 0, all: [], point: [], poseSource: null };
    activeRef.current = false;
    indexRef.current = 0;
    setState(value => ({ ...value, active: false }));
  }, [modelTestingSession]);

  const pause = useCallback((timestamp: number) => {
    if (activeRef.current) dataRef.current.started = timestamp;
  }, []);

  const process = useCallback((gaze: NormalizedGazePoint, timestamp: number, diagnosticPoints?: CalibrationDiagnosticPoints): CalibrationResult => {
    const index = indexRef.current;
    const target = targetsRef.current[index];
    const elapsed = timestamp - dataRef.current.started;
    const settleProgress = Math.min(1, Math.max(0, elapsed / CALIBRATION_SETTLE_DURATION_MS));
    if (elapsed >= CALIBRATION_SETTLE_DURATION_MS && elapsed < CALIBRATION_SETTLE_DURATION_MS + CALIBRATION_SAMPLE_DURATION_MS) {
      if (diagnosticPoints?.poseSource && dataRef.current.poseSource && (Math.abs((diagnosticPoints.poseSource.faceCenterY ?? 0) - (dataRef.current.poseSource.faceCenterY ?? 0)) > 0.02 || Math.abs((diagnosticPoints.poseSource.pitch ?? 0) - (dataRef.current.poseSource.pitch ?? 0)) > 0.08)) {
        dataRef.current.point = [];
        dataRef.current.poseSource = null;
        lastSampleTimestampRef.current = Number.NEGATIVE_INFINITY;
        return { target, status: 'Hold still and keep your face centered.', complete: false, settleProgress: 1, resetSmoother: true };
      }
      const sample = { gaze, target, features: diagnosticPoints?.features };
      const quality = diagnosticPoints?.quality;
      if (quality) modelTestingSession?.recordQualityDecision(index, quality);
      const acceptedSample = (!quality || quality.accepted) && gaze.timestamp > lastSampleTimestampRef.current;
      const recordedByBackend = acceptedSample && passKindRef.current === 'training' && calibrationBackendRef?.current
        ? calibrationBackendRef.current.recordTrainingSample(sample)
        : acceptedSample;
      if (acceptedSample && !recordedByBackend) {
        dataRef.current.started = timestamp - CALIBRATION_SETTLE_DURATION_MS;
        return { target, status: 'Waiting for WebGazer to detect your eyes.', complete: false, settleProgress: 1, resetSmoother: false };
      }
      if (recordedByBackend) {
        lastSampleTimestampRef.current = gaze.timestamp;
        dataRef.current.point.push(sample);
        dataRef.current.all.push(sample);
        if (!dataRef.current.poseSource) dataRef.current.poseSource = diagnosticPoints?.poseSource ?? null;
        modelTestingSession?.recordPrimarySample(sample);
        if (diagnosticPoints) modelTestingSession?.recordCalibrationSample(target, diagnosticPoints);
      }
    }
    if (elapsed < CALIBRATION_SETTLE_DURATION_MS) {
      return {
        target,
        status: `Calibration point ${index + 1} of ${targetsRef.current.length}. Hold your gaze on the dot.`,
        complete: false,
        settleProgress,
        resetSmoother: false,
      };
    }
    if (elapsed < CALIBRATION_SETTLE_DURATION_MS + CALIBRATION_SAMPLE_DURATION_MS) {
      return { target, status: 'Hold steady. Recording your gaze.', complete: false, settleProgress: 1, resetSmoother: false };
    }
    const usesL2CS = dataRef.current.point.some(sample => sample.features?.l2csYaw !== undefined && sample.features?.l2csPitch !== undefined);
    const minimumAcceptedSamples = calibrationBackendRef?.current
      ? 6
      : usesL2CS
      ? L2CS_MINIMUM_ACCEPTED_SAMPLES_PER_TARGET
      : DEFAULT_CALIBRATION_QUALITY_POLICY.minimumAcceptedSamplesPerTarget;
    if (dataRef.current.point.length < minimumAcceptedSamples) {
      dataRef.current.started = timestamp;
      modelTestingSession?.exportDiagnostics();
      modelTestingSession?.discardCurrentPass();
      mapperRef.current = null;
      activeRef.current = false;
      readyRef.current = false;
      setState({ active: false, index, ready: readyRef.current });
      return { target: null, status: 'Calibration failed. Hold your gaze steadily on each dot.', complete: false, settleProgress: 0, resetSmoother: true, failed: true };
    }
    if (index === targetsRef.current.length - 1) {
      const completedPassKind = passKindRef.current;
      if (passKindRef.current === 'training') {
        mapperRef.current = calibrationBackendRef?.current
          ? calibrationBackendRef.current.fitTraining(dataRef.current.all)
          : GazeCalibrationMapper.fit(dataRef.current.all);
        trainingSamplesRef.current = dataRef.current.all;
      } else if (trainingSamplesRef.current.length > 0) {
        if (calibrationBackendRef?.current) {
          mapperRef.current = calibrationBackendRef.current.fitWithValidationDetailed(trainingSamplesRef.current, dataRef.current.all).mapper;
        } else {
          mapperRef.current = GazeCalibrationMapper.fitWithValidation(trainingSamplesRef.current, dataRef.current.all)?.mapper ?? null;
        }
      }
      if (passKindRef.current === 'training' && mapperRef.current) {
        modelTestingSession?.completePass();
        modelTestingSession?.startPass([...CALIBRATION_TARGET_ORDERS[1]]);
        passKindRef.current = 'validation';
        targetsRef.current = CALIBRATION_TARGET_ORDERS[1];
        activeRef.current = true;
        indexRef.current = 0;
        dataRef.current = { started: timestamp, all: [], point: [], poseSource: null };
        setState({ active: true, index: 0, ready: false });
        return {
          target: targetsRef.current[0],
          status: 'Training complete. Continue with the validation pass before gaze selection.',
          complete: false,
          settleProgress: 0,
          resetSmoother: true,
        };
      }
      modelTestingSession?.completePass();
      if (completedPassKind === 'validation') modelTestingSession?.exportDiagnostics();
      activeRef.current = false;
      readyRef.current = mapperRef.current !== null;
      console.info('[gaze-calibration] completed', {
        sampleCount: dataRef.current.all.length,
        targetCount: targetsRef.current.length,
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
    dataRef.current.poseSource = null;
    lastSampleTimestampRef.current = Number.NEGATIVE_INFINITY;
    indexRef.current += 1;
    setState(value => ({ ...value, index: indexRef.current }));
    return { target, status: null, complete: false, settleProgress: 0, resetSmoother: true };
  }, [calibrationBackendRef, modelTestingSession]);

  return { state, activeRef, indexRef, readyRef, mapper: mapperRef, targetsRef, passKindRef, start, reset, pause, process };
}
