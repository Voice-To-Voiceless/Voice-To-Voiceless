export type ActionId =
  | 'yes'
  | 'no'
  | 'help'
  | 'emergency'
  | 'water'
  | 'food'
  | 'bathroom'
  | 'nurse';

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
  { id: 'help', label: 'Help', description: 'Please come here', tone: 'warm' },
  {
    id: 'emergency',
    label: 'Emergency',
    description: 'I need urgent help',
    tone: 'urgent',
  },
  { id: 'water', label: 'Water', description: 'I need a drink', tone: 'calm' },
  { id: 'food', label: 'Food', description: 'I am hungry', tone: 'calm' },
  {
    id: 'bathroom',
    label: 'Bathroom',
    description: 'I need assistance',
    tone: 'calm',
  },
  { id: 'nurse', label: 'Nurse', description: 'Please call my nurse', tone: 'warm' },
];
