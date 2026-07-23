import prisma from '@/lib/prisma'
import { Trash2 } from 'lucide-react'
import CleanupList, { CleanupItem, DuplicateGroup } from '@/components/CleanupList'

export const dynamic = 'force-dynamic'

// Nomni registrsiz normalizatsiya qilish (dublikatni topish uchun).
function normalizeName(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, ' ')
}

export default async function CleanupPage() {
  let items: any[] = []
  try {
    items = await prisma.item.findMany({
      orderBy: { name: 'asc' },
      include: { _count: { select: { transactions: true } } },
    })
  } catch (error) {
    console.error("Baza hali initsializatsiya qilinmagan bo'lishi mumkin.")
  }

  const toCleanupItem = (i: any): CleanupItem => ({
    id: i.id,
    name: i.name,
    quantity: i.quantity,
    unit: i.unit || 'dona',
    price: i.price || 0,
    updatedAt: i.updatedAt?.toISOString?.() ?? String(i.updatedAt),
    txCount: i._count?.transactions ?? 0,
  })

  // Tugagan: qoldiq aniq 0
  const finished: CleanupItem[] = items.filter((i) => i.quantity === 0).map(toCleanupItem)

  // Dublikat: normalizatsiya qilingan nom bo'yicha guruhlash, 1 tadan ko'p bo'lsa
  const groups = new Map<string, CleanupItem[]>()
  for (const i of items) {
    const key = normalizeName(i.name)
    const arr = groups.get(key) ?? []
    arr.push(toCleanupItem(i))
    groups.set(key, arr)
  }
  const duplicates: DuplicateGroup[] = Array.from(groups.entries())
    .filter(([, arr]) => arr.length > 1)
    .map(([key, arr]) => ({ key, items: arr }))

  return (
    <div className="p-8 max-w-[1600px] mx-auto min-h-full">
      <header className="mb-10">
        <h1 className="text-4xl font-bold tracking-tight mb-2 text-zinc-900 flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-rose-500/15 flex items-center justify-center text-rose-500">
            <Trash2 size={24} />
          </div>
          Ombor tozalash
        </h1>
        <p className="text-zinc-900/50 text-sm mt-2">Tugagan (qoldiq 0) va takrorlangan (dublikat) mahsulotlarni ko'rish va o'chirish</p>
      </header>

      <CleanupList finished={finished} duplicates={duplicates} />
    </div>
  )
}
