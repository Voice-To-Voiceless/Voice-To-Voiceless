import React from 'react';
import { View } from 'react-native';
import { CameraPanelProps } from './CameraPanel.types';

export function CameraPanel({ children }: CameraPanelProps) {
  return <View>{children}</View>;
}
