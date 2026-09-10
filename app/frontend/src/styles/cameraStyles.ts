import { StyleSheet } from 'react-native';

export const cameraStyles = StyleSheet.create({
  cameraFrame: {
    backgroundColor: '#18352a',
    borderRadius: 12,
    height: 150,
    marginBottom: 14,
    overflow: 'hidden',
    position: 'relative',
  },
  camera: {
    flex: 1,
  },
  cameraLiveBadge: {
    alignItems: 'center',
    backgroundColor: 'rgba(24, 53, 42, 0.8)',
    borderRadius: 14,
    flexDirection: 'row',
    left: 12,
    paddingHorizontal: 10,
    paddingVertical: 6,
    position: 'absolute',
    top: 12,
  },
  cameraLiveDot: {
    backgroundColor: '#8bcf9d',
    borderRadius: 4,
    height: 8,
    marginRight: 6,
    width: 8,
  },
  cameraLiveText: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '800',
  },
  cameraPlaceholder: {
    alignItems: 'flex-start',
    backgroundColor: '#e8efe8',
    borderColor: '#cddccd',
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 14,
    padding: 16,
  },
  cameraTitle: {
    color: '#18352a',
    fontSize: 15,
    fontWeight: '800',
    marginBottom: 4,
  },
  cameraDescription: {
    color: '#637267',
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 12,
  },
  cameraButton: {
    backgroundColor: '#18352a',
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  cameraButtonText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '800',
  },
  pressed: {
    opacity: 0.78,
  },
});