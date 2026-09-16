import { useRef, useState } from 'react';
import { ActionId } from '../../types/communication';
import { playSelectionSound } from '../services/selectionAudio';

export function useSelectionFeedback() {
  const audioContextRef = useRef<AudioContext | null>(null);
  const [selectedAction, setSelectedAction] = useState<ActionId | null>(null);
  const selectAction = (actionId: ActionId) => {
    setSelectedAction(actionId);
    playSelectionSound(560, audioContextRef);
  };

  return { selectedAction, emergencyPending: false, selectAction };
}
