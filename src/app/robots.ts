import type { MetadataRoute } from 'next'
import { getAppOrigin } from '@/lib/app-url'

const ORIGIN = getAppOrigin('https://benchtop.solutions')

// Search engines may index the public site; the app itself sits behind sign-in anyway
export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: '*', allow: ['/', '/features', '/pricing', '/faq', '/trust', '/request-invite', '/legal/'], disallow: ['/api/', '/invite/'] },
    sitemap: `${ORIGIN}/sitemap.xml`,
  }
}
