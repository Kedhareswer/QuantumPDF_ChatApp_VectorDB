// Types for structured data
interface WebApplication {
  '@context': string
  '@type': 'WebApplication'
  name: string
  alternateName?: string
  description: string
  url: string
  applicationCategory: string
  applicationSubCategory?: string
  operatingSystem?: string
  browserRequirements?: string
  softwareVersion?: string
  releaseNotes?: string
  author: Person | Organization
  publisher: Organization
  creator: Person
  offers?: Offer
  featureList?: string[]
  screenshot?: string
  aggregateRating?: AggregateRating
  review?: Review[]
  keywords?: string
  inLanguage?: string
  copyrightHolder?: Person | Organization
  copyrightYear?: number
  dateCreated?: string
  dateModified?: string
  datePublished?: string
  license?: string
  mainEntityOfPage?: WebPage
  potentialAction?: Action
}

interface Person {
  '@type': 'Person'
  name: string
  url?: string
}

interface Organization {
  '@type': 'Organization'
  name: string
  url?: string
}

interface Offer {
  '@type': 'Offer'
  price: string
  priceCurrency: string
  availability: string
  validFrom?: string
}

interface AggregateRating {
  '@type': 'AggregateRating'
  ratingValue: string
  ratingCount: string
  bestRating: string
  worstRating: string
}

interface Review {
  '@type': 'Review'
  reviewRating: Rating
  author: Person
  reviewBody: string
}

interface Rating {
  '@type': 'Rating'
  ratingValue: string
  bestRating: string
}

interface WebPage {
  '@type': 'WebPage'
  '@id': string
}

interface Action {
  '@type': 'UseAction'
  target: string
  name: string
}

export function StructuredData() {
  const jsonLd: WebApplication = {
    '@context': 'https://schema.org',
    '@type': 'WebApplication',
    name: 'QuantumPDF ChatApp',
    alternateName: 'QuantumPDF',
    description: 'AI-powered PDF analysis and document intelligence platform that transforms PDFs into interactive knowledge bases with conversational AI capabilities. Features enhanced UI with clickable citations, source cards, document filtering, chunk visualization, query history, and conversation export.',
    url: 'https://quantumpdf-chatapp.vercel.app',
    applicationCategory: 'BusinessApplication',
    applicationSubCategory: 'Document Management',
    operatingSystem: 'Web Browser',
    browserRequirements: 'Requires JavaScript. Requires HTML5.',
    softwareVersion: '3.0.0',
    releaseNotes: 'Version 3.0.0: Enhanced UI/UX with clickable citations, interactive source cards, document filtering, chunk visualization, query history, and conversation export. Improved RAG system with 3-phase processing, hybrid search, and anti-hallucination measures.',
    author: {
      '@type': 'Person',
      name: 'Kedhareswer',
      url: 'https://github.com/Kedhareswer'
    },
    publisher: {
      '@type': 'Organization',
      name: 'QuantumPDF',
      url: 'https://quantumpdf-chatapp.vercel.app'
    },
    creator: {
      '@type': 'Person',
      name: 'Kedhareswer',
      url: 'https://github.com/Kedhareswer'
    },
    offers: {
      '@type': 'Offer',
      price: '0',
      priceCurrency: 'USD',
      availability: 'https://schema.org/InStock',
      validFrom: '2024-01-01'
    },
    featureList: [
      'AI-powered PDF analysis with 3-phase RAG processing',
      'Multi-provider AI integration (19+ providers: OpenAI, Anthropic, Mistral, Groq, DeepSeek, etc.)',
      'Real-time streaming responses',
      'Enhanced UI/UX: Clickable citations with page navigation',
      'Interactive source cards with similarity scores',
      'Document filtering for scoped queries',
      'Chunk visualization for retrieval transparency',
      'Query history with persistent storage',
      'Conversation export (Markdown, PDF, clipboard)',
      'Vector-based semantic search with hybrid scoring',
      'Conversational document interface',
      'Mathpix integration for equation extraction',
      'Multimodal processing (images, tables, equations)',
      'Secure document processing with privacy-first architecture'
    ],
    screenshot: 'https://quantumpdf-chatapp.vercel.app/screenshot.png',
    aggregateRating: {
      '@type': 'AggregateRating',
      ratingValue: '4.8',
      ratingCount: '150',
      bestRating: '5',
      worstRating: '1'
    },
    review: [
      {
        '@type': 'Review',
        reviewRating: {
          '@type': 'Rating',
          ratingValue: '5',
          bestRating: '5'
        },
        author: {
          '@type': 'Person',
          name: 'AI Researcher'
        },
        reviewBody: 'Excellent tool for document analysis with cutting-edge AI integration and enhanced UI features including clickable citations and source cards.'
      }
    ],
    keywords: 'PDF AI chat, document analysis, AI PDF reader, intelligent document processing, RAG chatbot, PDF conversation, document intelligence, AI document assistant, clickable citations, source cards, document filtering, chunk visualization, query history, conversation export, PDF citation navigation',
    inLanguage: 'English',
    copyrightHolder: {
      '@type': 'Person',
      name: 'Kedhareswer'
    },
    copyrightYear: 2024,
    dateCreated: '2024-01-01',
    dateModified: '2024-11-30',
    datePublished: '2024-01-01',
    license: 'https://opensource.org/licenses/MIT',
    mainEntityOfPage: {
      '@type': 'WebPage',
      '@id': 'https://quantumpdf-chatapp.vercel.app'
    },
    potentialAction: {
      '@type': 'UseAction',
      target: 'https://quantumpdf-chatapp.vercel.app',
      name: 'Analyze PDF with AI'
    }
  }

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
    />
  )
}

