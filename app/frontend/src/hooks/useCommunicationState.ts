import { useMemo, useState } from 'react';
import { DwellSelector } from '../interaction/dwellSelector';
import { ActionDefinition, ActionId, COMMUNICATION_ACTIONS } from '../types/communication';

export function useCommunicationState() {
  const [selectedAction, setSelectedAction] = useState<ActionId | null>(null);
  const dwellSelector = useMemo(() => new DwellSelector(1500), []);
  const selectedActionDefinition = COMMUNICATION_ACTIONS.find(
    action => action.id === selectedAction,
  );

  const selectAction = (action: ActionDefinition) => {
    setSelectedAction(action.id);
  };

  return {
    selectedAction,
    emergencyPending: false,
    selectedActionDefinition,
    dwellSelector,
    selectAction,
  };
}