import React from 'react';
import { Text, View } from 'react-native';
import { statusStyles } from '../styles/statusStyles';
import { CameraStatus } from '../types/camera';

type TrackingStatusPanelProps = {
  cameraStatus: CameraStatus;
  cameraError?: string;
};

export function TrackingStatusPanel({ cameraStatus, cameraError }: TrackingStatusPanelProps) {
  const statusTitle = {
    initializing: 'Camera initializing',
    ready: 'Camera preview connected',
    error: 'Camera preview error',
  }[cameraStatus];
  const statusDescription =
    cameraStatus === 'error'
      ? cameraError ?? 'The camera could not start.'
      : 'Eye landmark detection and calibration come next. Touch is always available.';

  return (
    <View style={statusStyles.statusPanel}>
      <View style={statusStyles.statusIcon}>
        <Text style={statusStyles.statusIconText}>◎</Text>
      </View>
      <View style={statusStyles.statusCopy}>
        <Text style={statusStyles.statusTitle}>{statusTitle}</Text>
        <Text style={statusStyles.statusDescription}>{statusDescription}</Text>
      </View>
    </View>
  );
}
