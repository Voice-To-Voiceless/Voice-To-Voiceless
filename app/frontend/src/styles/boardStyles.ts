import { StyleSheet } from 'react-native';

export const boardStyles = StyleSheet.create({
  sectionHeading: {
    alignItems: 'baseline',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  sectionTitle: {
    color: '#18352a',
    fontSize: 18,
    fontWeight: '800',
  },
  sectionHint: {
    color: '#7b887e',
    fontSize: 12,
  },
  actionGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  actionCard: {
    borderRadius: 12,
    borderWidth: 1,
    justifyContent: 'center',
    marginBottom: 12,
    minHeight: 102,
    padding: 16,
    width: '48.5%',
  },
  calmCard: {
    backgroundColor: '#ffffff',
    borderColor: '#d5e1d6',
  },
  warmCard: {
    backgroundColor: '#fff8ed',
    borderColor: '#ead7b9',
  },
  urgentCard: {
    backgroundColor: '#fff0ed',
    borderColor: '#e9b7ad',
  },
  selectedCard: {
    borderColor: '#326946',
    borderWidth: 2,
  },
  actionLabel: {
    color: '#18352a',
    fontSize: 20,
    fontWeight: '800',
    marginBottom: 6,
  },
  actionDescription: {
    color: '#68766c',
    fontSize: 12,
    lineHeight: 16,
  },
  pressed: {
    opacity: 0.78,
  },
});