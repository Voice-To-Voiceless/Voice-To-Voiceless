import React from 'react';
import { SafeAreaView, View } from 'react-native';
import { AssistiveFooter } from '../components/AssistiveFooter';
import { CameraPreview } from '../components/CameraPreview';
import { CommunicationBanners } from '../components/CommunicationBanners';
import { CommunicationBoard } from '../components/CommunicationBoard';
import { CommunicationHeader } from '../components/CommunicationHeader';
import { TrackingStatusPanel } from '../components/TrackingStatusPanel';
import { useCameraStatus } from '../hooks/useCameraStatus';
import { useCommunicationState } from '../hooks/useCommunicationState';
import { screenStyles } from '../styles/screenStyles';
import { COMMUNICATION_ACTIONS } from '../types/communication';

export function CommunicationScreen() {
  const { cameraStatus, cameraError, handleCameraStatusChange } = useCameraStatus();
  const {
    selectedAction,
    emergencyPending,
    selectedActionDefinition,
    dwellSelector,
    selectAction,
  } = useCommunicationState();

  return (
    <SafeAreaView style={screenStyles.container}>
      <View style={screenStyles.content}>
        <CommunicationHeader />
        <CameraPreview onStatusChange={handleCameraStatusChange} />
        <TrackingStatusPanel cameraStatus={cameraStatus} cameraError={cameraError} />
        <CommunicationBanners
          emergencyPending={emergencyPending}
          selectedAction={selectedActionDefinition}
        />
        <CommunicationBoard
          actions={COMMUNICATION_ACTIONS}
          selectedAction={selectedAction}
          dwellSelector={dwellSelector}
          onSelect={selectAction}
        />
        <AssistiveFooter />
      </View>
    </SafeAreaView>
  );
}