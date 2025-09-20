import type { HardwareCapabilities, WhisperModelSize, DeviceType, PrecisionType } from '@/types/whisper';

/**
 * Détecte les capacités matérielles du système pour optimiser la sélection du modèle Whisper
 */
export class HardwareDetector {
  private static instance: HardwareDetector;
  private capabilities: HardwareCapabilities | null = null;

  public static getInstance(): HardwareDetector {
    if (!HardwareDetector.instance) {
      HardwareDetector.instance = new HardwareDetector();
    }
    return HardwareDetector.instance;
  }

  /**
   * Détecte et retourne les capacités matérielles complètes
   */
  public async detectCapabilities(): Promise<HardwareCapabilities> {
    if (this.capabilities) {
      return this.capabilities;
    }

    const capabilities: HardwareCapabilities = {
      hasWebGPU: false,
      hasMPS: false,
      memoryGB: 0,
      recommendedModel: 'tiny',
      maxBatchSize: 1,
      supportedPrecision: 'fp32'
    };

    // Détection WebGPU
    capabilities.hasWebGPU = await this.detectWebGPU();
    
    // Détection MPS (Metal Performance Shaders) sur macOS
    if (capabilities.hasWebGPU) {
      capabilities.hasMPS = await this.detectMPS();
    }

    // Estimation de la mémoire disponible
    capabilities.memoryGB = this.estimateMemory();

    // Calcul des recommandations optimales
    capabilities.recommendedModel = this.getRecommendedModel(capabilities);
    capabilities.maxBatchSize = this.getOptimalBatchSize(capabilities);
    capabilities.supportedPrecision = this.getSupportedPrecision(capabilities);

    this.capabilities = capabilities;
    return capabilities;
  }

  /**
   * Détecte le support WebGPU
   */
  private async detectWebGPU(): Promise<boolean> {
    if (!navigator.gpu) {
      console.info('WebGPU non disponible dans ce navigateur');
      return false;
    }

    try {
      const adapter = await navigator.gpu.requestAdapter({
        powerPreference: 'high-performance'
      });
      
      if (!adapter) {
        console.warn('Aucun adaptateur WebGPU trouvé');
        return false;
      }

      // Test de création d'un device pour confirmer le support
      const device = await adapter.requestDevice();
      device.destroy();
      
      console.info('WebGPU détecté et fonctionnel');
      return true;
    } catch (error) {
      console.warn('Erreur lors de la détection WebGPU:', error);
      return false;
    }
  }

  /**
   * Détecte le support MPS (Metal Performance Shaders) sur macOS
   */
  private async detectMPS(): Promise<boolean> {
    if (!navigator.gpu) return false;

    try {
      const adapter = await navigator.gpu.requestAdapter();
      if (!adapter) return false;

      // Vérification des informations de l'adaptateur
      const adapterInfo = await adapter.requestAdapterInfo?.();
      
      if (adapterInfo?.description?.toLowerCase().includes('apple') ||
          adapterInfo?.vendor?.toLowerCase().includes('apple')) {
        console.info('Support MPS (Apple Silicon) détecté');
        return true;
      }

      // Fallback: détection via user agent et platform
      const isMac = navigator.platform.toLowerCase().includes('mac') ||
                   navigator.userAgent.toLowerCase().includes('mac');
      
      if (isMac && adapterInfo?.description?.toLowerCase().includes('metal')) {
        console.info('Support Metal détecté sur macOS');
        return true;
      }

      return false;
    } catch (error) {
      console.warn('Erreur lors de la détection MPS:', error);
      return false;
    }
  }

  /**
   * Estime la mémoire disponible du système
   */
  private estimateMemory(): number {
    if ('memory' in performance && (performance as any).memory) {
      const memInfo = (performance as any).memory;
      // Convertit en GB et estime la mémoire utilisable
      const totalHeapMB = memInfo.jsHeapSizeLimit / (1024 * 1024);
      const estimatedSystemMemoryGB = Math.max(4, totalHeapMB / 256); // Estimation conservative
      
      console.info(`Mémoire estimée: ${estimatedSystemMemoryGB.toFixed(1)} GB`);
      return estimatedSystemMemoryGB;
    }

    // Fallback basé sur les capacités détectées
    if (navigator.hardwareConcurrency) {
      const cores = navigator.hardwareConcurrency;
      return cores >= 8 ? 8 : cores >= 4 ? 4 : 2;
    }

    return 2; // Valeur par défaut conservative
  }

  /**
   * Recommande le modèle optimal basé sur les capacités matérielles
   */
  private getRecommendedModel(capabilities: HardwareCapabilities): WhisperModelSize {
    const { hasWebGPU, hasMPS, memoryGB } = capabilities;

    // Apple Silicon avec MPS - peut gérer les gros modèles
    if (hasMPS && memoryGB >= 8) {
      return 'large-v3-turbo';
    }

    // WebGPU avec mémoire suffisante
    if (hasWebGPU && memoryGB >= 6) {
      return 'large-v3-turbo';
    }

    // Configuration intermédiaire
    if ((hasWebGPU || memoryGB >= 4)) {
      return 'small';
    }

    // Configuration minimale
    return 'tiny';
  }

  /**
   * Calcule la taille de batch optimale
   */
  private getOptimalBatchSize(capabilities: HardwareCapabilities): number {
    const { hasWebGPU, memoryGB, recommendedModel } = capabilities;

    if (!hasWebGPU) return 1;

    // Ajustement basé sur le modèle et la mémoire
    const baseSize = recommendedModel === 'large-v3-turbo' ? 1 :
                    recommendedModel === 'small' ? 2 : 4;

    return Math.min(baseSize, Math.floor(memoryGB / 2));
  }

  /**
   * Détermine la précision supportée
   */
  private getSupportedPrecision(capabilities: HardwareCapabilities): PrecisionType {
    // WebGPU supporte généralement fp16 pour de meilleures performances
    return capabilities.hasWebGPU ? 'fp16' : 'fp32';
  }

  /**
   * Retourne le type d'appareil recommandé
   */
  public getRecommendedDevice(capabilities: HardwareCapabilities): DeviceType {
    return capabilities.hasWebGPU ? 'webgpu' : 'cpu';
  }

  /**
   * Vérifie si les capacités permettent l'exécution d'un modèle spécifique
   */
  public canRunModel(model: WhisperModelSize, capabilities: HardwareCapabilities): boolean {
    const memoryRequirements = {
      'tiny': 1,
      'small': 2,
      'large-v3-turbo': 4
    };

    return capabilities.memoryGB >= memoryRequirements[model];
  }
}