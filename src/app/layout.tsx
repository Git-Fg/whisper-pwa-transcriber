import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Whisper PWA Transcriber',
  description: 'Transcription vocale offline avec Whisper et accélération WebGPU',
  manifest: '/manifest.json',
  icons: {
    icon: '/icon-192x192.png',
    apple: '/icon-192x192.png'
  },
  themeColor: '#1a1a1a'
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="fr">
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="theme-color" content="#1a1a1a" />
        <link rel="manifest" href="/manifest.json" />
      </head>
      <body className="bg-gray-50 dark:bg-gray-900 font-sans">
        <div id="root" className="min-h-screen">
          {children}
        </div>
      </body>
    </html>
  )
}