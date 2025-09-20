import { pipeline, Pipeline } from '@huggingface/transformers';
import type {
  WhisperConfig,
  TranscriptionResult,
  TranscriptionProgress,
  AudioBuffer,
  HardwareCapabilities,
  WhisperModelSize
} from '@/types/whisper';
import { TranscriptionError } from '@/types/whisper';
import { HardwareDetector } from './hardware-detection';

/**
 * Gestionnaire principal pour la transcription Whisper avec optimisation matérielle
 */
export class WhisperTranscriber {
  private pipeline: Pipeline | null = null;
  private config: WhisperConfig | null = null;
  private capabilities: HardwareCapabilities | null = null;
  private isInitialized: boolean = false;
  private progressCallback: ((progress: TranscriptionProgress) => void) | undefined;

  /**
   * Mappings des modèles Whisper optimisés pour le navigateur
   */
  private readonly MODEL_MAPPINGS = {
    'tiny': 'onnx-community/whisper-tiny.en',
    'small': 'onnx-community/whisper-small',
    'large-v3-turbo': 'onnx-community/whisper-large-v3-turbo'
  } as const;

  /**
   * Configurations de mémoire par modèle (en MB)
   */
  private readonly MEMORY_REQUIREMENTS = {
    'tiny': 240,
    'small': 488,
    'large-v3-turbo': 1550
  } as const;

  constructor(progressCallback?: (progress: TranscriptionProgress) => void) {
    this.progressCallback = progressCallback;
  }

  /**
   * Initialise le transcripteur avec détection automatique des capacités
   */
  public async initialize(customConfig?: Partial<WhisperConfig>): Promise<void> {
    if (this.isInitialized) {
      console.warn('Transcripteur déjà initialisé');
      return;
    }

    try {
      this.updateProgress('initializing', 0, 'Détection des capacités matérielles...');
      
      // Détection des capacités matérielles
      const hardwareDetector = HardwareDetector.getInstance();
      this.capabilities = await hardwareDetector.detectCapabilities();
      
      this.updateProgress('initializing', 20, 'Configuration du modèle optimal...');
      
      // Configuration automatique ou personnalisée
      this.config = {
        model: customConfig?.model || this.capabilities.recommendedModel,
        language: customConfig?.language || 'auto',
        task: customConfig?.task || 'transcribe',
        device: customConfig?.device || hardwareDetector.getRecommendedDevice(this.capabilities),
        dtype: customConfig?.dtype || this.capabilities.supportedPrecision,
        chunkLengthS: customConfig?.chunkLengthS || 30,
        strideLengthS: customConfig?.strideLengthS || 5
      };

      // Vérification de la compatibilité
      if (!hardwareDetector.canRunModel(this.config.model, this.capabilities)) {
        throw new TranscriptionError(
          `Mémoire insuffisante pour le modèle ${this.config.model}`,
          { code: 'MEMORY_INSUFFICIENT' }
        );
      }

      this.updateProgress('loading_model', 40, `Chargement du modèle ${this.config.model}...`);
      
      // Chargement du modèle avec configuration optimisée
      await this.loadModel();
      
      this.updateProgress('completed', 100, 'Transcripteur prêt');
      this.isInitialized = true;
      
      console.info('Whisper transcripteur initialisé:', {
        model: this.config.model,
        device: this.config.device,
        dtype: this.config.dtype,
        capabilities: this.capabilities
      });
      
    } catch (error) {
      const transcriptionError = error instanceof TranscriptionError ? error :
        new TranscriptionError(
          `Erreur d'initialisation: ${error instanceof Error ? error.message : 'Erreur inconnue'}`,
          { code: 'MODEL_LOAD_FAILED', details: { originalError: error } }
        );
      
      this.updateProgress('error', 0, transcriptionError.message);
      throw transcriptionError;
    }
  }

  /**
   * Charge le modèle Whisper avec les paramètres optimaux
   */
  private async loadModel(): Promise<void> {
    if (!this.config) {
      throw new Error('Configuration non initialisée');
    }

    const modelId = this.MODEL_MAPPINGS[this.config.model];
    
    try {
      // Configuration spécifique pour les différents devices
      const pipelineOptions: any = {
        device: this.config.device,
        dtype: this.config.dtype
      };

      // Options spécifiques WebGPU
      if (this.config.device === 'webgpu') {
        pipelineOptions.webgpu = {
          adapter: await navigator.gpu?.requestAdapter({
            powerPreference: 'high-performance'
          })
        };
      }

      // Create the pipeline with explicit typing
      const createPipeline = pipeline as any;
      this.pipeline = await createPipeline(
        'automatic-speech-recognition',
        modelId,
        pipelineOptions
      );

    } catch (error) {
      throw new TranscriptionError(
        `Impossible de charger le modèle ${this.config.model}`,
        { 
          code: 'MODEL_LOAD_FAILED', 
          details: { modelId, error } 
        }
      );
    }
  }

