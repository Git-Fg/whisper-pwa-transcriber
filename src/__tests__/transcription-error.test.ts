/**
 * @jest-environment jsdom
 */
import { TranscriptionError } from '@/types/whisper'

describe('TranscriptionError', () => {
  it('should create error with proper properties', () => {
    const error = new TranscriptionError('Test error message', {
      code: 'MODEL_LOAD_FAILED',
      details: { test: 'data' }
    })
    
    expect(error).toBeInstanceOf(Error)
    expect(error).toBeInstanceOf(TranscriptionError)
    expect(error.name).toBe('TranscriptionError')
    expect(error.message).toBe('Test error message')
    expect(error.code).toBe('MODEL_LOAD_FAILED')
    expect(error.details).toEqual({ test: 'data' })
  })

  it('should work with instanceof checks', () => {
    const error = new TranscriptionError('Test', { code: 'AUDIO_PROCESSING_FAILED' })
    
    expect(error instanceof Error).toBe(true)
    expect(error instanceof TranscriptionError).toBe(true)
  })

  it('should work without details', () => {
    const error = new TranscriptionError('Test without details', {
      code: 'WEBGPU_NOT_SUPPORTED'
    })
    
    expect(error.details).toBeUndefined()
    expect(error.code).toBe('WEBGPU_NOT_SUPPORTED')
  })

  it('should support all error codes', () => {
    const codes: Array<'WEBGPU_NOT_SUPPORTED' | 'MODEL_LOAD_FAILED' | 'AUDIO_PROCESSING_FAILED' | 'MEMORY_INSUFFICIENT'> = [
      'WEBGPU_NOT_SUPPORTED',
      'MODEL_LOAD_FAILED', 
      'AUDIO_PROCESSING_FAILED',
      'MEMORY_INSUFFICIENT'
    ]
    
    codes.forEach(code => {
      const error = new TranscriptionError('Test', { code })
      expect(error.code).toBe(code)
    })
  })
})