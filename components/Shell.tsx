'use client'

import { usePathname } from 'next/navigation'
import Sidebar from './Sidebar'

// /mini-app — mustaqil to'liq ekranli ilova (dashboard yon menyusisiz).
// Qolgan sahifalar — dashboard qobig'i (yon menyu + fon).
export default function Shell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() || ''

  if (pathname.startsWith('/mini-app')) {
    return <>{children}</>
  }

  return (
    <>
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden -z-10 pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-brand-500/30 blur-[120px] animate-blob"></div>
        <div className="absolute bottom-[-10%] right-[-5%] w-[35%] h-[35%] rounded-full bg-rose-500/30 blur-[120px] animate-blob" style={{ animationDelay: '2s' }}></div>
      </div>
      <div className="flex h-screen w-full">
        <Sidebar />
        <main className="flex-1 overflow-y-auto relative z-10">
          {children}
        </main>
      </div>
    </>
  )
}
