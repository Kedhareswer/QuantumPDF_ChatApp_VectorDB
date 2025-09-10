import Head from 'next/head'

interface SEOHeadProps {
  title?: string
  description?: string
  canonical?: string
  ogImage?: string
  ogType?: 'website' | 'article' | 'product'
  publishedTime?: string
  modifiedTime?: string
  author?: string
  tags?: string[]
  noIndex?: boolean
}

export function SEOHead({
  title,
  description,
  canonical,
  ogImage = '/og-image.png',
  ogType = 'website',
  publishedTime,
  modifiedTime,
  author,
  tags = [],
  noIndex = false
}: SEOHeadProps) {
  const siteUrl = 'https://quantumpdf-chatapp.vercel.app'
  const fullTitle = title ? `${title} | QuantumPDF ChatApp` : 'QuantumPDF ChatApp - AI-Powered PDF Analysis & Document Intelligence'
  const fullDescription = description || 'Transform your PDFs into intelligent, interactive knowledge bases with AI-powered conversations. Upload documents, extract insights, and chat with your files using cutting-edge language models.'
  const canonicalUrl = canonical ? `${siteUrl}${canonical}` : siteUrl
  const fullOgImage = ogImage.startsWith('http') ? ogImage : `${siteUrl}${ogImage}`

  return (
    <Head>
      {/* Basic Meta Tags */}
      <title>{fullTitle}</title>
      <meta name="description" content={fullDescription} />
      <meta name="keywords" content={[
        'PDF AI chat', 'document analysis', 'AI PDF reader', 'intelligent document processing',
        'RAG chatbot', 'PDF conversation', 'document intelligence', 'AI document assistant',
        ...tags
      ].join(', ')} />
      
      {/* Canonical URL */}
      <link rel="canonical" href={canonicalUrl} />
      
      {/* Robots */}
      {noIndex && <meta name="robots" content="noindex,nofollow" />}
      
      {/* Open Graph */}
      <meta property="og:type" content={ogType} />
      <meta property="og:title" content={fullTitle} />
      <meta property="og:description" content={fullDescription} />
      <meta property="og:image" content={fullOgImage} />
      <meta property="og:image:width" content="1200" />
      <meta property="og:image:height" content="630" />
      <meta property="og:image:alt" content={fullTitle} />
      <meta property="og:url" content={canonicalUrl} />
      <meta property="og:site_name" content="QuantumPDF ChatApp" />
      <meta property="og:locale" content="en_US" />
      
      {/* Article specific OG tags */}
      {ogType === 'article' && publishedTime && (
        <meta property="article:published_time" content={publishedTime} />
      )}
      {ogType === 'article' && modifiedTime && (
        <meta property="article:modified_time" content={modifiedTime} />
      )}
      {ogType === 'article' && author && (
        <meta property="article:author" content={author} />
      )}
      {ogType === 'article' && tags.map(tag => (
        <meta key={tag} property="article:tag" content={tag} />
      ))}
      
      {/* Twitter Card */}
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:site" content="@quantumpdf" />
      <meta name="twitter:creator" content="@kedhareswer" />
      <meta name="twitter:title" content={fullTitle} />
      <meta name="twitter:description" content={fullDescription} />
      <meta name="twitter:image" content={fullOgImage} />
      
      {/* Additional Meta Tags */}
      <meta name="author" content={author || 'Kedhareswer'} />
      <meta name="publisher" content="QuantumPDF" />
      <meta name="application-name" content="QuantumPDF ChatApp" />
      <meta name="apple-mobile-web-app-title" content="QuantumPDF" />
      <meta name="apple-mobile-web-app-capable" content="yes" />
      <meta name="apple-mobile-web-app-status-bar-style" content="default" />
      <meta name="mobile-web-app-capable" content="yes" />
      <meta name="theme-color" content="#000000" />
      <meta name="msapplication-TileColor" content="#000000" />
      <meta name="msapplication-config" content="/browserconfig.xml" />
      
      {/* Preload critical resources */}
      <link rel="preload" href="/fonts/inter.woff2" as="font" type="font/woff2" crossOrigin="anonymous" />
      
      {/* Favicon */}
      <link rel="icon" type="image/png" sizes="32x32" href="/favicon-32x32.png" />
      <link rel="icon" type="image/png" sizes="16x16" href="/favicon-16x16.png" />
      <link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png" />
      <link rel="mask-icon" href="/safari-pinned-tab.svg" color="#000000" />
      
      {/* Performance and Security */}
      <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
      <meta name="format-detection" content="telephone=no" />
      <meta name="format-detection" content="date=no" />
      <meta name="format-detection" content="address=no" />
      <meta name="format-detection" content="email=no" />
      
      {/* DNS Prefetch */}
      <link rel="dns-prefetch" href="//fonts.googleapis.com" />
      <link rel="dns-prefetch" href="//fonts.gstatic.com" />
      <link rel="dns-prefetch" href="//api.openai.com" />
      <link rel="dns-prefetch" href="//api.anthropic.com" />
      <link rel="dns-prefetch" href="//api.mistral.ai" />
      
      {/* Structured Data for specific pages */}
      {ogType === 'article' && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              '@context': 'https://schema.org',
              '@type': 'Article',
              headline: fullTitle,
              description: fullDescription,
              image: fullOgImage,
              author: {
                '@type': 'Person',
                name: author || 'Kedhareswer'
              },
              publisher: {
                '@type': 'Organization',
                name: 'QuantumPDF',
                logo: {
                  '@type': 'ImageObject',
                  url: `${siteUrl}/logo.png`
                }
              },
              datePublished: publishedTime,
              dateModified: modifiedTime,
              mainEntityOfPage: {
                '@type': 'WebPage',
                '@id': canonicalUrl
              }
            })
          }}
        />
      )}
    </Head>
  )
}
