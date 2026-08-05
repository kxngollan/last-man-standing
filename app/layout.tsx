import type { Metadata, Viewport } from 'next'
import { Plus_Jakarta_Sans, Space_Mono } from 'next/font/google'
import './globals.css'
import './ui.css'
import { GoogleAnalytics } from '@next/third-parties/google'
import CookieNotice from '@/components/CookieNotice'
import SessionWrapper from '@/components/SessionWrapper'
import { SITE_URL, SITE_NAME, SITE_TAGLINE, SITE_DESCRIPTION, SITE_KEYWORDS } from '@/lib/site'

const jakarta = Plus_Jakarta_Sans({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-jakarta'
})

const spaceMono = Space_Mono({
  subsets: ['latin'],
  weight: ['400', '700'],
  display: 'swap',
  variable: '--font-space-mono'
})

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: `${SITE_NAME} · ${SITE_TAGLINE}`,
    template: `%s · ${SITE_NAME}`
  },
  description: SITE_DESCRIPTION,
  applicationName: SITE_NAME,
  keywords: SITE_KEYWORDS,
  authors: [{ name: SITE_NAME }],
  creator: SITE_NAME,
  publisher: SITE_NAME,
  category: 'games',
  alternates: { canonical: '/' },
  openGraph: {
    type: 'website',
    siteName: SITE_NAME,
    title: `${SITE_NAME} · ${SITE_TAGLINE}`,
    description: SITE_DESCRIPTION,
    url: SITE_URL,
    locale: 'en_GB',
    images: [
      {
        url: '/images/og.png',
        width: 1200,
        height: 630,
        alt: `${SITE_NAME} · ${SITE_TAGLINE}`
      }
    ]
  },
  twitter: {
    card: 'summary_large_image',
    title: `${SITE_NAME} · ${SITE_TAGLINE}`,
    description: SITE_DESCRIPTION,
    images: ['/images/og.png']
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-image-preview': 'large',
      'max-snippet': -1,
      'max-video-preview': -1
    }
  },
  formatDetection: { telephone: false, address: false, email: false }
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#f7f3ea' },
    { media: '(prefers-color-scheme: dark)', color: '#211d16' }
  ]
}

// Runs before anything paints: apply the theme cookie (set by ThemeToggle) to
// <html data-theme="…">. No cookie → no attribute → tokens.css falls back to
// the device's prefers-color-scheme. Inline (not next/script) and first in
// <body> so a stored choice can never flash the wrong theme. Kept out of the
// server render on purpose — reading cookies() here would opt every static
// page into dynamic rendering.
const THEME_INIT = `try{var m=document.cookie.match(/(?:^|; )theme=(dark|light)/);if(m)document.documentElement.dataset.theme=m[1]}catch(e){}`

const gid = process.env.GOOGLEID ?? ''

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    // suppressHydrationWarning is attribute-level and <html>-only: the theme
    // script above sets data-theme before hydration, which React would
    // otherwise report as a server/client mismatch.
    <html lang='en-GB' className={`${jakarta.variable} ${spaceMono.variable}`} suppressHydrationWarning>
      <body className='min-h-full flex flex-col'>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT }} />
        <SessionWrapper>{children}</SessionWrapper>
        <CookieNotice />
      </body>
      <GoogleAnalytics gaId={gid} />
    </html>
  )
}
