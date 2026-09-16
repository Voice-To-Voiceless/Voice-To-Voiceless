export type ActionId =
  | 'yes'
  | 'no'
  | 'bathroom'
  | 'food'
  | 'water'
  | 'medication'
  | 'pain'
  | 'sleep'
  | 'talk'
  | 'fine';

export type ActionTone = 'calm' | 'warm' | 'urgent';

export type ActionDefinition = {
  id: ActionId;
  label: string;
  description: string;
  tone: ActionTone;
};

export const COMMUNICATION_ACTIONS: ActionDefinition[] = [
  { id: 'yes', label: 'Yes', description: 'I agree', tone: 'calm' },
  { id: 'no', label: 'No', description: 'I disagree', tone: 'calm' },
  { id: 'bathroom', label: 'Bathroom', description: 'I need the bathroom', tone: 'calm' },
  { id: 'food', label: 'Food', description: 'I am hungry', tone: 'calm' },
  { id: 'water', label: 'Water', description: 'I need a drink', tone: 'calm' },
  { id: 'medication', label: 'Medication', description: 'I need my medication', tone: 'calm' },
  { id: 'pain', label: 'Pain', description: 'Something hurts', tone: 'warm' },
  { id: 'sleep', label: 'Sleep', description: 'I want to rest', tone: 'calm' },
  { id: 'talk', label: 'Talk to someone', description: 'I want to talk', tone: 'warm' },
  { id: 'fine', label: "I'm fine", description: 'I am feeling okay', tone: 'calm' },
];
