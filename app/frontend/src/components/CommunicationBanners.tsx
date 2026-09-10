import React from 'react';
import { Text, View } from 'react-native';
import { appStyles } from '../styles/appStyles';
import { ActionDefinition } from '../types/communication';

type CommunicationBannersProps = {
  emergencyPending: boolean;
  selectedAction: ActionDefinition | undefined;
};

export function CommunicationBanners({
  emergencyPending,
  selectedAction,
}: CommunicationBannersProps) {
  return (
    <>
      {emergencyPending && (
        <View style={appStyles.confirmationBanner}>
          <Text style={appStyles.confirmationTitle}>Confirm emergency request</Text>
          <Text style={appStyles.confirmationText}>
            Touch Emergency again only if you need urgent assistance.
          </Text>
        </View>
      )}

      {selectedAction && (
        <View style={appStyles.selectedBanner}>
          <Text style={appStyles.selectedLabel}>Selected</Text>
          <Text style={appStyles.selectedValue}>{selectedAction.label}</Text>
        </View>
      )}
    </>
  );
}
