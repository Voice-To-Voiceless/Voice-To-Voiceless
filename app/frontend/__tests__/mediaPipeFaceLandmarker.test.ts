import { MediaPipeFaceLandmarkerAdapter } from '../src/vision/mediaPipeFaceLandmarker';
import { LandmarkPoint } from '../src/vision/landmarkTypes';

function createLandmarks() {
  const landmarks: LandmarkPoint[] = Array.from({ length: 474 }, () => ({ x: 0, y: 0 }));
  landmarks[33] = { x: 0.2, y: 0.4 };
  landmarks[133] = { x: 0.4, y: 0.4 };
  landmarks[263] = { x: 0.8, y: 0.4 };
  landmarks[362] = { x: 0.6, y: 0.4 };
  landmarks[145] = { x: 0.3, y: 0.5 };
  landmarks[159] = { x: 0.3, y: 0.3 };
  landmarks[374] = { x: 0.7, y: 0.5 };
  landmarks[386] = { x: 0.7, y: 0.3 };
  landmarks[468] = { x: 0.3, y: 0.4, z: -0.12, visibility: 0.98 };
  landmarks[473] = { x: 0.7, y: 0.4, z: -0.11, presence: 0.97 };
  landmarks[1] = { x: 0.5, y: 0.62 };
  landmarks[6] = { x: 0.5, y: 0.5 };
  landmarks[10] = { x: 0.5, y: 0.2 };
  landmarks[152] = { x: 0.5, y: 0.9 };
  landmarks[234] = { x: 0.1, y: 0.5 };
  landmarks[454] = { x: 0.9, y: 0.5 };
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
    leftEye: expect.objectContaining({
      irisCenter: { x: 0.3, y: 0.4, z: -0.12, visibility: 0.98 },
    }),
    rightEye: expect.objectContaining({
      irisCenter: { x: 0.7, y: 0.4, z: -0.11, presence: 0.97 },
    }),
    faceAnchors: {
      noseBridge: { x: 0.5, y: 0.5 },
      noseTip: { x: 0.5, y: 0.62 },
      forehead: { x: 0.5, y: 0.2 },
      chin: { x: 0.5, y: 0.9 },
      leftCheek: { x: 0.1, y: 0.5 },
      rightCheek: { x: 0.9, y: 0.5 },
    },
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