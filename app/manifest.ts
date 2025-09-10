import { MetadataRoute } from 'next'
 
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'QuantumPDF ChatApp - AI-Powered PDF Analysis',
    short_name: 'QuantumPDF',
    description: 'Transform your PDFs into intelligent conversations with AI-powered document analysis and chat capabilities.',
    start_url: '/',
    display: 'standalone',
    background_color: '#ffffff',
    theme_color: '#000000',
    orientation: 'portrait-primary',
    scope: '/',
    lang: 'en-US',
    categories: ['productivity', 'business', 'education', 'utilities'],
    screenshots: [
      {
        src: '/screenshot-wide.png',
        sizes: '1280x720',
        type: 'image/png',
        form_factor: 'wide'
      },
      {
        src: '/screenshot-narrow.png',
        sizes: '750x1334',
        type: 'image/png',
        form_factor: 'narrow'
      }
    ],
    icons: [
      {
        src: '/icon-192.png',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'maskable'
      },
      {
        src: '/icon-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable'
      },
      {
        src: '/apple-touch-icon.png',
        sizes: '180x180',
        type: 'image/png'
      },
      {
        src: '/favicon-32x32.png',
        sizes: '32x32',
        type: 'image/png'
      },
      {
        src: '/favicon-16x16.png',
        sizes: '16x16',
        type: 'image/png'
      }
    ],
    shortcuts: [
      {
        name: 'Upload PDF',
        short_name: 'Upload',
        description: 'Upload a new PDF document for analysis',
        url: '/?action=upload',
        icons: [{ src: '/upload-icon.png', sizes: '96x96' }]
      },
      {
        name: 'New Chat',
        short_name: 'Chat',
        description: 'Start a new conversation with your documents',
        url: '/?action=chat',
        icons: [{ src: '/chat-icon.png', sizes: '96x96' }]
      }
    ],
    related_applications: [],
    prefer_related_applications: false
  }
}
