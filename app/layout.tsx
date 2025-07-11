import type { Metadata } from 'next'
import './globals.css'
import 'katex/dist/katex.min.css'

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
  }
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en">
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
      </head>
      <body>{children}</body>
    </html>
  )
}
