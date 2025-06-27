import type { Metadata, Viewport } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'QuantumPDF ChatApp - AI-Powered PDF Analysis',
  description: 'Transform your PDFs into interactive knowledge bases with AI-powered conversations. Upload documents and chat with them using advanced language models.',
  generator: 'Next.js',
  keywords: ['PDF', 'AI', 'Chat', 'RAG', 'Document Analysis', 'Machine Learning'],
  authors: [{ name: 'Kedhareswer' }],
  openGraph: {
    title: 'QuantumPDF ChatApp',
    description: 'AI-powered PDF document analysis and chat application',
    type: 'website',
  },
  manifest: '/manifest.json'
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  userScalable: true,
  viewportFit: 'cover',
  themeColor: '#000000',
  colorScheme: 'light'
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en">
      <head>
        {/* Enhanced mobile compatibility */}
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="QuantumPDF" />
        <meta name="format-detection" content="telephone=no" />
        <meta name="msapplication-config" content="/browserconfig.xml" />
        <meta name="msapplication-TileColor" content="#000000" />
      </head>
      <body className="antialiased">{children}</body>
    </html>
  )
}
