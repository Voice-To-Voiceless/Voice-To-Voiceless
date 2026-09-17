import React from 'react';
import { Text, View } from 'react-native';
import { headerStyles } from '../styles/headerStyles';

export function CommunicationHeader() {
  return (
    <View style={headerStyles.header}>
      <View>
        <Text style={headerStyles.eyebrow}>V2VL COMMUNICATION BOARD</Text>
        <Text style={headerStyles.title}>How can we help?</Text>
      </View>
      <View style={headerStyles.connectionBadge}>
        <View style={headerStyles.connectionDot} />
        <Text style={headerStyles.connectionText}>Local mode</Text>
      </View>
    </View>
  );
}
