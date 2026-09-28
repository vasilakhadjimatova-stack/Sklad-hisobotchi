import prisma from '@/lib/prisma';
import MiniAppClient, { type EventCard } from './client'
import { fetchErpEvents } from '@/lib/erp'
import { formatQty } from '@/lib/units'

export const dynamic = 'force-dynamic'

export default async function MiniAppPage() {
  const items = await prisma.item.findMany({
    orderBy: { name: 'asc' }
  })

  const serializedItems = items.map(i => ({
    id: i.id,
    name: i.name,
    quantity: i.quantity,
    unit: i.unit,
    price: i.price,
    packSize: i.packSize,
    packUnit: i.packUnit,
    packOnly: i.packOnly
  }))

  // ── ERP kalendari: kechagi va bugungi tadbirlar ──
  // Kecha ham ko'rsatiladi: kechqurun o'tgan tadbirning chiqimi ko'pincha
  // ertasi kuni yoziladi — kartochka yarim tunda yo'qolib qolmasin.
  const nowT = new Date(Date.now() + 5 * 60 * 60 * 1000)   // Toshkent vaqti
  const today = nowT.toISOString().slice(0, 10)
  const yesterday = new Date(nowT.getTime() - 24 * 60 * 60 * 1000).toISOString().slice(0, 10)

  const erp = await fetchErpEvents(yesterday, today)

  // Har tadbirga nima olingani (va qaytarilgani) — mahsulot bo'yicha jamlab
  let eventCards: EventCard[] = []
  if (erp.events.length > 0) {
    const ids = erp.events.map(e => e.id)
    let txs: Awaited<ReturnType<typeof loadEventTxs>> = []
    try {
      txs = await loadEventTxs(ids)
    } catch (err) {
      console.error('[mini-app] tadbir tranzaksiyalari yuklanmadi:', err)
    }

    eventCards = erp.events.map(ev => {
      const mine = txs.filter(t => t.erpEventId === ev.id)
      const byItem = new Map<string, { name: string; taken: number; returned: number; item: typeof mine[number]['item'] }>()
      let takenValue = 0
      for (const t of mine) {
        const row = byItem.get(t.itemId) ?? { name: t.item.name, taken: 0, returned: 0, item: t.item }
        if (t.type === 'TAKE') {
          row.taken += Math.abs(t.quantity)
          takenValue += t.totalPrice ?? t.item.price * Math.abs(t.quantity)
        } else {
          row.returned += Math.abs(t.quantity)
        }
        byItem.set(t.itemId, row)
      }
      const mode = (it: { packOnly: boolean }) => (it.packOnly ? 'pack' : null)
      const lines = Array.from(byItem.values())
        .sort((a, b) => a.name.localeCompare(b.name))
        .map(r => ({
          name: r.name,
          taken: r.taken > 0 ? formatQty(r.taken, r.item, mode(r.item)) : '',
          returned: r.returned > 0 ? formatQty(r.returned, r.item, mode(r.item)) : '',
        }))
      const last = mine[0]?.createdAt   // eng yangisi (desc tartib)
      return {
        ...ev,
        isToday: ev.date === today,
        lines,
        takenValue: Math.round(takenValue),
        lastAt: last
          ? new Date(last.getTime() + 5 * 60 * 60 * 1000).toISOString().slice(11, 16)
          : null,
      }
    })
  }

  // Oxirgi kiritilgan tadbir nomlari (chiqimlardan) — tugma sifatida ko'rsatamiz.
  let recentEvents: string[] = []
  try {
    const recentTx = await prisma.transaction.findMany({
      where: { type: 'TAKE', eventName: { not: null } },
      orderBy: { createdAt: 'desc' },
      select: { eventName: true },
      take: 80,
    })
    const seen = new Set<string>()
    for (const t of recentTx) {
      const e = (t.eventName || '').trim()
      if (!e) continue
      const key = e.toLowerCase()
      if (key === 'impulse' || key.startsWith('inventar') || seen.has(key)) continue
      seen.add(key)
      recentEvents.push(e)
      if (recentEvents.length >= 4) break
    }
  } catch {
    recentEvents = []
  }

  return (
    <MiniAppClient
      items={serializedItems}
      recentEvents={recentEvents}
      eventCards={eventCards}
      erpStatus={erp.status}
    />
  )
}

function loadEventTxs(ids: number[]) {
  return prisma.transaction.findMany({
    where: { erpEventId: { in: ids }, type: { in: ['TAKE', 'ADD'] } },
    include: { item: true },
    orderBy: { createdAt: 'desc' },
  })
}
