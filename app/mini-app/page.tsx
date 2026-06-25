import prisma from '@/lib/prisma';
import MiniAppClient from './client'

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
    packUnit: i.packUnit
  }))

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

  return <MiniAppClient items={serializedItems} recentEvents={recentEvents} />
}
