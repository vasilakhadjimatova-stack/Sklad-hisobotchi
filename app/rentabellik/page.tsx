import prisma from '@/lib/prisma';
import { TrendingUp } from 'lucide-react'
import RentabellikClient, { type MapItem, type EventRow } from '@/components/RentabellikClient'
import { computeCosts } from '@/lib/erpExpenses'

export const dynamic = 'force-dynamic'

const DAYS = 60

export default async function RentabellikPage() {
  const erpOn = !!(process.env.ERP_URL && process.env.ERP_API_KEY)
  const since = new Date(Date.now() - DAYS * 24 * 60 * 60 * 1000)

  const [items, txs, synced] = await Promise.all([
    prisma.item.findMany({ orderBy: { name: 'asc' } }),
    prisma.transaction.findMany({
      where: { erpEventId: { not: null }, type: { in: ['TAKE', 'ADD'] }, createdAt: { gte: since } },
      select: {
        erpEventId: true, eventName: true, type: true, quantity: true, totalPrice: true, createdAt: true,
        item: { select: { name: true, price: true, unit: true, packSize: true, packUnit: true, packOnly: true, erpCategory: true } },
      },
    }),
    prisma.erpExpenseSync.findMany(),
  ])

  const mapItems: MapItem[] = items.map(i => ({ id: i.id, name: i.name, erpCategory: i.erpCategory }))

  const costs = computeCosts(txs)
  const prev = new Map(synced.map(s => [s.erpEventId, s]))
  const ids = new Set<number>(costs.keys())
  for (const s of synced) if (s.syncedAt >= since && (s.water > 0 || s.coffee > 0)) ids.add(s.erpEventId)

  const events: EventRow[] = Array.from(ids).map(id => {
    const c = costs.get(id)
    const p = prev.get(id)
    const water = c?.water ?? 0
    const coffee = c?.coffee ?? 0
    const same = !!p && p.water === water && p.coffee === coffee
    const state: EventRow['state'] =
      !p ? 'pending'
      : p.status === 'locked' ? 'locked'
      : p.status === 'notfound' ? 'notfound'
      : p.status === 'error' ? 'error'
      : same ? 'ok' : 'pending'
    return {
      id,
      name: c?.eventName || p?.eventName || `Tadbir #${id}`,
      date: (c?.eventDate ?? p?.syncedAt ?? new Date()).toISOString(),
      water, coffee, state,
      error: p?.error || '',
      notes: c?.lines.map(l => l.note) ?? [],
    }
  }).sort((a, b) => (a.date < b.date ? 1 : -1))

  return (
    <div className="p-4 sm:p-8 max-w-[1100px] mx-auto min-h-full">
      <header className="mb-8">
        <h1 className="text-3xl sm:text-4xl font-bold tracking-tight mb-2 text-zinc-900 flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-brand-500/20 flex items-center justify-center text-brand-400">
            <TrendingUp size={24} />
          </div>
          Rentabellik (ERP)
        </h1>
        <p className="text-zinc-900/60 text-sm mt-2 max-w-2xl">
          Tadbir kartochkasidan qilingan <b>suv</b> va <b>kofe</b> chiqimi ERP'da o'sha tadbirning xarajati
          bo'lib avtomatik yoziladi (qaytgani ayiriladi). Quyida qaysi mahsulot suv, qaysi biri kofe ekanini belgilang.
        </p>
      </header>

      <RentabellikClient items={mapItems} events={events} erpOn={erpOn} days={DAYS} />
    </div>
  )
}
