import { PrismaClient } from '@prisma/client'
import { Shield, ShieldAlert, User as UserIcon, Activity, Clock, MoreVertical, Search, Package, Users } from 'lucide-react'

const prisma = new PrismaClient()

export const revalidate = 0

export default async function UsersPage() {
  const users = await prisma.user.findMany({
    orderBy: { createdAt: 'desc' },
    include: {
      _count: {
        select: { transactions: true }
      }
    }
  })

  return (
    <div className="p-8 max-w-[1600px] mx-auto min-h-full">
      <header className="mb-10">
        <h1 className="text-4xl font-bold tracking-tight mb-2 text-white flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-violet-500/20 flex items-center justify-center text-violet-400">
            <Users size={24} />
          </div>
          Foydalanuvchilar
        </h1>
        <p className="text-white/50 text-sm mt-2">Telegram botdan foydalanadigan xodimlar ro'yxati</p>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {users.length === 0 ? (
          <div className="col-span-full glass-card p-12 rounded-2xl flex flex-col items-center justify-center text-white/30 text-center border border-white/5">
            <Users size={48} className="mb-4 opacity-20" />
            <p className="text-lg font-medium">Hali foydalanuvchilar yo'q</p>
            <p className="text-sm mt-2">Bot orqali /start bosgan foydalanuvchilar shu yerda paydo bo'ladi</p>
          </div>
        ) : (
          users.map((user) => (
            <div key={user.id} className="glass-card p-6 rounded-2xl relative overflow-hidden group border border-white/5 hover:border-violet-500/30 transition-all hover:-translate-y-1 shadow-lg">
              <div className="absolute top-0 right-0 w-32 h-32 bg-violet-500/10 rounded-full blur-3xl group-hover:bg-violet-500/20 transition-all pointer-events-none"></div>
              
              <div className="flex items-start justify-between relative z-10 mb-4">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-full bg-gradient-to-br from-violet-500 to-fuchsia-600 flex items-center justify-center shadow-inner border border-white/10 text-white font-bold text-xl">
                    {user.name.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-white group-hover:text-violet-400 transition-colors">{user.name}</h3>
                    <p className="text-xs text-white/40 flex items-center gap-1 mt-0.5">
                      ID: {user.telegramId || 'Kiritilmagan'}
                    </p>
                  </div>
                </div>
              </div>

              <div className="space-y-3 relative z-10">
                <div className="flex justify-between items-center p-3 rounded-xl bg-dark-900/50 border border-white/5">
                  <div className="flex items-center gap-2 text-white/60 text-sm">
                    <Shield size={16} className="text-emerald-400" />
                    <span>Huquqi</span>
                  </div>
                  <span className={`text-xs font-bold px-2 py-1 rounded-md ${
                    user.role === 'ADMIN' ? 'bg-rose-500/20 text-rose-400' : 'bg-emerald-500/20 text-emerald-400'
                  }`}>
                    {user.role}
                  </span>
                </div>

                <div className="flex justify-between items-center p-3 rounded-xl bg-dark-900/50 border border-white/5">
                  <div className="flex items-center gap-2 text-white/60 text-sm">
                    <Package size={16} className="text-brand-400" />
                    <span>Qilgan amallari</span>
                  </div>
                  <span className="text-sm font-bold text-white">
                    {user._count.transactions} ta
                  </span>
                </div>
              </div>

              <div className="mt-4 pt-4 border-t border-white/5 flex justify-between items-center relative z-10">
                <span className="text-xs text-white/30">
                  Qo'shildi: {user.createdAt.toLocaleDateString('uz-UZ')}
                </span>
                <button className="text-xs font-medium text-violet-400 hover:text-violet-300 transition-colors px-3 py-1.5 rounded-lg bg-violet-500/10 hover:bg-violet-500/20">
                  Tahrirlash
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
