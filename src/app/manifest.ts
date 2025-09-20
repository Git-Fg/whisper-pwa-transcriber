import type { MetadataRoute } from 'next'

export const dynamic = 'force-static'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Whisper PWA Transcriber',
    short_name: 'WhisperPWA',
    description: 'Transcription vocale offline avec Whisper et accélération WebGPU',
    start_url: '/',
    display: 'standalone',
    background_color: '#ffffff',
    theme_color: '#1a1a1a',
    orientation: 'portrait-primary',
    
    icons: [
      {
        src: '/icon-72x72.png',
        sizes: '72x72',
        type: 'image/png',
        purpose: 'maskable'
      },
      {
        src: '/icon-96x96.png',
        sizes: '96x96',
        type: 'image/png',
        purpose: 'maskable'
      },
      {
        src: '/icon-128x128.png',
        sizes: '128x128',
        type: 'image/png',
        purpose: 'maskable'
      },
      {
        src: '/icon-144x144.png',
        sizes: '144x144',
        type: 'image/png',
        purpose: 'maskable'
      },
      {
        src: '/icon-152x152.png',
        sizes: '152x152',
        type: 'image/png',
        purpose: 'maskable'
      },
      {
        src: '/icon-192x192.png',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'any'
      },
      {
        src: '/icon-384x384.png',
        sizes: '384x384',
        type: 'image/png',
        purpose: 'any'
      },
      {
        src: '/icon-512x512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any'
      }
    ],
    
    categories: ['productivity', 'utilities', 'developer'],
    
    shortcuts: [
      {
        name: 'Nouvelle transcription',
        short_name: 'Transcrire',
        description: 'Démarrer une nouvelle transcription audio',
        url: '/?action=transcribe',
        icons: [
          {
            src: '/shortcut-transcribe.png',
            sizes: '96x96',
            type: 'image/png'
          }
        ]
      },
      {
        name: 'Paramètres',
        short_name: 'Config',
        description: 'Configurer les modèles et paramètres',
        url: '/?action=settings',
        icons: [
          {
            src: '/shortcut-settings.png',
            sizes: '96x96',
            type: 'image/png'
          }
        ]
      }
    ],
    
    screenshots: [
      {
        src: '/screenshot-desktop.png',
        sizes: '1280x720',
        type: 'image/png',
        form_factor: 'wide',
        label: 'Interface de transcription sur desktop'
      },
      {
        src: '/screenshot-mobile.png',
        sizes: '390x844',
        type: 'image/png',
        form_factor: 'narrow',
        label: 'Interface mobile de transcription'
      }
    ],
    
    // Définit les protocoles supportés
    protocol_handlers: [
      {
        protocol: 'web+whisper',
        url: '/?audio=%s'
      }
    ],
    
    // Types de fichiers supportés
    file_handlers: [
      {
        action: '/',
        accept: {
          'audio/*': ['.mp3', '.wav', '.m4a', '.webm', '.ogg', '.flac', '.aac'],
          'video/*': ['.mp4', '.webm', '.avi', '.mov']
        }
      }
    ],
    
    // Capacités spéciales
    display_override: ['window-controls-overlay', 'standalone', 'minimal-ui'],
    
    // Configuration pour le partage
    share_target: {
      action: '/share',
      method: 'POST',
      enctype: 'multipart/form-data',
      params: {
        files: [
          {
            name: 'audio',
            accept: ['audio/*', 'video/*']
          }
        ]
      }
    },
    
    // Préférences d'installation
    prefer_related_applications: false
  }
}