import { PrismaClient } from '@prisma/client'
import { History, User as UserIcon, Package, ArrowUpRight, ArrowDownLeft, Settings2 } from 'lucide-react'

const prisma = new PrismaClient()

export const revalidate = 0

export default async function HistoryPage() {
  const transactions = await prisma.transaction.findMany({
    include: {
      item: true,
      user: true
    },
    orderBy: {
      createdAt: 'desc'
    },
    take: 100 // Last 100 actions
  })

  return (
    <div className="p-8 max-w-[1600px] mx-auto min-h-full">
      <header className="mb-10">
        <h1 className="text-4xl font-bold tracking-tight mb-2 text-white flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-violet-500/20 flex items-center justify-center text-violet-400">
            <History size={24} />
          </div>
          Amallar Tarixi
        </h1>
        <p className="text-white/50 text-sm mt-2">Ombordagi barcha harakatlar (kirim, chiqim, tuzatish) loglari</p>
      </header>

      <div className="glass-card rounded-[2.5rem] overflow-hidden border border-white/5 shadow-2xl bg-white/[0.01]">
        <div className="p-8 border-b border-white/5 flex items-center justify-between bg-white/[0.02]">
          <div className="flex items-center gap-3">
            <Settings2 size={20} className="text-white/20" />
            <span className="font-black text-white/90 uppercase tracking-widest text-sm">Audit Log</span>
          </div>
          <span className="text-[10px] font-black text-white/20 uppercase tracking-[0.3em]">Barcha foydalanuvchilar harakati</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-white/[0.02]">
                <th className="p-6 text-[10px] font-black text-white/30 uppercase tracking-widest">Xodim</th>
                <th className="p-6 text-[10px] font-black text-white/30 uppercase tracking-widest">Amal turi</th>
                <th className="p-6 text-[10px] font-black text-white/30 uppercase tracking-widest">Mahsulot</th>
                <th className="p-6 text-[10px] font-black text-white/30 uppercase tracking-widest">Miqdor</th>
                <th className="p-6 text-[10px] font-black text-white/30 uppercase tracking-widest">Tadbir/Sabab</th>
                <th className="p-6 text-[10px] font-black text-white/30 uppercase tracking-widest text-right">Sana va Vaqt</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {transactions.map((t) => {
                const isAdd = t.type === 'ADD'
                const isTake = t.type === 'TAKE'
                const isAdjust = t.type === 'ADJUST'
                
                return (
                  <tr key={t.id} className="hover:bg-white/[0.03] transition-colors group">
                    <td className="p-6">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center text-white/40">
                          <UserIcon size={14} />
                        </div>
                        <span className="font-bold text-white/80 group-hover:text-white transition-colors">
                          {t.user.name}
                        </span>
                      </div>
                    </td>
                    <td className="p-6">
                      <span className={`px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest border ${
                        isAdd ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' :
                        isTake ? 'bg-rose-500/10 text-rose-400 border-rose-500/20' :
                        'bg-amber-500/10 text-amber-400 border-amber-500/20'
                      }`}>
                        {isAdd ? 'Kirim' : isTake ? 'Chiqim' : 'Tuzatish'}
                      </span>
                    </td>
                    <td className="p-6 font-bold text-white/60">
                      {t.item.name}
                    </td>
                    <td className="p-6">
                      <div className={`flex items-center gap-1 font-black ${isAdd ? 'text-emerald-400' : isTake ? 'text-rose-400' : 'text-amber-400'}`}>
                        {isAdd ? <ArrowDownLeft size={14} /> : isTake ? <ArrowUpRight size={14} /> : null}
                        {isAdd ? '+' : ''}{t.quantity} {t.item.unit.toLowerCase()}
                      </div>
                    </td>
                    <td className="p-6">
                       <span className="text-white/40 text-xs font-medium italic">
                         {t.eventName || '-'}
                       </span>
                    </td>
                    <td className="p-6 text-right">
                      <div className="text-white font-bold text-xs" suppressHydrationWarning>
                        {t.createdAt.toLocaleDateString('uz-UZ')}
                      </div>
                      <div className="text-white/20 text-[10px] mt-0.5 font-bold" suppressHydrationWarning>
                        {t.createdAt.toLocaleTimeString('uz-UZ', { hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
