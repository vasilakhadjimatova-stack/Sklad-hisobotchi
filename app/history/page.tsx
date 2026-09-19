import prisma from '@/lib/prisma';
import Link from 'next/link'
import { History, User as UserIcon, Package, ArrowUpRight, ArrowDownLeft, Settings2, Calendar } from 'lucide-react'
import { formatQty } from '@/lib/units'

export const revalidate = 0

// Juda katta sahifa yasab qo'ymaslik uchun yuqori chegara. Yetib borilsa,
// foydalanuvchiga aytiladi — jimgina kesib tashlanmaydi.
const MAX_ROWS = 5000

// YYYY-MM-DD (Toshkent kuni) -> o'sha kunning boshlanish UTC instanti
function dayStartUtc(ymd: string) {
  const [y, m, d] = ymd.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d, -5, 0, 0))
}

const ymd = (d: Date) => d.toISOString().slice(0, 10)

export default async function HistoryPage({
  searchParams,
}: {
  searchParams: { from?: string }
}) {
  // Toshkent bugungi kuni (UTC+5)
  const nowTashkent = new Date(Date.now() + 5 * 60 * 60 * 1000)
  const ty = nowTashkent.getUTCFullYear()
  const tm = nowTashkent.getUTCMonth()

  const thisMonthFrom = ymd(new Date(Date.UTC(ty, tm, 1)))
  const prevMonthFrom = ymd(new Date(Date.UTC(ty, tm - 1, 1)))   // standart: o'tgan oy boshidan
  const days90From = ymd(new Date(nowTashkent.getTime() - 90 * 24 * 60 * 60 * 1000))

  const raw = searchParams.from
  const showAll = raw === 'all'
  const from = /^\d{4}-\d{2}-\d{2}$/.test(raw || '') ? (raw as string) : prevMonthFrom

  const transactions = await prisma.transaction.findMany({
    where: showAll ? {} : { createdAt: { gte: dayStartUtc(from) } },
    include: {
      item: true,
      user: true
    },
    orderBy: {
      createdAt: 'desc'
    },
    take: MAX_ROWS,
  })

  const truncated = transactions.length === MAX_ROWS

  const quick = [
    { label: 'Bu oy', href: `/history?from=${thisMonthFrom}`, active: !showAll && from === thisMonthFrom },
    { label: "O'tgan oydan", href: `/history?from=${prevMonthFrom}`, active: !showAll && from === prevMonthFrom },
    { label: '90 kun', href: `/history?from=${days90From}`, active: !showAll && from === days90From },
    { label: 'Hammasi', href: '/history?from=all', active: showAll },
  ]

  return (
    <div className="p-8 max-w-[1600px] mx-auto min-h-full">
      <header className="mb-10">
        <h1 className="text-4xl font-bold tracking-tight mb-2 text-zinc-900 flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-violet-500/20 flex items-center justify-center text-violet-400">
            <History size={24} />
          </div>
          Amallar Tarixi
        </h1>
        <p className="text-zinc-900/50 text-sm mt-2">Ombordagi barcha harakatlar (kirim, chiqim, tuzatish) loglari</p>
      </header>

      {/* Davr tanlash — tarix bazada to'liq saqlanadi, bu faqat ko'rsatish oralig'i */}
      <div className="glass-card rounded-3xl border border-white/60 shadow-xl p-5 mb-6 flex flex-col lg:flex-row lg:items-end gap-5">
        <form method="get" className="flex flex-wrap items-end gap-3">
          <div>
            <label className="flex items-center gap-1.5 text-[10px] font-black text-zinc-900/40 uppercase tracking-widest mb-2">
              <Calendar size={12} /> Shu sanadan boshlab
            </label>
            <input
              type="date"
              name="from"
              defaultValue={showAll ? '' : from}
              max={ymd(nowTashkent)}
              className="px-4 py-2.5 rounded-xl bg-white/60 border border-white/70 text-zinc-900 font-bold text-sm focus:border-violet-500/50 focus:ring-2 focus:ring-violet-500/20 outline-none shadow-inner"
            />
          </div>
          <button
            type="submit"
            className="px-5 py-2.5 rounded-xl bg-violet-500 text-white font-black text-xs uppercase tracking-widest hover:bg-violet-600 transition-colors shadow-lg shadow-violet-500/20"
          >
            Ko'rsatish
          </button>
        </form>

        <div className="flex flex-wrap items-center gap-2 lg:ml-auto">
          {quick.map((q) => (
            <Link
              key={q.href}
              href={q.href}
              className={`px-4 py-2 rounded-xl text-xs font-bold border transition-colors ${
                q.active
                  ? 'bg-violet-500 text-white border-violet-500'
                  : 'bg-white/50 text-zinc-900/60 border-white/70 hover:bg-white/80'
              }`}
            >
              {q.label}
            </Link>
          ))}
        </div>
      </div>

      {truncated && (
        <div className="mb-6 px-5 py-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-sm font-medium text-amber-700">
          Juda ko'p yozuv — faqat oxirgi {MAX_ROWS} tasi ko'rsatildi. Qolganini ko'rish uchun boshlanish sanasini keyinroq qilib qo'ying.
        </div>
      )}

      <div className="glass-card rounded-[2.5rem] overflow-hidden border border-white/60 shadow-2xl bg-white/[0.01]">
        <div className="p-8 border-b border-white/60 flex items-center justify-between bg-white/40">
          <div className="flex items-center gap-3">
            <Settings2 size={20} className="text-zinc-900/20" />
            <span className="font-black text-zinc-900/90 uppercase tracking-widest text-sm">Audit Log</span>
          </div>
          <span className="text-[10px] font-black text-zinc-900/30 uppercase tracking-[0.2em]">
            {showAll ? 'Butun tarix' : `${from} dan buyon`} · {transactions.length} ta yozuv
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-white/40">
                <th className="p-6 text-[10px] font-black text-zinc-900/30 uppercase tracking-widest">Xodim</th>
                <th className="p-6 text-[10px] font-black text-zinc-900/30 uppercase tracking-widest">Amal turi</th>
                <th className="p-6 text-[10px] font-black text-zinc-900/30 uppercase tracking-widest">Mahsulot</th>
                <th className="p-6 text-[10px] font-black text-zinc-900/30 uppercase tracking-widest">Miqdor</th>
                <th className="p-6 text-[10px] font-black text-zinc-900/30 uppercase tracking-widest">Tadbir/Sabab</th>
                <th className="p-6 text-[10px] font-black text-zinc-900/30 uppercase tracking-widest text-right">Sana va Vaqt</th>
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
                        <div className="w-8 h-8 rounded-full bg-white/40 flex items-center justify-center text-zinc-900/40">
                          <UserIcon size={14} />
                        </div>
                        <span className="font-bold text-zinc-900/80 group-hover:text-zinc-900 transition-colors">
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
                    <td className="p-6 font-bold text-zinc-900/60">
                      {t.item.name}
                    </td>
                    <td className="p-6">
                      <div className={`flex items-center gap-1 font-black ${isAdd ? 'text-emerald-400' : isTake ? 'text-rose-400' : 'text-amber-400'}`}>
                        {isAdd ? <ArrowDownLeft size={14} /> : isTake ? <ArrowUpRight size={14} /> : null}
                        {isTake ? '-' : isAdd ? '+' : ''}{formatQty(t.quantity, t.item, t.unitMode)}
                      </div>
                    </td>
                    <td className="p-6">
                       <span className="text-zinc-900/40 text-xs font-medium italic">
                         {t.eventName || '-'}
                       </span>
                    </td>
                    <td className="p-6 text-right">
                      <div className="text-zinc-900 font-bold text-xs" suppressHydrationWarning>
                        {t.createdAt.toLocaleDateString('uz-UZ')}
                      </div>
                      <div className="text-zinc-900/20 text-[10px] mt-0.5 font-bold" suppressHydrationWarning>
                        {t.createdAt.toLocaleTimeString('uz-UZ', { hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          {transactions.length === 0 && (
            <div className="p-12 text-center text-zinc-900/30 font-medium">
              Bu davrda yozuv yo'q. Boshlanish sanasini oldinroq qilib ko'ring.
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
