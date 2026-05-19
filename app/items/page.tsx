import prisma from '@/lib/prisma';
import { Package } from 'lucide-react'
import ItemsList from '@/components/ItemsList'

export const dynamic = 'force-dynamic'

export default async function ItemsPage() {
  const items = await prisma.item.findMany({
    orderBy: { name: 'asc' }
  })

  return (
    <div className="p-8 max-w-[1600px] mx-auto min-h-full">
      <header className="mb-10">
        <h1 className="text-4xl font-bold tracking-tight mb-2 text-zinc-900 flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-brand-500/20 flex items-center justify-center text-brand-400">
            <Package size={24} />
          </div>
          Mahsulotlar
        </h1>
        <p className="text-zinc-900/50 text-sm mt-2">Bazada mavjud barcha mahsulotlar ro'yxati va holati</p>
      </header>

      <div className="glass-card rounded-[2.5rem] overflow-hidden flex flex-col min-h-[500px] border border-white/60 shadow-2xl">
        <div className="p-8 border-b border-white/60 flex flex-col sm:flex-row justify-between items-center gap-4 bg-white/40">
          <div className="flex items-center gap-3 text-zinc-900">
            <span className="font-black text-xl uppercase tracking-tight">Ombor zaxirasi</span>
            <span className="px-4 py-1.5 bg-brand-500/10 rounded-xl text-brand-400 border border-brand-500/20 text-xs font-black uppercase tracking-widest">
              {items.length} turdagi tovar
            </span>
          </div>
          <p className="text-[10px] text-zinc-900/30 font-bold uppercase tracking-[0.2em] ml-auto">
            Haqiqiy qoldiqni tekshirish va tahrirlash
          </p>
        </div>

        <ItemsList initialItems={items} />
      </div>
    </div>
  )
}
