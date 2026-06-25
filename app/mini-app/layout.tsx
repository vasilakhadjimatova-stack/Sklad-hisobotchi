import type { Metadata } from 'next'
import Script from 'next/script'

export const metadata: Metadata = {
  title: 'Chiqim kiritish | Impulse Sklad',
}

export default function MiniAppLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="uz">
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, viewport-fit=cover" />
        <link rel="manifest" href="/manifest.webmanifest" />
        <meta name="theme-color" content="#6366f1" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="Ombor" />
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
        <link rel="icon" href="/icon-192.png" />
        <Script src="https://telegram.org/js/telegram-web-app.js" strategy="beforeInteractive" />
        <Script id="sw-register" strategy="afterInteractive">
          {`if('serviceWorker' in navigator){window.addEventListener('load',function(){navigator.serviceWorker.register('/sw.js').catch(function(){})})}`}
        </Script>
      </head>
      <body style={{ margin: 0, padding: 0, background: '#f4f4f5' }}>
        {children}
      </body>
    </html>
  )
}
