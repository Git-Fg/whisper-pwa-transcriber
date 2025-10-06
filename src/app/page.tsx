'use client'

import { useState, useCallback, useRef } from 'react'
import { TranscriptionProgress, TranscriptionResult, HardwareCapabilities } from '@/types/whisper'
import type { WhisperTranscriber } from '@/lib/whisper-transcriber'

interface TranscriptionState {
  isRecording: boolean
  isTranscribing: boolean
  result: TranscriptionResult | null
  progress: TranscriptionProgress | null
  error: string | null
  capabilities: HardwareCapabilities | null
}

export default function Home() {
  const [state, setState] = useState<TranscriptionState>({
    isRecording: false,
    isTranscribing: false,
    result: null,
    progress: null,
    error: null,
    capabilities: null
  })
  
  const transcriberRef = useRef<WhisperTranscriber | null>(null)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioChunksRef = useRef<Blob[]>([])

  const initializeTranscriber = useCallback(async () => {
    try {
      if (!transcriberRef.current) {
        // Dynamic import to avoid build issues
        const { WhisperTranscriber } = await import('@/lib/whisper-transcriber')
        const { HardwareDetector } = await import('@/lib/hardware-detection')
        
        const transcriber = new WhisperTranscriber((progress) => {
          setState(prev => ({ ...prev, progress }))
        })
        
        setState(prev => ({ ...prev, progress: { stage: 'initializing', percentage: 0, message: 'Initialisation...' } }))
        await transcriber.initialize()
        
        const hardwareDetector = HardwareDetector.getInstance()
        const capabilities = await hardwareDetector.detectCapabilities()
        
        transcriberRef.current = transcriber
        setState(prev => ({ 
          ...prev, 
          capabilities,
          progress: { stage: 'completed', percentage: 100, message: 'Prêt pour la transcription' },
          error: null
        }))
      }
    } catch (error) {
      setState(prev => ({ 
        ...prev, 
        error: `Erreur d'initialisation: ${error instanceof Error ? error.message : 'Erreur inconnue'}`,
        progress: null
      }))
    }
  }, [])

  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const mediaRecorder = new MediaRecorder(stream)
      
      audioChunksRef.current = []
      
      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data)
        }
      }
      
      mediaRecorder.start()
      mediaRecorderRef.current = mediaRecorder
      setState(prev => ({ ...prev, isRecording: true, error: null }))
      
    } catch (error) {
      setState(prev => ({ 
        ...prev, 
        error: `Erreur d'accès au microphone: ${error instanceof Error ? error.message : 'Erreur inconnue'}`
      }))
    }
  }, [])

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop()
      setState(prev => ({ ...prev, isRecording: false }))
      
      mediaRecorderRef.current.onstop = async () => {
        if (audioChunksRef.current.length > 0) {
          const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' })
          await transcribeAudio(audioBlob)
        }
      }
    }
  }, [])

  const transcribeAudio = useCallback(async (audioBlob: Blob) => {
    if (!transcriberRef.current) {
      await initializeTranscriber()
      if (!transcriberRef.current) return
    }

    try {
      setState(prev => ({ ...prev, isTranscribing: true, result: null, error: null }))
      
      const result = await transcriberRef.current.transcribe(audioBlob)
      
      setState(prev => ({ 
        ...prev, 
        result, 
        isTranscribing: false,
        progress: { stage: 'completed', percentage: 100, message: 'Transcription terminée' }
      }))
    } catch (error) {
      setState(prev => ({ 
        ...prev, 
        isTranscribing: false,
        error: `Erreur de transcription: ${error instanceof Error ? error.message : 'Erreur inconnue'}`,
        progress: null
      }))
    }
  }, [initializeTranscriber])

  const handleFileUpload = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (file) {
      await transcribeAudio(file)
    }
  }, [transcribeAudio])

  return (
    <main className="container mx-auto px-4 py-8 max-w-4xl">
      <div className="text-center mb-8">
        <h1 className="text-4xl font-bold mb-4 text-gray-900 dark:text-gray-100">
          Whisper PWA Transcriber
        </h1>
        <p className="text-lg text-gray-600 dark:text-gray-400 mb-6">
          Transcription vocale offline avec accélération WebGPU
        </p>
        
        {state.capabilities && (
          <div className="bg-blue-50 dark:bg-blue-900 rounded-lg p-4 mb-6">
            <h3 className="font-semibold text-blue-900 dark:text-blue-100 mb-2">Capacités détectées:</h3>
            <div className="text-sm text-blue-800 dark:text-blue-200 space-y-1">
              <p>WebGPU: {state.capabilities.hasWebGPU ? '✅ Supporté' : '❌ Non disponible'}</p>
              <p>Modèle recommandé: {state.capabilities.recommendedModel}</p>
              <p>Mémoire estimée: {state.capabilities.memoryGB} GB</p>
              <p>Device: {state.capabilities.hasWebGPU ? 'WebGPU' : 'CPU'}</p>
            </div>
          </div>
        )}
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 mb-6">
        <div className="space-y-4">
          {!transcriberRef.current && (
            <button
              onClick={initializeTranscriber}
              disabled={state.progress?.stage === 'initializing'}
              className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white font-medium py-3 px-6 rounded-lg transition-colors"
            >
              {state.progress?.stage === 'initializing' ? 'Initialisation...' : 'Initialiser Whisper'}
            </button>
          )}
          
          {transcriberRef.current && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-4">
                <h3 className="font-semibold text-gray-900 dark:text-gray-100">Enregistrement vocal</h3>
                <button
                  onClick={state.isRecording ? stopRecording : startRecording}
                  disabled={state.isTranscribing}
                  className={`w-full font-medium py-3 px-6 rounded-lg transition-colors ${
                    state.isRecording
                      ? 'bg-red-600 hover:bg-red-700 text-white'
                      : 'bg-green-600 hover:bg-green-700 text-white'
                  } disabled:opacity-50`}
                >
                  {state.isRecording ? '⏹️ Arrêter' : '🎤 Commencer'}
                </button>
              </div>
              
              <div className="space-y-4">
                <h3 className="font-semibold text-gray-900 dark:text-gray-100">Fichier audio</h3>
                <input
                  type="file"
                  accept="audio/*,video/*"
                  onChange={handleFileUpload}
                  disabled={state.isTranscribing}
                  className="w-full text-sm text-gray-500 dark:text-gray-400 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 dark:file:bg-blue-900 dark:file:text-blue-300"
                />
              </div>
            </div>
          )}
        </div>

        {state.progress && (
          <div className="mt-6">
            <div className="flex justify-between text-sm text-gray-600 dark:text-gray-400 mb-2">
              <span>{state.progress.message}</span>
              <span>{state.progress.percentage}%</span>
            </div>
            <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
              <div
                className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                style={{ width: `${state.progress.percentage}%` }}
              />
            </div>
          </div>
        )}

        {state.isTranscribing && (
          <div className="mt-6 text-center">
            <div className="loading-dots inline-flex space-x-1">
              <span className="w-2 h-2 bg-blue-600 rounded-full"></span>
              <span className="w-2 h-2 bg-blue-600 rounded-full"></span>
              <span className="w-2 h-2 bg-blue-600 rounded-full"></span>
            </div>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">Transcription en cours...</p>
          </div>
        )}

        {state.error && (
          <div className="mt-6 bg-red-50 dark:bg-red-900 border border-red-200 dark:border-red-700 rounded-lg p-4">
            <p className="text-red-800 dark:text-red-200 text-sm">{state.error}</p>
          </div>
        )}
      </div>

      {state.result && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
          <h3 className="text-xl font-semibold mb-4 text-gray-900 dark:text-gray-100">Résultat de la transcription</h3>
          
          <div className="space-y-4">
            <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
              <p className="text-gray-900 dark:text-gray-100 whitespace-pre-wrap">{state.result.text}</p>
            </div>
            
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div>
                <span className="font-medium text-gray-600 dark:text-gray-400">Durée:</span>
                <p className="text-gray-900 dark:text-gray-100">{state.result.duration.toFixed(2)}s</p>
              </div>
              <div>
                <span className="font-medium text-gray-600 dark:text-gray-400">Modèle:</span>
                <p className="text-gray-900 dark:text-gray-100">{state.result.model_used}</p>
              </div>
              <div>
                <span className="font-medium text-gray-600 dark:text-gray-400">Device:</span>
                <p className="text-gray-900 dark:text-gray-100">{state.result.device_used}</p>
              </div>
              <div>
                <span className="font-medium text-gray-600 dark:text-gray-400">Temps de traitement:</span>
                <p className="text-gray-900 dark:text-gray-100">{state.result.processing_time.toFixed(2)}s</p>
              </div>
            </div>
            
            {state.result.segments.length > 0 && (
              <div>
                <h4 className="font-medium text-gray-900 dark:text-gray-100 mb-2">Segments temporels:</h4>
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {state.result.segments.map((segment) => (
                    <div key={segment.id} className="bg-gray-50 dark:bg-gray-700 rounded p-3">
                      <div className="flex justify-between items-start mb-1">
                        <span className="text-xs font-medium text-gray-600 dark:text-gray-400">
                          {segment.start.toFixed(1)}s - {segment.end.toFixed(1)}s
                        </span>
                        {segment.confidence && (
                          <span className="text-xs text-gray-500 dark:text-gray-500">
                            {(segment.confidence * 100).toFixed(0)}%
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-gray-900 dark:text-gray-100">{segment.text}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </main>
  )
}