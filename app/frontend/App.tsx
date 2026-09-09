import React, { useMemo, useState } from 'react';
import {
  Pressable,
  SafeAreaView,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import {
  SafeAreaProvider,
} from 'react-native-safe-area-context';
import { DwellSelector } from './src/interaction/dwellSelector';

type ActionId =
  | 'yes'
  | 'no'
  | 'help'
  | 'emergency'
  | 'water'
  | 'food'
  | 'bathroom'
  | 'nurse';

type ActionDefinition = {
  id: ActionId;
  label: string;
  description: string;
  tone: 'calm' | 'warm' | 'urgent';
};

const ACTIONS: ActionDefinition[] = [
  { id: 'yes', label: 'Yes', description: 'I agree', tone: 'calm' },
  { id: 'no', label: 'No', description: 'I disagree', tone: 'calm' },
  { id: 'help', label: 'Help', description: 'Please come here', tone: 'warm' },
  {
    id: 'emergency',
    label: 'Emergency',
    description: 'I need urgent help',
    tone: 'urgent',
  },
  { id: 'water', label: 'Water', description: 'I need a drink', tone: 'calm' },
  { id: 'food', label: 'Food', description: 'I am hungry', tone: 'calm' },
  {
    id: 'bathroom',
    label: 'Bathroom',
    description: 'I need assistance',
    tone: 'calm',
  },
  { id: 'nurse', label: 'Nurse', description: 'Please call my nurse', tone: 'warm' },
];

function App() {
  return (
    <SafeAreaProvider>
      <StatusBar barStyle="dark-content" />
      <AppContent />
    </SafeAreaProvider>
  );
}

function AppContent() {
  const [calibrated, setCalibrated] = useState(false);
  const [selectedAction, setSelectedAction] = useState<ActionId | null>(null);
  const [emergencyPending, setEmergencyPending] = useState(false);
  const dwellSelector = useMemo(() => new DwellSelector(1500), []);

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
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <View style={styles.header}>
          <View>
            <Text style={styles.eyebrow}>V2VL COMMUNICATION BOARD</Text>
            <Text style={styles.title}>How can we help?</Text>
          </View>
          <View style={styles.connectionBadge}>
            <View style={styles.connectionDot} />
            <Text style={styles.connectionText}>Local mode</Text>
          </View>
        </View>

        <View style={styles.statusPanel}>
          <View style={styles.statusIcon}>
            <Text style={styles.statusIconText}>◉</Text>
          </View>
          <View style={styles.statusCopy}>
            <Text style={styles.statusTitle}>
              {calibrated ? 'Tracking ready' : 'Camera tracking not connected'}
            </Text>
            <Text style={styles.statusDescription}>
              {calibrated
                ? 'Look at a choice to select it. Touch is always available.'
                : 'Touch works now. Camera and eye calibration will be added next.'}
            </Text>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={calibrated ? 'Recalibrate eyes' : 'Start calibration'}
            onPress={() => setCalibrated(current => !current)}
            style={({ pressed }) => [styles.calibrateButton, pressed && styles.pressed]}>
            <Text style={styles.calibrateButtonText}>
              {calibrated ? 'Recalibrate' : 'Start setup'}
            </Text>
          </Pressable>
        </View>

        {emergencyPending && (
          <View style={styles.confirmationBanner}>
            <Text style={styles.confirmationTitle}>Confirm emergency request</Text>
            <Text style={styles.confirmationText}>
              Touch Emergency again only if you need urgent assistance.
            </Text>
          </View>
        )}

        {selectedAction && (
          <View style={styles.selectedBanner}>
            <Text style={styles.selectedLabel}>Selected</Text>
            <Text style={styles.selectedValue}>
              {ACTIONS.find(action => action.id === selectedAction)?.label}
            </Text>
          </View>
        )}

        <View style={styles.sectionHeading}>
          <Text style={styles.sectionTitle}>Common needs</Text>
          <Text style={styles.sectionHint}>Touch a choice to continue</Text>
        </View>

        <View style={styles.actionGrid}>
          {ACTIONS.map(action => (
            <Pressable
              key={action.id}
              accessibilityRole="button"
              accessibilityLabel={`${action.label}. ${action.description}`}
              onPress={() => selectAction(action)}
              onPressIn={() => dwellSelector.begin(action.id, Date.now())}
              onPressOut={() => dwellSelector.cancel()}
              style={({ pressed }) => [
                styles.actionCard,
                styles[`${action.tone}Card`],
                selectedAction === action.id && styles.selectedCard,
                pressed && styles.pressed,
              ]}>
              <Text style={styles.actionLabel}>{action.label}</Text>
              <Text style={styles.actionDescription}>{action.description}</Text>
            </Pressable>
          ))}
        </View>

        <Text style={styles.footerText}>
          This is an assistive communication tool. It does not replace clinical care.
        </Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f7f2',
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 18,
  },
  header: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 22,
  },
  eyebrow: {
    color: '#58705d',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1.2,
    marginBottom: 7,
  },
  title: {
    color: '#18352a',
    fontSize: 30,
    fontWeight: '800',
  },
  connectionBadge: {
    alignItems: 'center',
    backgroundColor: '#e8efe8',
    borderRadius: 16,
    flexDirection: 'row',
    paddingHorizontal: 11,
    paddingVertical: 8,
  },
  connectionDot: {
    backgroundColor: '#ba7b42',
    borderRadius: 4,
    height: 8,
    marginRight: 7,
    width: 8,
  },
  connectionText: {
    color: '#4d6653',
    fontSize: 12,
    fontWeight: '700',
  },
  statusPanel: {
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderColor: '#dfe7df',
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: 'row',
    marginBottom: 18,
    padding: 16,
  },
  statusIcon: {
    alignItems: 'center',
    backgroundColor: '#edf3eb',
    borderRadius: 24,
    height: 48,
    justifyContent: 'center',
    marginRight: 12,
    width: 48,
  },
  statusIconText: {
    color: '#58705d',
    fontSize: 22,
  },
  statusCopy: {
    flex: 1,
  },
  statusTitle: {
    color: '#18352a',
    fontSize: 15,
    fontWeight: '800',
    marginBottom: 3,
  },
  statusDescription: {
    color: '#6a786d',
    fontSize: 13,
    lineHeight: 18,
  },
  calibrateButton: {
    backgroundColor: '#18352a',
    borderRadius: 8,
    marginLeft: 12,
    paddingHorizontal: 13,
    paddingVertical: 11,
  },
  calibrateButtonText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '800',
  },
  confirmationBanner: {
    backgroundColor: '#fff3e7',
    borderColor: '#e5b37d',
    borderRadius: 10,
    borderWidth: 1,
    marginBottom: 14,
    padding: 14,
  },
  confirmationTitle: {
    color: '#844618',
    fontSize: 15,
    fontWeight: '800',
    marginBottom: 3,
  },
  confirmationText: {
    color: '#925d33',
    fontSize: 13,
  },
  selectedBanner: {
    alignItems: 'center',
    backgroundColor: '#dcefe2',
    borderRadius: 10,
    flexDirection: 'row',
    marginBottom: 14,
    paddingHorizontal: 14,
    paddingVertical: 11,
  },
  selectedLabel: {
    color: '#4f765b',
    fontSize: 12,
    fontWeight: '800',
    marginRight: 8,
    textTransform: 'uppercase',
  },
  selectedValue: {
    color: '#18352a',
    fontSize: 15,
    fontWeight: '800',
  },
  sectionHeading: {
    alignItems: 'baseline',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  sectionTitle: {
    color: '#18352a',
    fontSize: 18,
    fontWeight: '800',
  },
  sectionHint: {
    color: '#7b887e',
    fontSize: 12,
  },
  actionGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  actionCard: {
    borderRadius: 12,
    borderWidth: 1,
    justifyContent: 'center',
    marginBottom: 12,
    minHeight: 102,
    padding: 16,
    width: '48.5%',
  },
  calmCard: {
    backgroundColor: '#ffffff',
    borderColor: '#d5e1d6',
  },
  warmCard: {
    backgroundColor: '#fff8ed',
    borderColor: '#ead7b9',
  },
  urgentCard: {
    backgroundColor: '#fff0ed',
    borderColor: '#e9b7ad',
  },
  selectedCard: {
    borderColor: '#326946',
    borderWidth: 2,
  },
  actionLabel: {
    color: '#18352a',
    fontSize: 20,
    fontWeight: '800',
    marginBottom: 6,
  },
  actionDescription: {
    color: '#68766c',
    fontSize: 12,
    lineHeight: 16,
  },
  footerText: {
    color: '#889289',
    fontSize: 11,
    lineHeight: 16,
    marginTop: 'auto',
    paddingBottom: 12,
    textAlign: 'center',
  },
  pressed: {
    opacity: 0.78,
  },
});

export default App;
