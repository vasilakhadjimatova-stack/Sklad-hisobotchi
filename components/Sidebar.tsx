'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LayoutDashboard, Package, Users, Settings, BarChart3, History, ClipboardCheck } from 'lucide-react'

export default function Sidebar() {
  const pathname = usePathname()

  const links = [
    { href: '/', label: 'Asosiy panel', icon: LayoutDashboard },
    { href: '/items', label: 'Mahsulotlar', icon: Package },
    { href: '/analytics', label: 'Hisobotlar', icon: BarChart3 },
    { href: '/inventarizatsiya', label: 'Inventarizatsiya', icon: ClipboardCheck },
    { href: '/history', label: 'Amallar Tarixi', icon: History },
    { href: '/users', label: 'Foydalanuvchilar', icon: Users },
  ]

  return (
    <aside className="w-64 glass border-r border-white/60 flex flex-col relative z-10 hidden md:flex">
      <div className="p-6 border-b border-white/60 flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-zinc-800 to-black flex items-center justify-center shadow-lg shadow-black/10">
          <Package size={20} className="text-white" />
        </div>
        <div>
          <h1 className="font-bold text-lg tracking-tight text-zinc-900">Impulse</h1>
          <p className="text-xs text-brand-600/80 font-medium tracking-wide">SKLAD SYSTEM</p>
        </div>
      </div>

      <nav className="flex-1 p-4 space-y-2">
        {links.map((link) => {
          const Icon = link.icon
          const isActive = pathname === link.href

          return (
            <Link 
              key={link.href} 
              href={link.href}
              className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${
                isActive 
                  ? 'bg-brand-50/80 text-brand-600 border border-brand-500/20 shadow-sm' 
                  : 'text-zinc-500 hover:text-zinc-900 hover:bg-white/40 border border-transparent'
              }`}
            >
              <Icon size={18} />
              <span className="font-medium text-sm">{link.label}</span>
            </Link>
          )
        })}
      </nav>

      <div className="p-4 mt-auto">
        <div className="glass-card p-4 rounded-xl flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-amber-200 to-amber-500 border border-white/60 flex items-center justify-center">
            <span className="text-xs font-bold text-white">A</span>
          </div>
          <div className="flex-1 overflow-hidden">
            <p className="text-sm font-medium truncate text-zinc-900">Admin Panel</p>
            <p className="text-xs text-zinc-500 truncate">admin@impulse.uz</p>
          </div>
          <Settings size={16} className="text-zinc-400 cursor-pointer hover:text-zinc-700 transition-colors" />
        </div>
      </div>
    </aside>
  )
}
