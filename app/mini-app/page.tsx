import prisma from '@/lib/prisma';
import MiniAppClient, { type EventCard, type EventEntry } from './client'
import { fetchErpEvents } from '@/lib/erp'
import { formatQty } from '@/lib/units'

export const dynamic = 'force-dynamic'

const TASHKENT_MS = 5 * 60 * 60 * 1000
const hhmm = (d: Date) => new Date(d.getTime() + TASHKENT_MS).toISOString().slice(11, 16)

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
  const nowT = new Date(Date.now() + TASHKENT_MS)   // Toshkent vaqti
  const today = nowT.toISOString().slice(0, 10)
  const yesterday = new Date(nowT.getTime() - 24 * 60 * 60 * 1000).toISOString().slice(0, 10)

  const erp = await fetchErpEvents(yesterday, today)

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
      const mine = txs.filter(t => t.erpEventId === ev.id)   // eng yangisi birinchi

      // Mahsulot bo'yicha jamlama: olingan va qaytarilgan
      const byItem = new Map<string, { name: string; taken: number; returned: number; item: typeof mine[number]['item'] }>()
      let takenValue = 0
      let returnedValue = 0
      for (const t of mine) {
        const abs = Math.abs(t.quantity)
        const row = byItem.get(t.itemId) ?? { name: t.item.name, taken: 0, returned: 0, item: t.item }
        if (t.type === 'TAKE') {
          row.taken += abs
          takenValue += t.totalPrice ?? t.item.price * abs
        } else {
          row.returned += abs
          returnedValue += t.item.price * abs
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

      // Kun davomida: bitta "Saqlash" bir nechta tranzaksiya yaratadi, lekin
      // ularning vaqti bir xil — shu bo'yicha bitta yozuvga birlashtiramiz,
      // bekor qilish ham butun yozuvni bekor qiladi.
      const groups = new Map<string, EventEntry & { parts: string[] }>()
      for (const t of mine) {
        const key = `${t.createdAt.getTime()}|${t.userId}|${t.type}`
        const g = groups.get(key) ?? {
          key,
          ids: [],
          at: hhmm(t.createdAt),
          type: t.type === 'TAKE' ? 'TAKE' : 'ADD',
          who: t.user?.name || '',
          whoId: t.user?.telegramId || '',
          text: '',
          parts: [],
        }
        g.ids.push(t.id)
        g.parts.push(`${t.item.name} ${formatQty(Math.abs(t.quantity), t.item, t.unitMode)}`)
        groups.set(key, g)
      }
      const entries: EventEntry[] = Array.from(groups.values()).map(({ parts, ...g }) => ({
        ...g,
        text: parts.join(', '),
      }))

      return {
        ...ev,
        isToday: ev.date === today,
        lines,
        takenKinds: lines.filter(l => l.taken).length,
        netValue: Math.round(takenValue - returnedValue),
        txCount: mine.length,
        people: new Set(mine.map(t => t.userId)).size,
        lastAt: mine[0] ? hhmm(mine[0].createdAt) : null,
        entries,
      }
    })
  }

  // Oxirgi 30 kunda eng ko'p chiqim qilingan mahsulotlar — mahsulot oynasining
  // tepasida turadi, omborchi 50 ta ro'yxatni varaqlamasin.
  let frequentIds: string[] = []
  try {
    const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
    const freq = await prisma.transaction.groupBy({
      by: ['itemId'],
      where: { type: 'TAKE', createdAt: { gte: since } },
      _count: { itemId: true },
      orderBy: { _count: { itemId: 'desc' } },
      take: 6,
    })
    frequentIds = freq.map(f => f.itemId)
  } catch (err) {
    console.error('[mini-app] tez-tez olinadiganlar hisoblanmadi:', err)
  }

  // Oxirgi kiritilgan tadbir nomlari — "Boshqa ehtiyoj" uchun tugmalar.
  let recentEvents: string[] = []
  try {
    const recentTx = await prisma.transaction.findMany({
      where: { type: 'TAKE', eventName: { not: null }, erpEventId: null },
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
      frequentIds={frequentIds}
    />
  )
}

function loadEventTxs(ids: number[]) {
  return prisma.transaction.findMany({
    where: { erpEventId: { in: ids }, type: { in: ['TAKE', 'ADD'] } },
    include: { item: true, user: true },
    orderBy: { createdAt: 'desc' },
  })
}
