import type { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'benchtop',
    short_name: 'benchtop',
    description: 'Food formulation R&D',
    start_url: '/',
    display: 'standalone',
    background_color: '#D6F55A',
    theme_color: '#16200E',
    icons: [
      {
        src: '/icons/192?v=3',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/icons/512?v=3',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any',
      },
    ],
  }
}
