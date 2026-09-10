import React from 'react';
import { Text, View } from 'react-native';
import { appStyles } from '../styles/appStyles';

export function TrackingStatusPanel() {
  return (
    <View style={appStyles.statusPanel}>
      <View style={appStyles.statusIcon}>
        <Text style={appStyles.statusIconText}>◎</Text>
      </View>
      <View style={appStyles.statusCopy}>
        <Text style={appStyles.statusTitle}>Camera preview connected</Text>
        <Text style={appStyles.statusDescription}>
          Eye landmark detection and calibration come next. Touch is always available.
        </Text>
      </View>
    </View>
  );
}
