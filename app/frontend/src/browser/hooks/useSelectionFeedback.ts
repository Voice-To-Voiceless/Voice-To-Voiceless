import { useRef, useState } from 'react';
import { ActionId } from '../../types/communication';
import { playSelectionSound } from '../services/selectionAudio';

export function useSelectionFeedback() {
  const audioContextRef = useRef<AudioContext | null>(null);
  const [selectedAction, setSelectedAction] = useState<ActionId | null>(null);
  const selectAction = (actionId: ActionId) => {
    setSelectedAction(actionId);
    if (readAudioFeedbackSetting()) playSelectionSound(560, audioContextRef);
  };

  return { selectedAction, emergencyPending: false, selectAction };
}

function readAudioFeedbackSetting(): boolean {
  try {
    const saved = JSON.parse(localStorage.getItem('voice-to-voiceless-accessibility') ?? '{}') as { audioFeedback?: unknown };
    return saved.audioFeedback !== false;
  } catch {
    return true;
  }
}
