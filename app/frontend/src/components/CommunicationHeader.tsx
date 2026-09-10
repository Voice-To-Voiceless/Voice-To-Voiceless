import React from 'react';
import { Text, View } from 'react-native';
import { appStyles } from '../styles/appStyles';

export function CommunicationHeader() {
  return (
    <View style={appStyles.header}>
      <View>
        <Text style={appStyles.eyebrow}>V2VL COMMUNICATION BOARD</Text>
        <Text style={appStyles.title}>How can we help?</Text>
      </View>
      <View style={appStyles.connectionBadge}>
        <View style={appStyles.connectionDot} />
        <Text style={appStyles.connectionText}>Local mode</Text>
      </View>
    </View>
  );
}
