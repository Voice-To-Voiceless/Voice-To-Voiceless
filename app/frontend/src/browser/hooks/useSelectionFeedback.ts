import { useRef, useState } from 'react';
import { ActionId } from '../../types/communication';
import { playSelectionSound } from '../services/selectionAudio';

export function useSelectionFeedback() {
  const audioContextRef = useRef<AudioContext | null>(null);
  const [selectedAction, setSelectedAction] = useState<ActionId | null>(null);
  const [emergencyPending, setEmergencyPending] = useState(false);

  const selectAction = (actionId: ActionId) => {
    if (actionId === 'emergency' && !emergencyPending) {
      setEmergencyPending(true);
      setSelectedAction(null);
      playSelectionSound(420, audioContextRef);
      return;
    }
    setSelectedAction(actionId);
    setEmergencyPending(false);
    playSelectionSound(actionId === 'emergency' ? 680 : 560, audioContextRef);
  };

  return { selectedAction, emergencyPending, selectAction };
}
