import prisma from '@/lib/prisma'
import InventoryReconcile from '@/components/InventoryReconcile'

export const dynamic = 'force-dynamic'

export default async function InventarizatsiyaPage({
  searchParams,
}: {
  searchParams: { month?: string }
}) {
  const items = await prisma.item.findMany({ orderBy: { name: 'asc' } })

  // Toshkent joriy oyi (UTC+5)
  const nowTashkent = new Date(Date.now() + 5 * 60 * 60 * 1000)
  const month = /^\d{4}-\d{2}$/.test(searchParams.month || '')
    ? (searchParams.month as string)
    : nowTashkent.toISOString().slice(0, 7)
  const [y, m] = month.split('-').map(Number)

  // Oy chegarasi (Toshkent kunlari) -> UTC instantlar
  const start = new Date(Date.UTC(y, m - 1, 1, -5, 0, 0))
  const end = new Date(Date.UTC(y, m, 1, -5, 0, 0))

  const txs = await prisma.transaction.findMany({
    where: { createdAt: { gte: start, lt: end }, type: { in: ['TAKE', 'ADD'] } },
    select: { itemId: true, quantity: true, type: true },
  })

  const usedMap: Record<string, number> = {}   // chiqim (ishlatilgan)
  const inMap: Record<string, number> = {}     // kirim
  for (const t of txs) {
    if (t.type === 'TAKE') usedMap[t.itemId] = (usedMap[t.itemId] || 0) + Math.abs(t.quantity)
    else inMap[t.itemId] = (inMap[t.itemId] || 0) + Math.abs(t.quantity)
  }

  const rows = items.map(i => ({
    id: i.id,
    name: i.name,
    unit: i.unit || 'dona',
    packSize: i.packSize || 1,
    packUnit: i.packUnit || 'pachka',
    qty: i.quantity,
    used: usedMap[i.id] || 0,
    added: inMap[i.id] || 0,
  }))

  // Shu oyda qilingan tuzatishlar (ADJUST) — tarix sifatida ko'rsatish uchun
  const adjTxs = await prisma.transaction.findMany({
    where: { type: 'ADJUST', createdAt: { gte: start, lt: end } },
    orderBy: { createdAt: 'desc' },
    take: 300,
    include: {
      item: { select: { name: true, unit: true, price: true, quantity: true } },
      user: { select: { name: true } },
    },
  })
  const adjustments = adjTxs
    .filter(t => t.item)
    .map(t => {
      const d = new Date(t.createdAt.getTime() + 5 * 60 * 60 * 1000) // Toshkent
      const dd = String(d.getUTCDate()).padStart(2, '0')
      const mo = String(d.getUTCMonth() + 1).padStart(2, '0')
      const hh = String(d.getUTCHours()).padStart(2, '0')
      const mi = String(d.getUTCMinutes()).padStart(2, '0')
      return {
        id: t.id,
        name: t.item!.name,
        unit: t.item!.unit || 'dona',
        delta: t.quantity,
        date: `${dd}/${mo}/${d.getUTCFullYear()}`,
        time: `${hh}:${mi}`,
        by: t.user?.name || '',
        price: t.item!.price ?? 0,
        qty: t.item!.quantity ?? 0,
      }
    })

  return <InventoryReconcile rows={rows} month={month} adjustments={adjustments} />
}
