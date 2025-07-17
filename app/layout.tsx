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

/**
 * Defines the root HTML layout for the application, setting the language to English and rendering the provided content within the body.
 *
 * @param children - The content to be rendered inside the body of the HTML document
 */
export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
