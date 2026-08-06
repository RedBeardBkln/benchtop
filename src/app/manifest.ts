import type { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'benchtop',
    short_name: 'benchtop',
    description: 'Food Formulation Platform',
    start_url: '/',
    display: 'standalone',
    background_color: '#0C2B24',
    theme_color: '#0C2B24',
    icons: [
      {
        src: '/apple-icon',
        sizes: '180x180',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/icon.svg',
        sizes: 'any',
        type: 'image/svg+xml',
        purpose: 'any',
      },
    ],
  }
}
