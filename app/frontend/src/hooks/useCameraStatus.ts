import { useState } from 'react';
import { CameraStatus } from '../types/camera';

export function useCameraStatus() {
  const [cameraStatus, setCameraStatus] = useState<CameraStatus>('initializing');
  const [cameraError, setCameraError] = useState<string>();

  const handleCameraStatusChange = (status: CameraStatus, errorMessage?: string) => {
    setCameraStatus(status);
    setCameraError(errorMessage);
  };

  return { cameraStatus, cameraError, handleCameraStatusChange };
}