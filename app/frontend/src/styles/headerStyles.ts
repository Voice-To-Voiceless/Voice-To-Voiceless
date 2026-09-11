import { StyleSheet } from 'react-native';

export const headerStyles = StyleSheet.create({
  header: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 22,
  },
  eyebrow: {
    color: '#58705d',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1.2,
    marginBottom: 7,
  },
  title: {
    color: '#18352a',
    fontSize: 30,
    fontWeight: '800',
  },
  connectionBadge: {
    alignItems: 'center',
    backgroundColor: '#e8efe8',
    borderRadius: 16,
    flexDirection: 'row',
    paddingHorizontal: 11,
    paddingVertical: 8,
  },
  connectionDot: {
    backgroundColor: '#ba7b42',
    borderRadius: 4,
    height: 8,
    marginRight: 7,
    width: 8,
  },
  connectionText: {
    color: '#4d6653',
    fontSize: 12,
    fontWeight: '700',
  },
});