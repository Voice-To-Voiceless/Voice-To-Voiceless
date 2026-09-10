import { StyleSheet } from 'react-native';

export const statusStyles = StyleSheet.create({
  statusPanel: {
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderColor: '#dfe7df',
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: 'row',
    marginBottom: 18,
    padding: 16,
  },
  statusIcon: {
    alignItems: 'center',
    backgroundColor: '#edf3eb',
    borderRadius: 24,
    height: 48,
    justifyContent: 'center',
    marginRight: 12,
    width: 48,
  },
  statusIconText: {
    color: '#58705d',
    fontSize: 22,
  },
  statusCopy: {
    flex: 1,
  },
  statusTitle: {
    color: '#18352a',
    fontSize: 15,
    fontWeight: '800',
    marginBottom: 3,
  },
  statusDescription: {
    color: '#6a786d',
    fontSize: 13,
    lineHeight: 18,
  },
});