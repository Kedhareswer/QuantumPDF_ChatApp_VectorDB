import { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'QuantumPDF ChatApp - AI-Powered PDF Analysis',
    short_name: 'QuantumPDF',
    description: 'Chat with your documents using AI. Ask questions, get instant answers with citations. Supports PDFs, Word docs, Excel files. Free document analysis with GPT-4, Claude, and 19+ AI models.',
    start_url: '/',
    display: 'standalone',
    background_color: '#ffffff',
    theme_color: '#000000',
    orientation: 'portrait-primary',
    scope: '/',
    lang: 'en-US',
    dir: 'ltr',
    categories: ['productivity', 'business', 'education', 'utilities'],
    display_override: ['window-controls-overlay', 'standalone', 'fullscreen'],
    // No `screenshots` entry: it pointed at /screenshot-wide.png and
    // /screenshot-narrow.png, neither of which exists. A 404 here degrades the
    // install dialog, so the field stays out until real screenshots are added.
    icons: [
      {
        src: '/icon-72.png',
        sizes: '72x72',
        type: 'image/png',
        purpose: 'any'
      },
      {
        src: '/icon-96.png',
        sizes: '96x96',
        type: 'image/png',
        purpose: 'any'
      },
      {
        src: '/icon-128.png',
        sizes: '128x128',
        type: 'image/png',
        purpose: 'any'
      },
      {
        src: '/icon-144.png',
        sizes: '144x144',
        type: 'image/png',
        purpose: 'any'
      },
      {
        src: '/icon-152.png',
        sizes: '152x152',
        type: 'image/png',
        purpose: 'any'
      },
      {
        src: '/icon-192.png',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'any'
      },
      {
        src: '/icon-384.png',
        sizes: '384x384',
        type: 'image/png',
        purpose: 'any'
      },
      {
        src: '/icon-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any'
      },
      {
        src: '/icon-192-maskable.png',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'maskable'
      },
      {
        src: '/icon-512-maskable.png',
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
