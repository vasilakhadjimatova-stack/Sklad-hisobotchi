import type { Metadata } from 'next'
import Script from 'next/script'

export const metadata: Metadata = {
  title: 'Chiqim kiritish | Impulse Sklad',
}

export default function MiniAppLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="uz">
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1" />
        <Script src="https://telegram.org/js/telegram-web-app.js" strategy="beforeInteractive" />
      </head>
      <body style={{ margin: 0, padding: 0, background: '#0f0f13' }}>
        {children}
      </body>
    </html>
  )
}
