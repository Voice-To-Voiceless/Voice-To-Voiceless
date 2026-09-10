import { MediaPipeFaceLandmarkerAdapter } from '../src/vision/mediaPipeFaceLandmarker';

function createLandmarks() {
  const landmarks = Array.from({ length: 474 }, () => ({ x: 0, y: 0 }));
  landmarks[33] = { x: 0.2, y: 0.4 };
  landmarks[133] = { x: 0.4, y: 0.4 };
  landmarks[263] = { x: 0.8, y: 0.4 };
  landmarks[362] = { x: 0.6, y: 0.4 };
  landmarks[145] = { x: 0.3, y: 0.5 };
  landmarks[159] = { x: 0.3, y: 0.3 };
  landmarks[374] = { x: 0.7, y: 0.5 };
  landmarks[386] = { x: 0.7, y: 0.3 };
  landmarks[468] = { x: 0.3, y: 0.4 };
  landmarks[473] = { x: 0.7, y: 0.4 };
  return landmarks;
}

test('initializes, maps a MediaPipe frame, and disposes the landmarker', async () => {
  const close = jest.fn();
  const detectForVideo = jest.fn(() => ({ faceLandmarks: [createLandmarks()] }));
  const createLandmarker = jest.fn(async () => ({ detectForVideo, close }));
  const adapter = new MediaPipeFaceLandmarkerAdapter({
    wasmPath: '/wasm',
    modelPath: '/face.task',
    createLandmarker,
  });

  await adapter.initialize();
  await expect(adapter.processFrame({ data: 'video-frame', timestamp: 500 })).resolves.toEqual({
    leftEye: expect.objectContaining({ irisCenter: { x: 0.3, y: 0.4 } }),
    rightEye: expect.objectContaining({ irisCenter: { x: 0.7, y: 0.4 } }),
    timestamp: 500,
  });
  expect(detectForVideo).toHaveBeenCalledWith('video-frame', 500);

  adapter.dispose();
  expect(close).toHaveBeenCalledTimes(1);
});

test('returns no observation when MediaPipe detects no face', async () => {
  const adapter = new MediaPipeFaceLandmarkerAdapter({
    wasmPath: '/wasm',
    modelPath: '/face.task',
    createLandmarker: async () => ({
      detectForVideo: () => ({ faceLandmarks: [] }),
      close: jest.fn(),
    }),
  });

  await adapter.initialize();

  await expect(adapter.processFrame({ data: 'video-frame', timestamp: 600 })).resolves.toBeNull();
});