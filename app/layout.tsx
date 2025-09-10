import type { Metadata } from 'next'
import { Inter } from "next/font/google"
import "./globals.css"
import 'katex/dist/katex.min.css'
import { Analytics } from '@vercel/analytics/next'
import { ClientLayout } from "@/components/client-layout"
import { StructuredData, OrganizationSchema, FAQSchema } from "@/components/seo/structured-data"

const inter = Inter({ subsets: ["latin"] })

export const metadata: Metadata = {
  metadataBase: new URL('https://quantumpdf-chatapp.vercel.app'),
  title: {
    default: 'QuantumPDF ChatApp - AI-Powered PDF Analysis & Document Intelligence',
    template: '%s | QuantumPDF ChatApp'
  },
  description: 'Transform your PDFs into intelligent, interactive knowledge bases with AI-powered conversations. Upload documents, extract insights, and chat with your files using cutting-edge language models like GPT-4, Claude, Mistral, and more.',
  keywords: [
    'PDF AI chat', 'document analysis', 'AI PDF reader', 'intelligent document processing',
    'RAG chatbot', 'PDF conversation', 'document intelligence', 'AI document assistant',
    'PDF to text', 'document Q&A', 'smart PDF viewer', 'AI-powered research',
    'document summarization', 'PDF knowledge base', 'conversational AI',
    'machine learning documents', 'natural language processing', 'document understanding',
    'AI file analysis', 'PDF automation', 'document insights', 'intelligent search',
    'GPT PDF', 'Claude PDF', 'Mistral AI', 'OpenAI documents', 'vector search',
    'semantic search', 'document embeddings', 'AI research assistant'
  ],
  authors: [{ name: 'Kedhareswer', url: 'https://github.com/Kedhareswer' }],
  creator: 'Kedhareswer',
  publisher: 'QuantumPDF',
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
  generator: 'Next.js',
  applicationName: 'QuantumPDF ChatApp',
  referrer: 'origin-when-cross-origin',
  colorScheme: 'light',
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#ffffff' },
    { media: '(prefers-color-scheme: dark)', color: '#000000' }
  ],
  viewport: {
    width: 'device-width',
    initialScale: 1,
    maximumScale: 1,
  },
  robots: {
    index: true,
    follow: true,
    nocache: false,
    googleBot: {
      index: true,
      follow: true,
      noimageindex: false,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
  openGraph: {
    type: 'website',
    siteName: 'QuantumPDF ChatApp',
    title: 'QuantumPDF ChatApp - AI-Powered PDF Analysis & Document Intelligence',
    description: 'Transform your PDFs into intelligent, interactive knowledge bases with AI-powered conversations. Upload documents, extract insights, and chat with your files using cutting-edge language models.',
    url: 'https://quantumpdf-chatapp.vercel.app',
    images: [
      {
        url: '/og-image.png',
        width: 1200,
        height: 630,
        alt: 'QuantumPDF ChatApp - AI-Powered PDF Analysis',
        type: 'image/png',
      },
      {
        url: '/og-image-square.png',
        width: 1200,
        height: 1200,
        alt: 'QuantumPDF ChatApp Logo',
        type: 'image/png',
      }
    ],
    locale: 'en_US',
    countryName: 'United States',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'QuantumPDF ChatApp - AI-Powered PDF Analysis',
    description: 'Transform your PDFs into intelligent conversations with AI. Upload, analyze, and chat with documents using advanced language models.',
    site: '@quantumpdf',
    creator: '@kedhareswer',
    images: ['/twitter-image.png'],
  },
  alternates: {
    canonical: 'https://quantumpdf-chatapp.vercel.app',
    languages: {
      'en-US': 'https://quantumpdf-chatapp.vercel.app/en-US',
      'es-ES': 'https://quantumpdf-chatapp.vercel.app/es-ES',
    },
  },
  category: 'technology',
  classification: 'AI Document Processing Tools',
  other: {
    'google-site-verification': 'your-google-verification-code-here',
    'msvalidate.01': 'your-bing-verification-code-here',
  }
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <head>
        <StructuredData />
        <OrganizationSchema />
        <FAQSchema />
        <link rel="canonical" href="https://quantumpdf-chatapp.vercel.app" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <meta name="google-site-verification" content="your-google-verification-code-here" />
        <meta name="msvalidate.01" content="your-bing-verification-code-here" />
      </head>
      <body className={inter.className}>
        <ClientLayout>
          {children}
        </ClientLayout>
        <Analytics />
      </body>
    </html>
  )
}
