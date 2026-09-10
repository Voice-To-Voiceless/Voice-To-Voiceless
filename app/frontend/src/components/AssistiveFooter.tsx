import React from 'react';
import { Text } from 'react-native';
import { appStyles } from '../styles/appStyles';

export function AssistiveFooter() {
  return (
    <Text style={appStyles.footerText}>
      This is an assistive communication tool. It does not replace clinical care.
    </Text>
  );
}
