import * as ort from 'onnxruntime-web';
import { FaceLandmarkObservation } from '../types/landmarkTypes';

ort.env.wasm.wasmPaths = '/onnxruntime/';

export type L2CSAngularGaze = { yaw: number; pitch: number; confidence: number; timestamp: number };
export type L2CSInferenceDiagnostics = { provider: 'webgpu' | 'wasm'; latencyMs: number; estimatesPerSecond: number };
type L2CSManifest = { input: { name: string; shape: number[]; normalization: { mean: number[]; std: number[] } }; outputs: Array<{ name: string; axis: 'yaw' | 'pitch' }>; decoding: { bins: number; degrees_per_bin: number; minimum_degrees: number } };

const MODEL_URL = '/models/l2cs_gaze360_resnet50.onnx';
const MANIFEST_URL = '/models/l2cs_gaze360_resnet50.manifest.json';
const INPUT_SIZE = 224;
const MINIMUM_ESTIMATES_PER_SECOND = 8;
const PERFORMANCE_WINDOW_MS = 5000;

export class L2CSOnnxEstimator {
  private session: ort.InferenceSession | null = null;
  private manifest: L2CSManifest | null = null;
  private provider: 'webgpu' | 'wasm' | null = null;
  private inFlight = false;
  private estimateTimes: number[] = [];
  private performanceStartedAt = 0;

  public async initialize(): Promise<void> {
    this.manifest = await fetch(MANIFEST_URL).then(response => {
      if (!response.ok) throw new Error(`L2CS manifest could not be loaded (${response.status}).`);
      return response.json() as Promise<L2CSManifest>;
    });
    const providers: Array<'webgpu' | 'wasm'> = typeof navigator !== 'undefined' && 'gpu' in navigator ? ['webgpu', 'wasm'] : ['wasm'];
    let lastError: unknown = null;
    for (const provider of providers) {
      try {
        this.session = await ort.InferenceSession.create(MODEL_URL, { executionProviders: [provider], graphOptimizationLevel: 'all' });
        this.provider = provider;
        break;
      } catch (error) {
        lastError = error;
      }
    }
    if (!this.session || !this.provider) throw new Error(`L2CS ONNX session failed to load: ${lastError instanceof Error ? lastError.message : 'unknown error'}`);
    await this.runWarmup();
    this.estimateTimes = [];
    this.performanceStartedAt = performance.now();
  }

  public async estimate(video: HTMLVideoElement, observation: FaceLandmarkObservation, timestamp: number): Promise<{ gaze: L2CSAngularGaze; diagnostics: L2CSInferenceDiagnostics }> {
    if (!this.session || !this.manifest || !this.provider) throw new Error('L2CS ONNX session is not initialized.');
    if (this.inFlight) throw new Error('L2CS frame skipped while the previous inference is running.');
    this.inFlight = true;
    try {
      return await this.run(video, observation, timestamp);
    } finally {
      this.inFlight = false;
    }
  }

  public dispose(): void {
    this.session?.release();
    this.session = null;
    this.manifest = null;
    this.provider = null;
    this.inFlight = false;
    this.estimateTimes = [];
    this.performanceStartedAt = 0;
  }

  private async runWarmup(): Promise<void> {
    const tensor = new ort.Tensor('float32', new Float32Array(3 * INPUT_SIZE * INPUT_SIZE), [1, 3, INPUT_SIZE, INPUT_SIZE]);
    await this.session!.run({ [this.manifest!.input.name]: tensor });
  }

  private async run(video: HTMLVideoElement, observation: FaceLandmarkObservation, timestamp: number) {
    const started = performance.now();
    const tensor = createFaceTensor(video, observation, this.manifest!.input.normalization.mean, this.manifest!.input.normalization.std);
    const outputs = await this.session!.run({ [this.manifest!.input.name]: tensor });
    const yawOutput = outputs[this.manifest!.outputs.find(output => output.axis === 'yaw')!.name] as ort.Tensor;
    const pitchOutput = outputs[this.manifest!.outputs.find(output => output.axis === 'pitch')!.name] as ort.Tensor;
    const yaw = decodeAngle(yawOutput.data, this.manifest!.decoding);
    const pitch = decodeAngle(pitchOutput.data, this.manifest!.decoding);
    const latencyMs = performance.now() - started;
    const now = performance.now();
    this.estimateTimes.push(now);
    this.estimateTimes = this.estimateTimes.filter(time => now - time <= PERFORMANCE_WINDOW_MS);
    const estimatesPerSecond = this.estimateTimes.length / (PERFORMANCE_WINDOW_MS / 1000);
    if (now - this.performanceStartedAt >= PERFORMANCE_WINDOW_MS && estimatesPerSecond < MINIMUM_ESTIMATES_PER_SECOND) throw new Error(`L2CS inference is too slow (${estimatesPerSecond.toFixed(1)} estimates/s).`);
    return { gaze: { yaw, pitch, confidence: confidenceFromLogits(yawOutput.data, pitchOutput.data), timestamp }, diagnostics: { provider: this.provider!, latencyMs, estimatesPerSecond } };
  }
}

function createFaceTensor(video: HTMLVideoElement, observation: FaceLandmarkObservation, mean: number[], std: number[]): ort.Tensor {
  const bounds = observation.faceBounds;
  if (!bounds) throw new Error('L2CS face crop is unavailable.');
  const canvas = document.createElement('canvas');
  canvas.width = INPUT_SIZE;
  canvas.height = INPUT_SIZE;
  const context = canvas.getContext('2d', { willReadFrequently: true });
  if (!context) throw new Error('L2CS could not create a canvas context.');
  context.drawImage(video, bounds.left * video.videoWidth, bounds.top * video.videoHeight, (bounds.right - bounds.left) * video.videoWidth, (bounds.bottom - bounds.top) * video.videoHeight, 0, 0, INPUT_SIZE, INPUT_SIZE);
  const pixels = context.getImageData(0, 0, INPUT_SIZE, INPUT_SIZE).data;
  const values = new Float32Array(3 * INPUT_SIZE * INPUT_SIZE);
  for (let index = 0; index < INPUT_SIZE * INPUT_SIZE; index += 1) for (let channel = 0; channel < 3; channel += 1) values[channel * INPUT_SIZE * INPUT_SIZE + index] = (pixels[index * 4 + channel] / 255 - mean[channel]) / std[channel];
  return new ort.Tensor('float32', values, [1, 3, INPUT_SIZE, INPUT_SIZE]);
}

function decodeAngle(values: unknown, decoding: L2CSManifest['decoding']): number {
  const logits = Array.from(values as Float32Array | Float64Array);
  const maximum = Math.max(...logits);
  const probabilities = logits.map(value => Math.exp(value - maximum));
  const total = probabilities.reduce((sum, value) => sum + value, 0);
  return probabilities.reduce((sum, value, index) => sum + value / total * index, 0) * decoding.degrees_per_bin + decoding.minimum_degrees;
}

function confidenceFromLogits(yaw: unknown, pitch: unknown): number { return Math.min(maxProbability(yaw), maxProbability(pitch)); }
function maxProbability(values: unknown): number {
  const logits = Array.from(values as Float32Array | Float64Array);
  const maximum = Math.max(...logits);
  const weights = logits.map(value => Math.exp(value - maximum));
  return Math.max(...weights) / weights.reduce((sum, value) => sum + value, 0);
}
