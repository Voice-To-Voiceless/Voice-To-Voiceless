import React, { useState } from 'react';
import { Camera, useCameraDevice, useCameraPermission } from 'react-native-vision-camera';
import { Pressable, Text, View } from 'react-native';
import { CameraStatus } from '../types/camera';
import { cameraStyles } from '../styles/cameraStyles';

type CameraPreviewProps = {
  onStatusChange: (status: CameraStatus, errorMessage?: string) => void;
};

export function CameraPreview({ onStatusChange }: CameraPreviewProps) {
  const device = useCameraDevice('front');
  const { hasPermission, requestPermission } = useCameraPermission();
  const [cameraStarted, setCameraStarted] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  if (!hasPermission) {
    return (
      <View style={cameraStyles.cameraPlaceholder}>
        <Text style={cameraStyles.cameraTitle}>Camera permission needed</Text>
        <Text style={cameraStyles.cameraDescription}>
          Allow camera access to preview the patient-facing camera.
        </Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Allow camera access"
          onPress={requestPermission}
          style={({ pressed }) => [cameraStyles.cameraButton, pressed && cameraStyles.pressed]}>
          <Text style={cameraStyles.cameraButtonText}>Allow camera</Text>
        </Pressable>
      </View>
    );
  }

  if (device == null) {
    return (
      <View style={cameraStyles.cameraPlaceholder}>
        <Text style={cameraStyles.cameraTitle}>No front camera found</Text>
        <Text style={cameraStyles.cameraDescription}>
          Check the emulator camera configuration or connect a camera device.
        </Text>
      </View>
    );
  }

  return (
    <View style={cameraStyles.cameraFrame}>
      <Camera
        style={cameraStyles.camera}
        device={device}
        isActive={true}
        onStarted={() => {
          console.log('[CameraPreview] Camera initialized');
          setCameraStarted(true);
          setErrorMessage(null);
          onStatusChange('ready');
        }}
        onError={error => {
          const message = error.message;
          console.error('[CameraPreview] Camera error:', message);
          setCameraStarted(false);
          setErrorMessage(message);
          onStatusChange('error', message);
        }}
      />
      <View style={cameraStyles.cameraLiveBadge}>
        <View style={cameraStyles.cameraLiveDot} />
        <Text style={cameraStyles.cameraLiveText}>
          {errorMessage !== null
            ? 'Camera error'
            : cameraStarted
              ? 'Camera ready'
              : 'Camera initializing'}
        </Text>
      </View>
    </View>
  );
}
