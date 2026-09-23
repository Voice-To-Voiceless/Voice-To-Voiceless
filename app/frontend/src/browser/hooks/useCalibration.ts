import { useCallback, useRef, useState } from 'react';
import { GazeCalibrationMapper, CalibrationSample } from '../../vision/calibration/gazeCalibration';
import { NormalizedGazePoint } from '../../vision/types/gazeTypes';
import { CalibrationDiagnosticPoints, CalibrationPassKind, ModelTestingSession } from '../../modelTesting/modelTestingSession';
import { DEFAULT_CALIBRATION_QUALITY_POLICY } from '../../vision/calibration/calibrationQuality';
import { createPoseEnvelope, extendPoseEnvelope, PoseEnvelope } from '../../vision/tracking/poseEnvelope';
import { CALIBRATION_MAX_RECORDING_DURATION_MS, CALIBRATION_SAMPLE_DURATION_MS, CALIBRATION_SETTLE_DURATION_MS, CALIBRATION_TARGET_ORDERS, CALIBRATION_TARGETS, type CalibrationResult, type CalibrationState } from './calibrationConfig';

export { CALIBRATION_MAX_RECORDING_DURATION_MS, CALIBRATION_SAMPLE_DURATION_MS, CALIBRATION_SETTLE_DURATION_MS, CALIBRATION_TARGET_ORDERS, CALIBRATION_TARGETS } from './calibrationConfig';
export function useCalibration(modelTestingSession?: ModelTestingSession) {
  const [state, setState] = useState<CalibrationState>({ active: false, index: 0, ready: false });
  const activeRef = useRef(false);
  const indexRef = useRef(0);
  const readyRef = useRef(false);
  const mapperRef = useRef<GazeCalibrationMapper | null>(null);
  const poseEnvelopeRef = useRef<PoseEnvelope | null>(null);
  const passKindRef = useRef<CalibrationPassKind>('training');
  const failedRef = useRef(false);
  const failureRef = useRef<string | null>(null);
  const pausedAtRef = useRef<number | null>(null);
  const targetsRef = useRef(CALIBRATION_TARGETS);
  const dataRef = useRef({ started: 0, all: [] as CalibrationSample[], point: [] as CalibrationSample[], rejected: 0, rejectionReasons: {} as Record<string, number>, poseEnvelope: null as PoseEnvelope | null });
  const trainingSamplesRef = useRef<CalibrationSample[]>([]);
  const start = useCallback(() => {
    if (activeRef.current) return;
    failedRef.current = false;
    failureRef.current = null;
    pausedAtRef.current = null;
    if (!modelTestingSession) mapperRef.current = null;
    const nextPassKind = modelTestingSession?.nextPassKind;
    const pass = nextPassKind
      ? modelTestingSession?.startPass(nextPassKind === 'training' ? CALIBRATION_TARGET_ORDERS[0] : CALIBRATION_TARGET_ORDERS[1])
      : null;
    if (pass) {
      passKindRef.current = pass.kind;
      targetsRef.current = pass.targetOrder;
    } else {
      passKindRef.current = 'training';
      targetsRef.current = CALIBRATION_TARGETS;
    }
    const isValidation = passKindRef.current === 'validation';
    activeRef.current = true;
    indexRef.current = 0;
    if (!isValidation) readyRef.current = false;
    dataRef.current = { started: performance.now(), all: [], point: [], rejected: 0, rejectionReasons: {}, poseEnvelope: null };
    if (passKindRef.current === 'training') { trainingSamplesRef.current = []; poseEnvelopeRef.current = createPoseEnvelope(); }
    setState({ active: true, index: 0, ready: readyRef.current });
  }, [modelTestingSession]);
  const reset = useCallback(() => {
    modelTestingSession?.reset();
    dataRef.current = { started: 0, all: [], point: [], rejected: 0, rejectionReasons: {}, poseEnvelope: null };
    trainingSamplesRef.current = [];
    poseEnvelopeRef.current = null;
    activeRef.current = false;
    failedRef.current = false;
    failureRef.current = null;
    pausedAtRef.current = null;
    indexRef.current = 0;
    setState(value => ({ ...value, active: false }));
  }, [modelTestingSession]);
  const pause = useCallback((timestamp: number) => {
    if (activeRef.current && pausedAtRef.current === null) pausedAtRef.current = timestamp;
  }, []);
  const process = useCallback((gaze: NormalizedGazePoint, timestamp: number, diagnosticPoints?: CalibrationDiagnosticPoints): CalibrationResult => {
    const index = indexRef.current;
    const target = targetsRef.current[index];
    if (!target) {
      activeRef.current = false;
      setState({ active: false, index, ready: readyRef.current });
      return { target: null, passKind: null, status: 'Calibration stopped. Please start again.', complete: true, settleProgress: 0, resetSmoother: true };
    }
    if (pausedAtRef.current !== null) {
      dataRef.current.started += timestamp - pausedAtRef.current;
      pausedAtRef.current = null;
    }
    const elapsed = timestamp - dataRef.current.started;
    const settleProgress = Math.min(1, Math.max(0, elapsed / CALIBRATION_SETTLE_DURATION_MS));
    if (elapsed >= CALIBRATION_SETTLE_DURATION_MS && elapsed < CALIBRATION_SETTLE_DURATION_MS + CALIBRATION_SAMPLE_DURATION_MS) {
      const sample = { gaze, target, features: diagnosticPoints?.features };
      const quality = diagnosticPoints?.quality;
      if (quality) modelTestingSession?.recordQualityDecision(index, quality);
      if (!quality || quality.accepted) {
        dataRef.current.point.push(sample);
        dataRef.current.all.push(sample);
        modelTestingSession?.recordPrimarySample(sample);
        if (diagnosticPoints) modelTestingSession?.recordCalibrationSample(target, diagnosticPoints);
        if (passKindRef.current === 'training' && diagnosticPoints?.poseSource) {
          dataRef.current.poseEnvelope = extendPoseEnvelope(dataRef.current.poseEnvelope, diagnosticPoints.poseSource);
        }
      } else {
        dataRef.current.rejected += 1;
        quality.rejectionReasons.forEach(reason => {
          dataRef.current.rejectionReasons[reason] = (dataRef.current.rejectionReasons[reason] ?? 0) + 1;
        });
      }
    }
    if (elapsed < CALIBRATION_SETTLE_DURATION_MS) {
      return {
        target,
        passKind: passKindRef.current,
        status: `Calibration point ${index + 1} of ${targetsRef.current.length}. Hold your gaze on the dot.`,
        complete: false,
        settleProgress,
        resetSmoother: false,
      };
    }
    const minimumSamples = DEFAULT_CALIBRATION_QUALITY_POLICY.minimumAcceptedSamplesPerTarget;
    const recordingDeadline = CALIBRATION_SETTLE_DURATION_MS + CALIBRATION_MAX_RECORDING_DURATION_MS;
    if (elapsed < CALIBRATION_SETTLE_DURATION_MS + CALIBRATION_SAMPLE_DURATION_MS || (dataRef.current.point.length < minimumSamples && elapsed < recordingDeadline)) {
      return { target, passKind: passKindRef.current, status: `Hold steady. Recording your gaze (${dataRef.current.point.length}/${DEFAULT_CALIBRATION_QUALITY_POLICY.minimumAcceptedSamplesPerTarget}).`, complete: false, settleProgress: 1, resetSmoother: false };
    }
    if (dataRef.current.point.length < minimumSamples) {
      const accepted = dataRef.current.point.length;
      const reasons = Object.entries(dataRef.current.rejectionReasons).sort((left, right) => right[1] - left[1]).slice(0, 2).map(([reason, count]) => `${reason} (${count})`).join(', ');
      const message = `Calibration paused at point ${index + 1}. Only ${accepted}/${minimumSamples} valid samples were captured${reasons ? `; rejected: ${reasons}` : ''}. Adjust your face or eyes, then retry.`;
      modelTestingSession?.discardCurrentPass?.();
      if (passKindRef.current === 'training' || !modelTestingSession) mapperRef.current = null;
      activeRef.current = false;
      failedRef.current = true;
      failureRef.current = message;
      if (passKindRef.current === 'training' || !modelTestingSession) readyRef.current = false;
      setState({ active: false, index, ready: readyRef.current });
      return { target, passKind: passKindRef.current, status: message, complete: false, settleProgress: 1, resetSmoother: true, failed: true };
    }
    if (index === targetsRef.current.length - 1) {
      if (passKindRef.current === 'training' || !modelTestingSession) {
        try {
          mapperRef.current = GazeCalibrationMapper.fit(dataRef.current.all);
        } catch (error) {
          mapperRef.current = null;
          console.error('[gaze-calibration] mapper fit failed', error);
        }
      }
      if (passKindRef.current === 'training') trainingSamplesRef.current = [...dataRef.current.all];
      if (passKindRef.current === 'training') poseEnvelopeRef.current = dataRef.current.poseEnvelope;
      try {
        modelTestingSession?.completePass();
      } catch (error) {
        console.error('[gaze-calibration] diagnostics export failed', error);
      }
      if (passKindRef.current === 'training' && modelTestingSession?.nextPassKind === 'validation') {
        const validationPass = modelTestingSession.startPass(CALIBRATION_TARGET_ORDERS[1]);
        if (validationPass) {
          passKindRef.current = validationPass.kind;
          targetsRef.current = validationPass.targetOrder;
          activeRef.current = true;
          indexRef.current = 0;
          dataRef.current = { started: timestamp, all: [], point: [], rejected: 0, rejectionReasons: {}, poseEnvelope: null };
          readyRef.current = false;
          setState({ active: true, index: 0, ready: readyRef.current });
          return {
            target: targetsRef.current[0],
            passKind: 'validation',
            status: 'Training complete. Validation pass started. Look at the blue dot.',
            complete: false,
            settleProgress: 0,
            resetSmoother: true,
          };
        }
      }
      if (passKindRef.current === 'validation') {
        const validated = GazeCalibrationMapper.fitWithValidation(trainingSamplesRef.current, dataRef.current.all);
        mapperRef.current = validated?.mapper ?? null;
        readyRef.current = mapperRef.current !== null;
        if (!validated) {
          activeRef.current = false;
          failedRef.current = true;
          failureRef.current = 'Calibration rejected: training or held-pass error exceeded 0.15. Retry with your face centered and eyes open.';
          setState({ active: false, index, ready: false });
          return { target: null, passKind: null, status: failureRef.current, complete: false, settleProgress: 1, resetSmoother: true, failed: true };
        }
        modelTestingSession?.exportDiagnostics();
      }
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
        passKind: null,
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
    return { target, passKind: passKindRef.current, status: null, complete: false, settleProgress: 0, resetSmoother: true };
  }, [modelTestingSession]);
  return { state, activeRef, indexRef, readyRef, mapper: mapperRef, poseEnvelope: poseEnvelopeRef, targetsRef, passKindRef, failedRef, failureRef, start, reset, pause, process };
}

