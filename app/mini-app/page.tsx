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
    price: i.price
  }))

  return <MiniAppClient items={serializedItems} />
}
