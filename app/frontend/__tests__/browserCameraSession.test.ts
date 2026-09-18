import { openCamera } from '../src/browser/services/browserCameraSession';

test('requests an ideal high-resolution front-camera stream', async () => {
  const stream = { getTracks: jest.fn(() => []) } as unknown as MediaStream;
  const getUserMedia = jest.fn().mockResolvedValue(stream);
  const play = jest.fn().mockResolvedValue(undefined);
  Object.defineProperty(globalThis.navigator, 'mediaDevices', {
    configurable: true,
    value: { getUserMedia },
  });
  const video = { srcObject: null, play } as unknown as HTMLVideoElement;

  await expect(openCamera(video)).resolves.toBe(stream);

  expect(getUserMedia).toHaveBeenCalledWith({
    video: {
      facingMode: 'user',
      width: { ideal: 1280 },
      height: { ideal: 720 },
    },
    audio: false,
  });
  expect(video.srcObject).toBe(stream);
  expect(play).toHaveBeenCalledTimes(1);
});