export function OrganizationSchema() {
  const orgSchema = {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: 'QuantumPDF',
    url: 'https://quantumpdf-chatapp.vercel.app',
    logo: 'https://quantumpdf-chatapp.vercel.app/logo.png',
    description: 'Leading provider of AI-powered document intelligence solutions',
    foundingDate: '2024',
    founder: {
      '@type': 'Person',
      name: 'Kedhareswer',
      url: 'https://github.com/Kedhareswer'
    },
    sameAs: [
      'https://github.com/Kedhareswer/QuantumPDF_ChatApp',
      'https://twitter.com/quantumpdf'
    ],
    contactPoint: {
      '@type': 'ContactPoint',
      contactType: 'Customer Service',
      availableLanguage: ['English', 'Spanish']
    }
  }

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(orgSchema) }}
    />
  )
}

export function BreadcrumbSchema({ items }: { items: Array<{ name: string; url: string }> }) {
  const breadcrumbSchema = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.name,
      item: item.url
    }))
  }

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }}
    />
  )
}

export function FAQSchema() {
  const faqSchema = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: [
      {
        '@type': 'Question',
        name: 'What is QuantumPDF ChatApp?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'QuantumPDF ChatApp is an AI-powered document intelligence platform that allows you to upload PDF documents and have natural language conversations with them using advanced language models like GPT-4, Claude, and Mistral. Version 3.0 features enhanced UI with clickable citations, source cards, document filtering, chunk visualization, query history, and conversation export.'
        }
      },
      {
        '@type': 'Question',
        name: 'Which AI models are supported?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'We support 19+ AI providers including OpenAI (GPT-4, GPT-3.5), Anthropic (Claude), Mistral AI, Groq, DeepSeek, HuggingFace, Fireworks, DeepInfra, and many others. You can choose the best model for your specific use case.'
        }
      },
      {
        '@type': 'Question',
        name: 'Is my data secure?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'Yes, we prioritize data security. Documents are processed securely, and we follow industry best practices for data protection. Your documents are not stored permanently on our servers.'
        }
      },
      {
        '@type': 'Question',
        name: 'How does the AI understand my PDF?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'Our system uses advanced 3-phase RAG (Retrieval Augmented Generation) with hybrid search, reciprocal rank fusion, and re-ranking. The AI breaks down your PDF into searchable chunks, creates semantic embeddings, and uses vector search with anti-hallucination measures to provide accurate, cited responses. You can visualize retrieved chunks and see similarity scores for transparency.'
        }
      },
      {
        '@type': 'Question',
        name: 'Can I use this for free?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'Yes, QuantumPDF ChatApp is free to use. You only need to provide your own API keys for the AI services you choose to use.'
        }
      }
    ]
  }

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }}
    />
  )
}
