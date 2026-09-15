import React, { useEffect, useRef, useState } from 'react';
import { useBrowserTracking } from './hooks/useBrowserTracking';
import { useFaceRecognition } from './hooks/useFaceRecognition';
import { useSelectionFeedback } from './hooks/useSelectionFeedback';
import { BrowserHeader } from './components/BrowserHeader';
import { BrowserCameraPanel } from './components/BrowserCameraPanel';
import { BrowserToastStack } from './components/BrowserToastStack';
import { BrowserActionBoard } from './components/BrowserActionBoard';
import { BrowserControls } from './components/BrowserControls';
import { CalibrationTarget } from './components/CalibrationTarget';
import { CALIBRATION_TARGETS } from './hooks/useCalibration';
import { createModelTestingSession } from '../modelTesting/modelTestingSession';

const ALERT_DURATION_MS = 3500;

export function BrowserTrackingApp({ modelTesting = false }: { modelTesting?: boolean } = {}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const boardRef = useRef<HTMLDivElement>(null);
  const modelTestingSessionRef = useRef(modelTesting ? createModelTestingSession() : undefined);
  const [selectedNoticeVisible, setSelectedNoticeVisible] = useState(false);
  const [statusVisible, setStatusVisible] = useState(true);
  const selection = useSelectionFeedback();
  const tracking = useBrowserTracking(videoRef, boardRef, selection.selectAction, modelTestingSessionRef.current);
  const recognition = useFaceRecognition(videoRef);
  const isTracking = tracking.snapshot.active;

  useEffect(() => {
    setStatusVisible(true);
    const timer = window.setTimeout(() => setStatusVisible(false), ALERT_DURATION_MS);
    return () => window.clearTimeout(timer);
  }, [tracking.status, tracking.error, recognition.error]);

  useEffect(() => {
    setSelectedNoticeVisible(selection.selectedAction !== null);
    if (selection.selectedAction === null) return undefined;
    const timer = window.setTimeout(() => setSelectedNoticeVisible(false), ALERT_DURATION_MS);
    return () => window.clearTimeout(timer);
  }, [selection.selectedAction]);

  const startTracking = () => {
    if (recognition.snapshot.active) return;
    tracking.start().catch(() => undefined);
  };

  const startRecognition = () => {
    if (isTracking) return;
    if (recognition.snapshot.active) recognition.stop();
    else recognition.start().catch(() => undefined);
  };

  const status = isTracking ? tracking.status : recognition.snapshot.active ? 'Face recognition is live.' : 'Camera is off. Start tracking to begin.';
  return <main className="tracking-app">
    <CalibrationTarget gazePoint={tracking.snapshot.gazePoint} target={tracking.snapshot.calibrating ? CALIBRATION_TARGETS[tracking.snapshot.calibrationIndex] : null} progress={tracking.snapshot.calibrationProgress} />
    <BrowserHeader tracking={isTracking} />
    <BrowserCameraPanel videoRef={videoRef} tracking={isTracking} recognition={recognition.snapshot.active} face={recognition.snapshot} />
    <BrowserToastStack status={status} error={tracking.error ?? recognition.error} statusVisible={statusVisible} emergencyPending={selection.emergencyPending} selectedAction={selection.selectedAction} selectedNoticeVisible={selectedNoticeVisible} />
    <BrowserActionBoard boardRef={boardRef} selectedAction={selection.selectedAction} activeTarget={tracking.snapshot.activeTarget} dwellProgress={tracking.snapshot.dwellProgress} onSelect={selection.selectAction} />
    <BrowserControls tracking={isTracking} recognition={recognition.snapshot.active} trackingState={tracking.snapshot} onTracking={isTracking ? tracking.stop : startTracking} onRecognition={startRecognition} onCalibrate={tracking.calibrate} />
  </main>;
}
