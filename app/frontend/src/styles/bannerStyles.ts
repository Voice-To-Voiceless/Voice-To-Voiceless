import { StyleSheet } from 'react-native';

export const bannerStyles = StyleSheet.create({
  confirmationBanner: {
    backgroundColor: '#fff3e7',
    borderColor: '#e5b37d',
    borderRadius: 10,
    borderWidth: 1,
    marginBottom: 14,
    padding: 14,
  },
  confirmationTitle: {
    color: '#844618',
    fontSize: 15,
    fontWeight: '800',
    marginBottom: 3,
  },
  confirmationText: {
    color: '#925d33',
    fontSize: 13,
  },
  selectedBanner: {
    alignItems: 'center',
    backgroundColor: '#dcefe2',
    borderRadius: 10,
    flexDirection: 'row',
    marginBottom: 14,
    paddingHorizontal: 14,
    paddingVertical: 11,
  },
  selectedLabel: {
    color: '#4f765b',
    fontSize: 12,
    fontWeight: '800',
    marginRight: 8,
    textTransform: 'uppercase',
  },
  selectedValue: {
    color: '#18352a',
    fontSize: 15,
    fontWeight: '800',
  },
});