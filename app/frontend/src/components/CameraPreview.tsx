import React from 'react';
import { Camera, useCameraDevice, useCameraPermission } from 'react-native-vision-camera';
import { Pressable, Text, View } from 'react-native';
import { appStyles } from '../styles/appStyles';

export function CameraPreview() {
  const device = useCameraDevice('front');
  const { hasPermission, requestPermission } = useCameraPermission();

  if (!hasPermission) {
    return (
      <View style={appStyles.cameraPlaceholder}>
        <Text style={appStyles.cameraTitle}>Camera permission needed</Text>
        <Text style={appStyles.cameraDescription}>
          Allow camera access to preview the patient-facing camera.
        </Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Allow camera access"
          onPress={requestPermission}
          style={({ pressed }) => [appStyles.cameraButton, pressed && appStyles.pressed]}>
          <Text style={appStyles.cameraButtonText}>Allow camera</Text>
        </Pressable>
      </View>
    );
  }

  if (device == null) {
    return (
      <View style={appStyles.cameraPlaceholder}>
        <Text style={appStyles.cameraTitle}>No front camera found</Text>
        <Text style={appStyles.cameraDescription}>
          Check the emulator camera configuration or connect a camera device.
        </Text>
      </View>
    );
  }

  return (
    <View style={appStyles.cameraFrame}>
      <Camera style={appStyles.camera} device={device} isActive={true} />
      <View style={appStyles.cameraLiveBadge}>
        <View style={appStyles.cameraLiveDot} />
        <Text style={appStyles.cameraLiveText}>Camera live</Text>
      </View>
    </View>
  );
}
