import prisma from '@/lib/prisma';
import { BadgeDollarSign } from 'lucide-react'
import RepriceList, { type RepriceItem } from '@/components/RepriceList'
import { groupTakesByPrice } from '@/lib/reprice'

export const dynamic = 'force-dynamic'

export default async function NarxlarPage() {
  const [items, takes] = await Promise.all([
    prisma.item.findMany({ orderBy: { name: 'asc' } }),
    prisma.transaction.findMany({
      where: { type: 'TAKE', totalPrice: { gt: 0 } },
      select: { itemId: true, quantity: true, totalPrice: true, createdAt: true, eventName: true },
    }),
  ])

  const byItem = new Map<string, typeof takes>()
  for (const t of takes) {
    const list = byItem.get(t.itemId) ?? []
    list.push(t)
    byItem.set(t.itemId, list)
  }

  const rows: RepriceItem[] = items
    .map(i => ({
      id: i.id,
      name: i.name,
      unit: (i.unit || 'dona').toLowerCase(),
      price: i.price,
      groups: groupTakesByPrice(byItem.get(i.id) ?? [], i.price),
    }))
    .filter(r => r.groups.length > 0)

  return (
    <div className="p-4 sm:p-8 max-w-[1100px] mx-auto min-h-full">
      <header className="mb-8">
        <h1 className="text-3xl sm:text-4xl font-bold tracking-tight mb-2 text-zinc-900 flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-brand-500/20 flex items-center justify-center text-brand-400">
            <BadgeDollarSign size={24} />
          </div>
          Narxlarni tuzatish
        </h1>
        <p className="text-zinc-900/60 text-sm mt-2 max-w-2xl">
          Chiqim summasi yozilgan paytdagi narxda saqlanadi. Mahsulot narxini to'g'rilagan bo'lsangiz,
          quyida <b>hozirgi narxdan boshqa narxda</b> yozilgan eski chiqimlar ko'rinadi. Noto'g'ri narxdagilarni
          belgilab, hozirgi narxga o'tkazing. Kirimdan keyin narx o'zgargan bo'lsa, o'sha paytdagi chiqimlar
          to'g'ri bo'lishi mumkin — sanasiga qarab tanlang.
        </p>
      </header>

      <RepriceList items={rows} />
    </div>
  )
}
