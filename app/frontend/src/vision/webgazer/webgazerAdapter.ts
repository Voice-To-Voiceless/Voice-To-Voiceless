import type { WebGazerPrediction, WebGazerScreenPoint } from './webgazerTypes';
import type webgazerRuntime from 'webgazer';
import webgazerBundleUrl from 'webgazer/dist/webgazer.js?url';

type WebGazerRuntime = typeof webgazerRuntime;
type WebGazerRegression = { getData: () => unknown; setData: (data: unknown) => void };
type SerializedTypedArray = { __v2vl_type: 'typed-array'; constructor: string; values: number[] };

/** Owns WebGazer and feeds it the app's existing camera stream. */
export class BrowserWebGazerAdapter {
  private runtime: WebGazerRuntime | null = null;
  private latestPrediction: WebGazerPrediction | null = null;
  private latestPredictionAt = 0;
  private lastFrameAt = 0;
  private lastTrainingFrameAt = 0;
  private startPromise: Promise<void> | null = null;

  public constructor(private readonly stream: MediaStream) {}

  public async start(): Promise<void> {
    if (this.runtime) return;
    if (this.startPromise) return this.startPromise;

    this.startPromise = this.startRuntime();
    try {
      await this.startPromise;
    } finally {
      this.startPromise = null;
    }
  }

  private async startRuntime(): Promise<void> {
    const globalWindow = window as Window & { webgazer?: WebGazerRuntime };
    let webgazer = globalWindow.webgazer;
    if (!webgazer) {
      await new Promise<void>((resolve, reject) => {
        const script = document.createElement('script');
        script.src = webgazerBundleUrl;
        script.async = true;
        script.onload = () => resolve();
        script.onerror = () => reject(new Error('WebGazer could not be loaded.'));
        document.head.appendChild(script);
      });
      webgazer = globalWindow.webgazer;
    }
    if (!webgazer) throw new Error('WebGazer loaded without exposing its API.');
    webgazer.params.faceMeshSolutionPath = new URL('webgazer/face_mesh', document.baseURI).toString();
    this.runtime = webgazer
      .saveDataAcrossSessions(false)
      .setRegression('ridge')
      .applyKalmanFilter(false)
      .showVideoPreview(false)
      .showPredictionPoints(false)
      .setGazeListener((prediction) => {
        this.lastFrameAt = performance.now();
        if (!prediction || !Number.isFinite(prediction.x) || !Number.isFinite(prediction.y)) {
          this.latestPrediction = null;
          return;
        }
        this.latestPredictionAt = performance.now();
        this.latestPrediction = { x: prediction.x, y: prediction.y, timestamp: this.latestPredictionAt };
      });

    await this.runtime.clearData();
    const mediaDevices = navigator.mediaDevices;
    const originalGetUserMedia = Object.getOwnPropertyDescriptor(mediaDevices, 'getUserMedia');
    Object.defineProperty(mediaDevices, 'getUserMedia', {
      configurable: true,
      value: async () => this.stream.clone(),
    });
    try {
      await this.runtime.begin();
    } catch (error) {
      cleanupRuntime(this.runtime);
      this.runtime = null;
      throw error;
    } finally {
      if (originalGetUserMedia) Object.defineProperty(mediaDevices, 'getUserMedia', originalGetUserMedia);
      else delete (mediaDevices as { getUserMedia?: unknown }).getUserMedia;
    }
    this.runtime.removeMouseEventListeners();
  }

  public getPrediction(): WebGazerPrediction | null {
    return performance.now() - this.latestPredictionAt <= 500 ? this.latestPrediction : null;
  }

  public recordTrainingTarget(target: WebGazerScreenPoint): boolean {
    if (!this.runtime || performance.now() - this.lastFrameAt > 500 || this.lastFrameAt <= this.lastTrainingFrameAt) return false;
    const regression = this.runtime.getRegression()[0];
    if (!regression) return false;
    const before = regression.getData().slice();
    this.runtime.recordScreenPosition(target.x, target.y, 'click');
    const after = regression.getData();
    const recorded = after.length > before.length || after.some((sample, index) => sample !== before[index]);
    if (recorded) this.lastTrainingFrameAt = this.lastFrameAt;
    return recorded;
  }

  public async clearTrainingData(): Promise<void> {
    this.latestPrediction = null;
    this.latestPredictionAt = 0;
    this.lastFrameAt = 0;
    this.lastTrainingFrameAt = 0;
    await this.runtime?.clearData();
  }

  public exportTrainingData(): unknown {
    const regression = this.runtime?.getRegression()[0] as WebGazerRegression | undefined;
    return serializeWebGazerValue(regression?.getData() ?? []);
  }

  public async importTrainingData(data: unknown): Promise<void> {
    const decoded = deserializeWebGazerValue(data);
    if (!Array.isArray(decoded)) throw new Error('Invalid WebGazer regression data.');
    const regression = this.runtime?.getRegression()[0] as WebGazerRegression | undefined;
    if (!regression) throw new Error('WebGazer regression model is unavailable.');
    regression.setData(decoded);
  }

  public async stop(): Promise<void> {
    const runtime = this.runtime;
    this.runtime = null;
    this.latestPrediction = null;
    this.lastFrameAt = 0;
    this.lastTrainingFrameAt = 0;
    if (!runtime) return;
    cleanupRuntime(runtime);
  }
}

function serializeWebGazerValue(value: unknown): unknown {
  if (ArrayBuffer.isView(value)) {
    return {
      __v2vl_type: 'typed-array',
      constructor: value.constructor.name,
      values: Array.from(value as unknown as ArrayLike<number>),
    } satisfies SerializedTypedArray;
  }
  if (Array.isArray(value)) return value.map(serializeWebGazerValue);
  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([key, nested]) => [key, serializeWebGazerValue(nested)]));
  }
  return value;
}

function deserializeWebGazerValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(deserializeWebGazerValue);
  if (value !== null && typeof value === 'object') {
    const candidate = value as Partial<SerializedTypedArray>;
    if (candidate.__v2vl_type === 'typed-array' && Array.isArray(candidate.values)) {
      const constructors: Record<string, new (values: number[]) => ArrayLike<number>> = {
        Float32Array,
        Float64Array,
        Int8Array,
        Int16Array,
        Int32Array,
        Uint8Array,
        Uint8ClampedArray,
        Uint16Array,
        Uint32Array,
      };
      const TypedArray = constructors[candidate.constructor ?? ''];
      if (!TypedArray) throw new Error('Unsupported WebGazer typed-array payload.');
      return new TypedArray(candidate.values);
    }
    return Object.fromEntries(Object.entries(value).map(([key, nested]) => [key, deserializeWebGazerValue(nested)]));
  }
  return value;
}

function cleanupRuntime(runtime: WebGazerRuntime): void {
  for (const cleanup of [
    () => runtime.clearGazeListener().removeMouseEventListeners(),
    () => runtime.pause(),
    () => runtime.stopVideo(),
    () => runtime.end(),
  ]) {
    try {
      cleanup();
    } catch (error) {
      console.warn('[webgazer] cleanup failed', error);
    }
  }
}
