import { MetadataRoute } from 'next'
 
export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = 'https://quantumpdf-chatapp.vercel.app'
  const currentDate = new Date().toISOString()
  
  // Only include routes that actually exist in the app
  return [
    {
      url: baseUrl,
      lastModified: currentDate,
      changeFrequency: 'weekly',
      priority: 1.0,
    },
  ]
}
