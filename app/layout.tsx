import { ClientLayout } from "@/components/client-layout"
import { FAQSchema, OrganizationSchema, StructuredData } from "@/components/seo/structured-data"
import { Analytics } from '@vercel/analytics/next'
import 'katex/dist/katex.min.css'
import type { Metadata, Viewport } from 'next'
import { Inter } from "next/font/google"
import "./globals.css"

const inter = Inter({ subsets: ["latin"] })

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  colorScheme: 'light',
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#ffffff' },
    { media: '(prefers-color-scheme: dark)', color: '#000000' }
  ],
}

export const metadata: Metadata = {
  metadataBase: new URL('https://quantumpdf-chatapp.vercel.app'),
  title: {
    default: 'QuantumPDF ChatApp - AI-Powered PDF Analysis & Document Intelligence',
    template: '%s | QuantumPDF ChatApp'
  },
  description: 'Chat with your documents using AI. Ask questions, get instant answers with citations. Supports PDFs, Word docs, Excel files. Free document analysis tool with GPT-4, Claude, and 19+ AI models.',
  keywords: [
    'chat with PDF', 'PDF chatbot', 'AI document analysis', 'document Q&A', 'PDF to text AI',
    'analyze PDF with AI', 'document intelligence', 'AI document assistant', 'PDF summarizer',
    'document conversation', 'chat with documents', 'PDF question answer', 'AI PDF reader',
    'document analysis tool', 'PDF AI chat', 'intelligent document processing', 'document insights',
    'conversational AI documents', 'RAG document analysis', 'AI-powered PDF', 'document search AI'
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
    description: 'Chat with your documents using AI. Ask questions and get instant answers with citations. Free tool supporting PDFs, Word docs, Excel files with GPT-4, Claude, and 19+ AI models.',
    url: 'https://quantumpdf-chatapp.vercel.app',
    images: [],
    locale: 'en_US',
    countryName: 'United States',
  },
  twitter: {
    card: 'summary',
    title: 'QuantumPDF ChatApp - AI-Powered PDF Analysis',
    description: 'Chat with your documents using AI. Ask questions, get answers with citations. Free document analysis with GPT-4, Claude, and 19+ AI models.',
    site: '@quantumpdf',
    creator: '@kedhareswer',
  },
  alternates: {
    canonical: 'https://quantumpdf-chatapp.vercel.app',
  },
  category: 'technology',
  classification: 'AI Document Processing Tools',
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
        {/* PWA Meta Tags */}
        <link rel="manifest" href="/manifest.json" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="QuantumPDF" />
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
        <link rel="icon" type="image/png" sizes="32x32" href="/favicon-32x32.png" />
        <link rel="icon" type="image/png" sizes="16x16" href="/favicon-16x16.png" />
        <link rel="shortcut icon" href="/favicon.ico" />

        {/* PWA Splash Screens for iOS */}
        <link rel="apple-touch-startup-image" href="/icon-512.png" />

        {/* Microsoft Tiles */}
        <meta name="msapplication-TileColor" content="#000000" />
        <meta name="msapplication-TileImage" content="/icon-144.png" />
        <meta name="msapplication-config" content="/browserconfig.xml" />
      </head>
      <body className={inter.className} suppressHydrationWarning>
        <ClientLayout>
          {children}
        </ClientLayout>
        <Analytics />
      </body>
    </html>
  )
}
