import * as ort from 'onnxruntime-web';
import { FaceLandmarkObservation } from '../types/landmarkTypes';

const assetUrl = (path: string) => new URL(path, typeof document === 'undefined' ? 'http://localhost/' : document.baseURI).toString();
ort.env.wasm.wasmPaths = assetUrl('onnxruntime/');

export type L2CSAngularGaze = { yaw: number; pitch: number; confidence: number; timestamp: number };
export type L2CSInferenceDiagnostics = { provider: 'webgpu' | 'wasm'; latencyMs: number; estimatesPerSecond: number };
export type L2CSManifest = { input: { name: string; shape: number[]; normalization: { mean: number[]; std: number[] } }; outputs: Array<{ name: string; axis: 'yaw' | 'pitch' }>; decoding: { bins: number; degrees_per_bin: number; minimum_degrees: number } };

const MODEL_URL = assetUrl('models/l2cs_gaze360_resnet50.onnx');
const MANIFEST_URL = assetUrl('models/l2cs_gaze360_resnet50.manifest.json');
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
    const manifest = await fetch(MANIFEST_URL).then(response => {
      if (!response.ok) throw new Error(`L2CS manifest could not be loaded (${response.status}).`);
      return response.json() as Promise<L2CSManifest>;
    });
    validateManifest(manifest);
    this.manifest = manifest;
    const providers: Array<'webgpu' | 'wasm'> = typeof navigator !== 'undefined' && 'gpu' in navigator ? ['webgpu', 'wasm'] : ['wasm'];
    let lastError: unknown = null;
    for (const provider of providers) {
      try {
        this.session = await ort.InferenceSession.create(MODEL_URL, { executionProviders: [provider], graphOptimizationLevel: 'all' });
        validateSessionContract(this.session, this.manifest);
        this.provider = provider;
        await this.runWarmup();
        break;
      } catch (error) {
        lastError = error;
        this.session?.release();
        this.session = null;
        this.provider = null;
      }
    }
    if (!this.session || !this.provider) throw new Error(`L2CS ONNX session failed to load: ${lastError instanceof Error ? lastError.message : 'unknown error'}`);
    this.estimateTimes = [];
    this.performanceStartedAt = performance.now();
  }

  public async estimate(video: HTMLVideoElement, observation: FaceLandmarkObservation, timestamp: number): Promise<{ gaze: L2CSAngularGaze; diagnostics: L2CSInferenceDiagnostics } | null> {
    if (!this.session || !this.manifest || !this.provider) throw new Error('L2CS ONNX session is not initialized.');
    if (this.inFlight) return null;
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
    const size = this.manifest!.input.shape[2]!;
    const tensor = new ort.Tensor('float32', new Float32Array(3 * size * size), [1, 3, size, size]);
    const outputs = await this.session!.run({ [this.manifest!.input.name]: tensor });
    validateOutput(outputs[this.manifest!.outputs.find(output => output.axis === 'yaw')!.name] as ort.Tensor, this.manifest!.decoding.bins, 'yaw');
    validateOutput(outputs[this.manifest!.outputs.find(output => output.axis === 'pitch')!.name] as ort.Tensor, this.manifest!.decoding.bins, 'pitch');
  }

  private async run(video: HTMLVideoElement, observation: FaceLandmarkObservation, timestamp: number) {
    const started = performance.now();
    const tensor = createFaceTensor(video, observation, this.manifest!.input.shape[2]!, this.manifest!.input.normalization.mean, this.manifest!.input.normalization.std);
    const outputs = await this.session!.run({ [this.manifest!.input.name]: tensor });
    const yawName = this.manifest!.outputs.find(output => output.axis === 'yaw')!.name;
    const pitchName = this.manifest!.outputs.find(output => output.axis === 'pitch')!.name;
    const yawOutput = outputs[yawName] as ort.Tensor;
    const pitchOutput = outputs[pitchName] as ort.Tensor;
    validateOutput(yawOutput, this.manifest!.decoding.bins, yawName);
    validateOutput(pitchOutput, this.manifest!.decoding.bins, pitchName);
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

function createFaceTensor(video: HTMLVideoElement, observation: FaceLandmarkObservation, size: number, mean: number[], std: number[]): ort.Tensor {
  const bounds = observation.faceBounds;
  if (!bounds) throw new Error('L2CS face crop is unavailable.');
  const crop = getPaddedSquareCrop(bounds, video.videoWidth, video.videoHeight);
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const context = canvas.getContext('2d', { willReadFrequently: true });
  if (!context) throw new Error('L2CS could not create a canvas context.');
  context.drawImage(video, crop.left, crop.top, crop.size, crop.size, 0, 0, size, size);
  const pixels = context.getImageData(0, 0, size, size).data;
  const values = new Float32Array(3 * size * size);
  for (let index = 0; index < size * size; index += 1) for (let channel = 0; channel < 3; channel += 1) values[channel * size * size + index] = (pixels[index * 4 + channel] / 255 - mean[channel]!) / std[channel]!;
  return new ort.Tensor('float32', values, [1, 3, size, size]);
}

export function getPaddedSquareCrop(bounds: { left: number; top: number; right: number; bottom: number }, width: number, height: number): { left: number; top: number; size: number } {
  const left = Math.min(1, Math.max(0, bounds.left)) * width;
  const top = Math.min(1, Math.max(0, bounds.top)) * height;
  const right = Math.min(1, Math.max(0, bounds.right)) * width;
  const bottom = Math.min(1, Math.max(0, bounds.bottom)) * height;
  const size = Math.min(Math.max(right - left, bottom - top) * 1.25, width, height);
  return { left: Math.min(Math.max(0, (left + right - size) / 2), width - size), top: Math.min(Math.max(0, (top + bottom - size) / 2), height - size), size };
}

export function decodeAngle(values: unknown, decoding: L2CSManifest['decoding']): number {
  const logits = Array.from(values as Float32Array | Float64Array);
  const maximum = Math.max(...logits);
  const probabilities = logits.map(value => Math.exp(value - maximum));
  const total = probabilities.reduce((sum, value) => sum + value, 0);
  return probabilities.reduce((sum, value, index) => sum + value / total * index, 0) * decoding.degrees_per_bin + decoding.minimum_degrees;
}

function validateManifest(manifest: L2CSManifest): void {
  const shape = manifest?.input?.shape;
  if (!Array.isArray(shape) || shape.length !== 4 || shape[0] !== 1 || shape[1] !== 3 || !Number.isInteger(shape[2]) || shape[2] !== shape[3] || shape[2] <= 0) throw new Error('Invalid L2CS input shape in manifest.');
  const normalization = manifest.input.normalization;
  if (!normalization || normalization.mean.length !== 3 || normalization.std.length !== 3 || [...normalization.mean, ...normalization.std].some(value => !Number.isFinite(value) || value === 0)) throw new Error('Invalid L2CS normalization in manifest.');
  if (!Array.isArray(manifest.outputs) || manifest.outputs.length !== 2 || new Set(manifest.outputs.map(output => output.axis)).size !== 2 || manifest.outputs.some(output => !output.name || !['yaw', 'pitch'].includes(output.axis))) throw new Error('Invalid L2CS outputs in manifest.');
  if (!Number.isInteger(manifest.decoding.bins) || manifest.decoding.bins <= 0 || !Number.isFinite(manifest.decoding.degrees_per_bin) || !Number.isFinite(manifest.decoding.minimum_degrees)) throw new Error('Invalid L2CS decoding in manifest.');
}

function validateOutput(output: ort.Tensor, bins: number, name: string): void {
  if (!output || !output.data || output.data.length !== bins || output.data.some(value => !Number.isFinite(Number(value)))) throw new Error(`Invalid L2CS output tensor: ${name}.`);
}

function validateSessionContract(session: ort.InferenceSession, manifest: L2CSManifest): void {
  if (!session.inputNames.includes(manifest.input.name) || manifest.outputs.some(output => !session.outputNames.includes(output.name))) throw new Error('L2CS model does not match its manifest.');
}

function confidenceFromLogits(yaw: unknown, pitch: unknown): number { return Math.min(maxProbability(yaw), maxProbability(pitch)); }
function maxProbability(values: unknown): number {
  const logits = Array.from(values as Float32Array | Float64Array);
  const maximum = Math.max(...logits);
  const weights = logits.map(value => Math.exp(value - maximum));
  return Math.max(...weights) / weights.reduce((sum, value) => sum + value, 0);
}
