import React from 'react';
import { TrackingSnapshot } from '../browserTypes';
import { CALIBRATION_TARGETS } from '../hooks/useCalibration';

type Props = {
  tracking: boolean;
  recognition: boolean;
  trackingState: TrackingSnapshot;
  onTracking: () => void;
  onRecognition: () => void;
  onCalibrate: () => void;
};

export function BrowserControls({ tracking, recognition, trackingState, onTracking, onRecognition, onCalibrate }: Props) {
  return <>
    <button type="button" className="tracking-button" onClick={onTracking} disabled={recognition}>{tracking ? 'Stop eye tracking' : 'Start eye tracking'}</button>
    <button type="button" className="face-recognition-button" onClick={onRecognition} disabled={tracking}>{recognition ? 'Stop face recognition' : 'Test face recognition'}</button>
    {tracking && <button type="button" className="calibration-button" onClick={onCalibrate} disabled={trackingState.calibrating}>
      {trackingState.calibrating ? `Calibrating ${trackingState.calibrationIndex + 1}/${CALIBRATION_TARGETS.length}` : trackingState.calibrationReady ? 'Recalibrate gaze' : 'Calibrate gaze'}
    </button>}
    <p className="footer-note">Assistive communication prototype. Touch remains available at all times.</p>
  </>;
}
