import React from 'react';
import { FaceRecognitionSnapshot } from '../browserTypes';

type Props = {
  videoRef: React.RefObject<HTMLVideoElement | null>;
  tracking: boolean;
  recognition: boolean;
  face: FaceRecognitionSnapshot;
};

export function BrowserCameraPanel({ videoRef, tracking, recognition, face }: Props) {
  const status = tracking
    ? 'Eye tracking active'
    : recognition
      ? `Face: ${face.state} | risk: ${face.risk.toFixed(2)} | ${face.expression} (${face.confidence.toFixed(2)})`
      : 'Camera preview';
  return <section className="camera-panel">
    <video ref={videoRef} className="camera-preview" autoPlay muted playsInline />
    <div className="camera-overlay"><span className="camera-status-dot" />{status}</div>
  </section>;
}
