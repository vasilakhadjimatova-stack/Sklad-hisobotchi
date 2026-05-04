'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LayoutDashboard, Package, Users, Settings, BarChart3, History } from 'lucide-react'

export default function Sidebar() {
  const pathname = usePathname()

  const links = [
    { href: '/', label: 'Asosiy panel', icon: LayoutDashboard },
    { href: '/items', label: 'Mahsulotlar', icon: Package },
    { href: '/analytics', label: 'Hisobotlar', icon: BarChart3 },
    { href: '/history', label: 'Amallar Tarixi', icon: History },
    { href: '/users', label: 'Foydalanuvchilar', icon: Users },
  ]

  return (
    <aside className="w-64 glass border-r border-white/5 flex flex-col relative z-10 hidden md:flex">
      <div className="p-6 border-b border-white/5 flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-brand-500 to-violet-600 flex items-center justify-center shadow-lg shadow-brand-500/20">
          <Package size={20} className="text-white" />
        </div>
        <div>
          <h1 className="font-bold text-lg tracking-tight text-white">Impulse</h1>
          <p className="text-xs text-brand-100/60 font-medium tracking-wide">SKLAD SYSTEM</p>
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
                  ? 'bg-brand-500/10 text-brand-400 border border-brand-500/20 shadow-[0_0_15px_rgba(99,102,241,0.1)]' 
                  : 'text-white/50 hover:text-white hover:bg-white/5 border border-transparent'
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
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-green-400 to-emerald-600 border border-white/10 flex items-center justify-center">
            <span className="text-xs font-bold text-white">A</span>
          </div>
          <div className="flex-1 overflow-hidden">
            <p className="text-sm font-medium truncate text-white">Admin Panel</p>
            <p className="text-xs text-white/40 truncate">admin@impulse.uz</p>
          </div>
          <Settings size={16} className="text-white/40 cursor-pointer hover:text-white transition-colors" />
        </div>
      </div>
    </aside>
  )
}
