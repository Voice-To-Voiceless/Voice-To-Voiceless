import React from 'react';
import { Text, View } from 'react-native';
import { bannerStyles } from '../styles/bannerStyles';
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
        <View style={bannerStyles.confirmationBanner}>
          <Text style={bannerStyles.confirmationTitle}>Confirm emergency request</Text>
          <Text style={bannerStyles.confirmationText}>
            Touch Emergency again only if you need urgent assistance.
          </Text>
        </View>
      )}

      {selectedAction && (
        <View style={bannerStyles.selectedBanner}>
          <Text style={bannerStyles.selectedLabel}>Selected</Text>
          <Text style={bannerStyles.selectedValue}>{selectedAction.label}</Text>
        </View>
      )}
    </>
  );
}
