import { gazeFromL2CS } from '../../src/browser/hooks/useBrowserTracking';

describe('gazeFromL2CS', () => {
  it('maps positive L2CS yaw to the left side of the screen', () => {
    expect(gazeFromL2CS({ yaw: 30, pitch: 0, confidence: 1 }, 100)).toMatchObject({ y: 0.5, confidence: 1, timestamp: 100 });
    expect(gazeFromL2CS({ yaw: 30, pitch: 0, confidence: 1 }, 100).x).toBeCloseTo(1 / 3);
  });

  it('maps negative L2CS yaw to the right side of the screen', () => {
    expect(gazeFromL2CS({ yaw: -30, pitch: 0, confidence: 1 }, 100)).toMatchObject({ y: 0.5, confidence: 1, timestamp: 100 });
    expect(gazeFromL2CS({ yaw: -30, pitch: 0, confidence: 1 }, 100).x).toBeCloseTo(2 / 3);
  });
});
