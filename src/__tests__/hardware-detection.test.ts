/**
 * @jest-environment jsdom
 */
import { HardwareDetector } from '@/lib/hardware-detection'
import type { HardwareCapabilities } from '@/types/whisper'

// Mock navigator for testing environment
const mockNavigator = {
  gpu: undefined,
  hardwareConcurrency: 4,
  platform: 'linux'
}

Object.defineProperty(global, 'navigator', {
  value: mockNavigator,
  writable: true
})

// Mock performance.memory
Object.defineProperty(global, 'performance', {
  value: {
    ...global.performance,
    memory: undefined
  },
  writable: true
})

describe('HardwareDetector', () => {
  let detector: HardwareDetector

  beforeEach(() => {
    detector = HardwareDetector.getInstance()
    // Reset the capabilities for each test
    ;(detector as any).capabilities = null
  })

  describe('detectCapabilities', () => {
    it('should detect CPU-only capabilities when WebGPU is not available', async () => {
      const capabilities = await detector.detectCapabilities()
      
      expect(capabilities).toBeDefined()
      expect(capabilities.hasWebGPU).toBe(false)
      expect(capabilities.hasMPS).toBe(false)
      expect(capabilities.recommendedModel).toBe('small') // 4 cores = 4GB = small model
      expect(capabilities.supportedPrecision).toBe('fp32')
      expect(capabilities.memoryGB).toBeGreaterThan(0)
      expect(capabilities.maxBatchSize).toBeGreaterThan(0)
    })

    it('should use hardwareConcurrency for memory estimation fallback', async () => {
      const capabilities = await detector.detectCapabilities()
      
      // With 4 cores, should estimate 4GB
      expect(capabilities.memoryGB).toBe(4)
    })

    it('should recommend correct model based on capabilities', async () => {
      const capabilities = await detector.detectCapabilities()
      
      expect(['tiny', 'small', 'large-v3-turbo']).toContain(capabilities.recommendedModel)
    })

    it('should return cached capabilities on subsequent calls', async () => {
      const capabilities1 = await detector.detectCapabilities()
      const capabilities2 = await detector.detectCapabilities()
      
      expect(capabilities1).toBe(capabilities2)
    })
  })

  describe('getRecommendedDevice', () => {
    it('should recommend CPU when WebGPU is not available', () => {
      const capabilities: HardwareCapabilities = {
        hasWebGPU: false,
        hasMPS: false,
        memoryGB: 4,
        recommendedModel: 'tiny',
        maxBatchSize: 1,
        supportedPrecision: 'fp32'
      }
      
      const device = detector.getRecommendedDevice(capabilities)
      expect(device).toBe('cpu')
    })

    it('should recommend WebGPU when available', () => {
      const capabilities: HardwareCapabilities = {
        hasWebGPU: true,
        hasMPS: false,
        memoryGB: 8,
        recommendedModel: 'small',
        maxBatchSize: 2,
        supportedPrecision: 'fp16'
      }
      
      const device = detector.getRecommendedDevice(capabilities)
      expect(device).toBe('webgpu')
    })
  })

  describe('canRunModel', () => {
    it('should allow tiny model with minimal memory', () => {
      const capabilities: HardwareCapabilities = {
        hasWebGPU: false,
        hasMPS: false,
        memoryGB: 1,
        recommendedModel: 'tiny',
        maxBatchSize: 1,
        supportedPrecision: 'fp32'
      }
      
      expect(detector.canRunModel('tiny', capabilities)).toBe(true)
    })

    it('should reject large model with insufficient memory', () => {
      const capabilities: HardwareCapabilities = {
        hasWebGPU: false,
        hasMPS: false,
        memoryGB: 2,
        recommendedModel: 'tiny',
        maxBatchSize: 1,
        supportedPrecision: 'fp32'
      }
      
      expect(detector.canRunModel('large-v3-turbo', capabilities)).toBe(false)
    })

    it('should allow large model with sufficient memory', () => {
      const capabilities: HardwareCapabilities = {
        hasWebGPU: true,
        hasMPS: false,
        memoryGB: 8,
        recommendedModel: 'large-v3-turbo',
        maxBatchSize: 1,
        supportedPrecision: 'fp16'
      }
      
      expect(detector.canRunModel('large-v3-turbo', capabilities)).toBe(true)
    })
  })
})