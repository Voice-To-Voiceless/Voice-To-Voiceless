import React, { useMemo, useState } from 'react';
import { SafeAreaView, StatusBar, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AssistiveFooter } from './src/components/AssistiveFooter';
import { CameraPreview } from './src/components/CameraPreview';
import { CommunicationBanners } from './src/components/CommunicationBanners';
import { CommunicationBoard } from './src/components/CommunicationBoard';
import { CommunicationHeader } from './src/components/CommunicationHeader';
import { TrackingStatusPanel } from './src/components/TrackingStatusPanel';
import { DwellSelector } from './src/interaction/dwellSelector';
import { appStyles } from './src/styles/appStyles';
import {
  ActionDefinition,
  ActionId,
  COMMUNICATION_ACTIONS,
} from './src/types/communication';

function App() {
  return (
    <SafeAreaProvider>
      <StatusBar barStyle="dark-content" />
      <CommunicationScreen />
    </SafeAreaProvider>
  );
}

function CommunicationScreen() {
  const [selectedAction, setSelectedAction] = useState<ActionId | null>(null);
  const [emergencyPending, setEmergencyPending] = useState(false);
  const dwellSelector = useMemo(() => new DwellSelector(1500), []);
  const selectedActionDefinition = COMMUNICATION_ACTIONS.find(
    action => action.id === selectedAction,
  );

  const selectAction = (action: ActionDefinition) => {
    if (action.id === 'emergency' && !emergencyPending) {
      setEmergencyPending(true);
      setSelectedAction(null);
      return;
    }

    setSelectedAction(action.id);
    setEmergencyPending(false);
  };

  return (
    <SafeAreaView style={appStyles.container}>
      <View style={appStyles.content}>
        <CommunicationHeader />
        <CameraPreview />
        <TrackingStatusPanel />
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

export default App;
