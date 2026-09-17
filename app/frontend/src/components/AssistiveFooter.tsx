import React from 'react';
import { Text } from 'react-native';
import { footerStyles } from '../styles/footerStyles';

export function AssistiveFooter() {
  return (
    <Text style={footerStyles.footerText}>
      This is an assistive communication tool. It does not replace clinical care.
    </Text>
  );
}
