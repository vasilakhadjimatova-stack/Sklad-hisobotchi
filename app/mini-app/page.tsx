import { PrismaClient } from '@prisma/client'
import MiniAppClient from './client'

const prisma = new PrismaClient()

export default async function MiniAppPage() {
  const items = await prisma.item.findMany({
    orderBy: { name: 'asc' },
    where: { quantity: { gt: 0 } }
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