  /**
   * Transcrit un fichier audio en texte
   */
  public async transcribe(
    audioInput: Blob | File | AudioBuffer,
    options?: { language?: string; task?: 'transcribe' | 'translate' }
  ): Promise<TranscriptionResult> {
    if (!this.isInitialized || !this.pipeline || !this.config || !this.capabilities) {
      throw new TranscriptionError(
        'Transcripteur non initialisé. Appelez initialize() d’abord.',
        { code: 'MODEL_LOAD_FAILED' }
      );
    }

    const startTime = performance.now();
    
    try {
      this.updateProgress('processing', 0, 'Préparation de l’audio...');
      
      // Traitement de l'entrée audio
      const audioBuffer = await this.prepareAudioInput(audioInput);
      
      this.updateProgress('processing', 30, 'Transcription en cours...');
      
      // Configuration de transcription
      const transcriptionOptions = {
        language: options?.language || this.config.language,
        task: options?.task || this.config.task,
        chunk_length_s: this.config.chunkLengthS,
        stride_length_s: this.config.strideLengthS,
        return_timestamps: true,
        return_token_timestamps: false
      };

      // Exécution de la transcription
      const result = await this.pipeline(audioBuffer.data, transcriptionOptions);
      
      this.updateProgress('processing', 90, 'Finalisation...');
      
      const processingTime = performance.now() - startTime;
      
      // Formatage du résultat
      const transcriptionResult: TranscriptionResult = {
        text: result.text,
        confidence: result.confidence,
        duration: audioBuffer.duration,
        language: result.language || options?.language,
        segments: this.processSegments(result.chunks || []),
        processing_time: processingTime,
        model_used: this.config.model,
        device_used: this.config.device
      };
      
      this.updateProgress('completed', 100, 'Transcription terminée');
      
      return transcriptionResult;
      
    } catch (error) {
      const transcriptionError = error instanceof TranscriptionError ? error :
        new TranscriptionError(
          `Erreur de transcription: ${error instanceof Error ? error.message : 'Erreur inconnue'}`,
          { code: 'AUDIO_PROCESSING_FAILED', details: { originalError: error } }
        );
      
      this.updateProgress('error', 0, transcriptionError.message);
      throw transcriptionError;
    }
  }

  /**
   * Prépare l'entrée audio pour la transcription
   */
  private async prepareAudioInput(input: Blob | File | AudioBuffer): Promise<AudioBuffer> {
    if ('data' in input) {
      // Déjà un AudioBuffer
      return input;
    }

    // Conversion Blob/File vers AudioBuffer
    const arrayBuffer = await input.arrayBuffer();
    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    
    try {
      const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
      
      // Conversion vers le format attendu par Whisper
      const channelData = audioBuffer.getChannelData(0); // Mono
      
      return {
        data: channelData,
        sampleRate: audioBuffer.sampleRate,
        channels: 1, // Whisper fonctionne en mono
        duration: audioBuffer.duration
      };
    } finally {
      await audioContext.close();
    }
  }

  /**
   * Traite les segments de transcription
   */
  private processSegments(chunks: any[]): TranscriptionResult['segments'] {
    return chunks.map((chunk, index) => ({
      id: index,
      start: chunk.timestamp?.[0] || 0,
      end: chunk.timestamp?.[1] || 0,
      text: chunk.text || '',
      confidence: chunk.confidence
    }));
  }

  /**
   * Met à jour le progrès de transcription
   */
  private updateProgress(
    stage: TranscriptionProgress['stage'],
    percentage: number,
    message: string
  ): void {
    if (this.progressCallback) {
      this.progressCallback({
        stage,
        percentage,
        message
      });
    }
  }

  /**
   * Libère les ressources
   */
  public async cleanup(): Promise<void> {
    if (this.pipeline) {
      try {
        // Nettoyage spécifique selon le type de pipeline
        if (typeof (this.pipeline as any).dispose === 'function') {
          await (this.pipeline as any).dispose();
        }
      } catch (error) {
        console.warn('Erreur lors du nettoyage du pipeline:', error);
      }
      
      this.pipeline = null;
    }
    
    this.config = null;
    this.capabilities = null;
    this.isInitialized = false;
  }

  /**
   * Getters pour l'accès aux informations
   */
  public get isReady(): boolean {
    return this.isInitialized;
  }

  public get currentConfig(): WhisperConfig | null {
    return this.config;
  }

  public get detectedCapabilities(): HardwareCapabilities | null {
    return this.capabilities;
  }
}