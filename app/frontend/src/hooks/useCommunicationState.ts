import { useMemo, useState } from 'react';
import { DwellSelector } from '../interaction/dwellSelector';
import { ActionDefinition, ActionId, COMMUNICATION_ACTIONS } from '../types/communication';

export function useCommunicationState() {
  const [selectedAction, setSelectedAction] = useState<ActionId | null>(null);
  const [emergencyPending, setEmergencyPending] = useState(false);
  const dwellSelector = useMemo(() => new DwellSelector(1500), []);
  const selectedActionDefinition = COMMUNICATION_ACTIONS.find(
    action => action.id === selectedAction,
  );

  const selectAction = (action: ActionDefinition) => {
    if (action.id === 'emergency' && !emergencyPending) {
      setEmergencyPending(true);
      setSelectedAction(null);
      return;
    }

    setSelectedAction(action.id);
    setEmergencyPending(false);
  };

  return {
    selectedAction,
    emergencyPending,
    selectedActionDefinition,
    dwellSelector,
    selectAction,
  };
}