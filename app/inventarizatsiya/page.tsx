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

  return <InventoryReconcile rows={rows} month={month} />
}
