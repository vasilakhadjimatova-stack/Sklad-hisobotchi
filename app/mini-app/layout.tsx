import type { Metadata, Viewport } from 'next'
import Script from 'next/script'

export const metadata: Metadata = {
  title: 'Chiqim kiritish | Impulse Ombor',
  manifest: '/manifest.webmanifest',
  appleWebApp: { capable: true, statusBarStyle: 'default', title: 'Ombor' },
  icons: { icon: '/icon-192.png', apple: '/apple-touch-icon.png' },
}

export const viewport: Viewport = {
  themeColor: '#6366f1',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
}

// /mini-app uchun toza, to'liq ekranli qobiq (root layout Shell orqali
// yon menyuni bermaydi). Ichma-ich <html> YO'Q — bitta root body ishlatiladi.
export default function MiniAppLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      {children}
      <Script src="https://telegram.org/js/telegram-web-app.js" strategy="afterInteractive" />
      <Script id="sw-register" strategy="afterInteractive">
        {`if('serviceWorker' in navigator){window.addEventListener('load',function(){navigator.serviceWorker.register('/sw.js').catch(function(){})})}`}
      </Script>
    </>
  )
}
