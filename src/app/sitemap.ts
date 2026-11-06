import type { MetadataRoute } from 'next'
import { getAppOrigin } from '@/lib/app-url'

const ORIGIN = getAppOrigin('https://benchtop.solutions')

export default function sitemap(): MetadataRoute.Sitemap {
  return ['', '/features', '/pricing', '/faq', '/trust', '/request-invite', '/legal/privacy', '/legal/terms']
    .map(path => ({ url: `${ORIGIN}${path}` }))
}
