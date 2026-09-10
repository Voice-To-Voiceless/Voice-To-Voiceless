import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { DwellSelector } from '../interaction/dwellSelector';
import { appStyles } from '../styles/appStyles';
import { ActionDefinition, ActionId } from '../types/communication';

type CommunicationBoardProps = {
  actions: ActionDefinition[];
  selectedAction: ActionId | null;
  dwellSelector: DwellSelector;
  onSelect: (action: ActionDefinition) => void;
};

export function CommunicationBoard({
  actions,
  selectedAction,
  dwellSelector,
  onSelect,
}: CommunicationBoardProps) {
  return (
    <>
      <View style={appStyles.sectionHeading}>
        <Text style={appStyles.sectionTitle}>Common needs</Text>
        <Text style={appStyles.sectionHint}>Touch a choice to continue</Text>
      </View>

      <View style={appStyles.actionGrid}>
        {actions.map(action => (
          <Pressable
            key={action.id}
            accessibilityRole="button"
            accessibilityLabel={`${action.label}. ${action.description}`}
            onPress={() => onSelect(action)}
            onPressIn={() => dwellSelector.begin(action.id, Date.now())}
            onPressOut={() => dwellSelector.cancel()}
            style={({ pressed }) => [
              appStyles.actionCard,
              appStyles[`${action.tone}Card`],
              selectedAction === action.id && appStyles.selectedCard,
              pressed && appStyles.pressed,
            ]}>
            <Text style={appStyles.actionLabel}>{action.label}</Text>
            <Text style={appStyles.actionDescription}>{action.description}</Text>
          </Pressable>
        ))}
      </View>
    </>
  );
}
