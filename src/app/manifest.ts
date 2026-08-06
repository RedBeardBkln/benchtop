import type { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'benchtop',
    short_name: 'benchtop',
    description: 'Food Formulation Platform',
    start_url: '/',
    display: 'standalone',
    background_color: '#17253A',
    theme_color: '#17253A',
    icons: [
      {
        src: '/icons/192',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/icons/512',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any',
      },
    ],
  }
}
