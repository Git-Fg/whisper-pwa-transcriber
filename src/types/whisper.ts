export type WhisperModelSize = 'tiny' | 'small' | 'large-v3-turbo';
export type DeviceType = 'cpu' | 'webgpu';
export type PrecisionType = 'fp16' | 'fp32';
export type TaskType = 'transcribe' | 'translate';

export interface HardwareCapabilities {
  hasWebGPU: boolean;
  hasMPS: boolean;
  memoryGB: number;
  recommendedModel: WhisperModelSize;
  maxBatchSize: number;
  supportedPrecision: PrecisionType;
}

export interface WhisperConfig {
  model: WhisperModelSize;
  language?: string;
  task: TaskType;
  device: DeviceType;
  dtype: PrecisionType;
  chunkLengthS?: number;
  strideLengthS?: number;
}

export interface TranscriptionSegment {
  id: number;
  start: number;
  end: number;
  text: string;
  confidence?: number;
}

export interface TranscriptionResult {
  text: string;
  confidence?: number;
  duration: number;
  language?: string;
  segments: TranscriptionSegment[];
  processing_time: number;
  model_used: WhisperModelSize;
  device_used: DeviceType;
}

export interface AudioProcessingOptions {
  maxDuration?: number;
  sampleRate: number;
  channels: number;
  format: 'webm' | 'mp4' | 'wav';
  enableVAD?: boolean; // Voice Activity Detection
}

export interface ModelInfo {
  name: string;
  size: WhisperModelSize;
  memoryRequirementMB: number;
  downloadSizeMB: number;
  accuracy: 'low' | 'medium' | 'high';
  speed: 'slow' | 'medium' | 'fast';
  supportedLanguages: string[];
}

export interface TranscriptionProgress {
  stage: 'initializing' | 'loading_model' | 'processing' | 'completed' | 'error';
  percentage: number;
  message: string;
  estimated_time_remaining?: number;
}

export interface TranscriptionError extends Error {
  code: 'WEBGPU_NOT_SUPPORTED' | 'MODEL_LOAD_FAILED' | 'AUDIO_PROCESSING_FAILED' | 'MEMORY_INSUFFICIENT';
  details?: Record<string, any>;
}

export interface AudioBuffer {
  data: Float32Array;
  sampleRate: number;
  channels: number;
  duration: number;
}