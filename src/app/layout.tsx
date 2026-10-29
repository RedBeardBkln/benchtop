import type { Metadata, Viewport } from 'next'
import { Bricolage_Grotesque, DM_Mono } from 'next/font/google'
import { Toaster } from 'sonner'
import { Providers } from '@/lib/providers'
import { TooltipLayer } from '@/components/tooltip-layer'
import { THEME_INIT_SCRIPT } from '@/lib/theme'
import './globals.css'

const bricolage = Bricolage_Grotesque({
  variable: '--font-bricolage',
  subsets: ['latin'],
})

const dmMono = DM_Mono({
  variable: '--font-dm-mono',
  subsets: ['latin'],
  weight: ['300', '400', '500'],
})

export const metadata: Metadata = {
  title: 'Benchtop — Food formulation R&D',
  description: 'Formulation R&D workspace',
  appleWebApp: {
    capable: true,
    title: 'Benchtop',
    statusBarStyle: 'black-translucent',
  },
}

export const viewport: Viewport = {
  themeColor: '#16200E',
  viewportFit: 'cover',
}

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    // data-theme is set by the init script before React hydrates, so the server's markup won't match it
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body className={`${bricolage.variable} ${dmMono.variable} antialiased`}>
        <Providers>
          {children}
        </Providers>
        {/* Bottom center: top-right sat over the close (X) button of side panels. On phones, above the menu bar. */}
        <Toaster richColors position="bottom-center" mobileOffset={{ bottom: 'calc(4.5rem + env(safe-area-inset-bottom))' }} />
        <TooltipLayer />
      </body>
    </html>
  )
}
