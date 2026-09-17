import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { DwellSelector } from '../interaction/dwellSelector';
import { boardStyles } from '../styles/boardStyles';
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
      <View style={boardStyles.sectionHeading}>
        <Text style={boardStyles.sectionTitle}>Common needs</Text>
        <Text style={boardStyles.sectionHint}>Touch a choice to continue</Text>
      </View>

      <View style={boardStyles.actionGrid}>
        {actions.map(action => (
          <Pressable
            key={action.id}
            accessibilityRole="button"
            accessibilityLabel={`${action.label}. ${action.description}`}
            onPress={() => onSelect(action)}
            onPressIn={() => dwellSelector.begin(action.id, Date.now())}
            onPressOut={() => dwellSelector.cancel()}
            style={({ pressed }) => [
              boardStyles.actionCard,
              boardStyles[`${action.tone}Card`],
              selectedAction === action.id && boardStyles.selectedCard,
              pressed && boardStyles.pressed,
            ]}>
            <Text style={boardStyles.actionLabel}>{action.label}</Text>
            <Text style={boardStyles.actionDescription}>{action.description}</Text>
          </Pressable>
        ))}
      </View>
    </>
  );
}
