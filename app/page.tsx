import prisma from '@/lib/prisma';
import { Package, TrendingDown, TrendingUp, Clock, LayoutDashboard, ArrowUpRight, ArrowDownRight, Activity } from 'lucide-react';
import AdminPanel from '@/components/AdminPanel';
import { formatQty, packHint } from '@/lib/units';


export const dynamic = 'force-dynamic'

export default async function Home() {
  let items: any[] = [];
  let recentTransactions: any[] = [];
  let stats: any[] = [];
  
  try {
    items = await prisma.item.findMany({
      orderBy: { updatedAt: 'desc' },
    });
    
    recentTransactions = await prisma.transaction.findMany({
      take: 10,
      orderBy: { createdAt: 'desc' },
      include: {
        user: true,
        item: true,
      }
    });

    stats = await prisma.transaction.groupBy({
      by: ['type'],
      _sum: { quantity: true }
    });
  } catch (error) {
    console.error("Baza hali initsializatsiya qilinmagan bo'lishi mumkin.");
  }

  const totalItems = items.length;
  const totalQuantity = items.reduce((acc, curr) => acc + curr.quantity, 0);
  
  const totalTaken = Math.abs(stats.find(s => s.type === 'TAKE')?._sum?.quantity || 0);
  const totalReturned = stats.find(s => s.type === 'ADD')?._sum?.quantity || 0;

  return (
    <div className="p-8 max-w-[1600px] mx-auto min-h-full">
      {/* Header Section */}
      <header className="mb-10 flex flex-col md:flex-row md:justify-between md:items-end gap-6">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full glass border border-brand-500/30 text-brand-400 text-xs font-semibold tracking-wide mb-4 shadow-[0_0_10px_rgba(99,102,241,0.2)]">
            <span className="w-2 h-2 rounded-full bg-brand-400 animate-pulse"></span>
            TIZIM AKTIV
          </div>
          <h1 className="text-4xl font-bold tracking-tight mb-2 text-zinc-900 flex items-center gap-3">
            Ombor tahlili
          </h1>
          <p className="text-zinc-900/50 text-sm">Real vaqt rejimida qoldiqlar va oxirgi harakatlar hisoboti</p>
        </div>
        
        <div className="flex items-center gap-3">
          <div className="glass-card px-4 py-2 rounded-xl flex items-center gap-3">
            <div className="w-2 h-2 rounded-full bg-green-500"></div>
            <span className="text-sm font-medium text-zinc-900/80">Oxirgi yangilanish: {new Date().toLocaleTimeString('uz-UZ', { hour: '2-digit', minute: '2-digit' })}</span>
          </div>
        </div>
      </header>

      {/* KPI Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-10">
        <div className="glass-card p-6 rounded-2xl relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-32 h-32 bg-violet-500/10 rounded-full blur-3xl group-hover:bg-violet-500/20 transition-all"></div>
          <div className="flex justify-between items-start mb-4 relative z-10">
            <div>
              <p className="text-zinc-900/50 text-sm font-medium mb-1">Umumiy Qoldiq</p>
              <h3 className="text-3xl font-bold text-zinc-900">{totalQuantity.toLocaleString()}</h3>
            </div>
            <div className="w-12 h-12 rounded-xl bg-violet-500/10 border border-violet-500/20 flex items-center justify-center text-violet-400 shadow-[0_0_15px_rgba(139,92,246,0.1)]">
              <Activity size={24} />
            </div>
          </div>
          <div className="flex items-center gap-2 text-xs font-medium text-brand-400 mt-4 relative z-10">
            <Activity size={14} />
            <span>Hozirgi mavjud barcha narsalar</span>
          </div>
        </div>

        <div className="glass-card p-6 rounded-2xl relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-32 h-32 bg-rose-500/10 rounded-full blur-3xl group-hover:bg-rose-500/20 transition-all"></div>
          <div className="flex justify-between items-start mb-4 relative z-10">
            <div>
              <p className="text-zinc-900/50 text-sm font-medium mb-1">Jami Chiqimlar</p>
              <h3 className="text-3xl font-bold text-zinc-900">{totalTaken.toLocaleString()}</h3>
            </div>
            <div className="w-12 h-12 rounded-xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-400 shadow-[0_0_15px_rgba(244,63,94,0.1)]">
              <TrendingDown size={24} />
            </div>
          </div>
          <div className="flex items-center gap-2 text-xs font-medium text-rose-400 mt-4 relative z-10">
            <ArrowDownRight size={14} />
            <span>Skladdan olingan mahsulotlar</span>
          </div>
        </div>

        <div className="glass-card p-6 rounded-2xl relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/10 rounded-full blur-3xl group-hover:bg-emerald-500/20 transition-all"></div>
          <div className="flex justify-between items-start mb-4 relative z-10">
            <div>
              <p className="text-zinc-900/50 text-sm font-medium mb-1">Jami Kirim / Qaytgan</p>
              <h3 className="text-3xl font-bold text-zinc-900">{totalReturned.toLocaleString()}</h3>
            </div>
            <div className="w-12 h-12 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-500 shadow-[0_0_15px_rgba(16,185,129,0.1)]">
              <TrendingUp size={24} />
            </div>
          </div>
          <div className="flex items-center gap-2 text-xs font-medium text-emerald-500 mt-4 relative z-10">
            <ArrowUpRight size={14} />
            <span>Qaytarilgan yoki qo'shilganlar</span>
          </div>
        </div>

        <div className="glass-card p-6 rounded-2xl relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-32 h-32 bg-brand-500/10 rounded-full blur-3xl group-hover:bg-brand-500/20 transition-all"></div>
          <div className="flex justify-between items-start mb-4 relative z-10">
            <div>
              <p className="text-zinc-900/50 text-sm font-medium mb-1">Jami Turlar</p>
              <h3 className="text-3xl font-bold text-zinc-900">{totalItems}</h3>
            </div>
            <div className="w-12 h-12 rounded-xl bg-brand-500/10 border border-brand-500/20 flex items-center justify-center text-brand-400 shadow-[0_0_15px_rgba(99,102,241,0.1)]">
              <Package size={24} />
            </div>
          </div>
          <div className="flex items-center gap-2 text-xs font-medium text-brand-400 mt-4 relative z-10">
            <Package size={14} />
            <span>Turli xil mahsulotlar soni</span>
          </div>
        </div>
      </div>

      <AdminPanel items={items.map((i: any) => ({ id: i.id, name: i.name, unit: i.unit, packUnit: i.packUnit, packSize: i.packSize, price: i.price }))} />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mt-10">
        {/* Inventory Table */}
        <div className="lg:col-span-2 glass-card rounded-2xl overflow-hidden flex flex-col h-[600px]">
          <div className="p-6 border-b border-white/60 flex justify-between items-center bg-white/40">
            <h2 className="text-xl font-semibold flex items-center gap-3 text-zinc-900">
              <div className="w-8 h-8 rounded-lg bg-brand-500/20 flex items-center justify-center text-brand-400">
                <LayoutDashboard size={18} />
              </div>
              Ombor Qoldiqlari
            </h2>
            <div className="text-sm font-medium px-3 py-1 bg-white/40 rounded-lg text-zinc-900/50 border border-white/60">
              Jami: {items.length} ta ro'yxat
            </div>
          </div>
          <div className="flex-1 overflow-auto p-0">
            <table className="w-full text-left border-collapse">
              <thead className="sticky top-0 z-10 backdrop-blur-md bg-white/80 border-b border-white/60">
                <tr>
                  <th className="p-5 font-medium text-zinc-900/40 text-xs uppercase tracking-wider">Mahsulot Nomi</th>
                  <th className="p-5 font-medium text-zinc-900/40 text-xs uppercase tracking-wider w-32">Qoldiq</th>
                  <th className="p-5 font-medium text-zinc-900/40 text-xs uppercase tracking-wider text-right">Oxirgi yangilanish</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {items.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="p-12 text-center text-zinc-900/30 font-medium">
                      Hozircha mahsulotlar yo'q
                    </td>
                  </tr>
                ) : (
                  items.map((item) => (
                    <tr key={item.id} className="hover:bg-white/40 transition-colors group">
                      <td className="p-5 font-medium text-zinc-900/90 group-hover:text-brand-400 transition-colors">
                        {item.name}
                      </td>
                      <td className="p-5">
                        <span className={`inline-flex items-center justify-center px-3 py-1 rounded-lg text-sm font-bold border ${
                          item.quantity > 50 
                            ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' 
                            : item.quantity > 10
                            ? 'bg-brand-500/10 text-brand-400 border-brand-500/20'
                            : 'bg-rose-500/10 text-rose-400 border-rose-500/20'
                        }`}>
                          {item.quantity} {(item.unit || 'dona').toLowerCase()}{packHint(item.quantity, item) ? ` · ${packHint(item.quantity, item)}` : ''}
                        </span>
                      </td>
                      <td className="p-5 text-zinc-900/40 text-sm text-right font-medium">
                        {item.updatedAt.toLocaleDateString('uz-UZ')} <span className="text-zinc-900/20 ml-1">{item.updatedAt.toLocaleTimeString('uz-UZ', { hour: '2-digit', minute: '2-digit' })}</span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Recent Transactions */}
        <div className="glass-card rounded-2xl overflow-hidden flex flex-col h-[600px]">
          <div className="p-6 border-b border-white/60 flex justify-between items-center bg-white/40">
            <h2 className="text-xl font-semibold flex items-center gap-3 text-zinc-900">
              <div className="w-8 h-8 rounded-lg bg-violet-500/20 flex items-center justify-center text-violet-400">
                <Clock size={18} />
              </div>
              Oxirgi Harakatlar
            </h2>
          </div>
          <div className="p-6 overflow-y-auto flex-1">
            {recentTransactions.length === 0 ? (
              <div className="h-full flex items-center justify-center text-zinc-900/30 font-medium flex-col gap-3">
                <Clock size={32} className="opacity-20" />
                Harakatlar yo'q
              </div>
            ) : (
              <div className="space-y-4">
                {recentTransactions.map((tx) => (
                  <div key={tx.id} className="flex gap-4 items-start p-4 rounded-xl bg-white/40 border border-white/60 hover:bg-white/60 transition-all group">
                    <div className={`p-2.5 rounded-xl mt-0.5 shadow-lg ${
                      tx.type === 'TAKE' 
                        ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20 shadow-rose-500/10' 
                        : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 shadow-emerald-500/10'
                    }`}>
                      {tx.type === 'TAKE' ? <ArrowDownRight size={18} /> : <ArrowUpRight size={18} />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-zinc-900/90 truncate flex items-center gap-2">
                        {tx.user.name} 
                        <span className="text-xs px-2 py-0.5 rounded-full bg-white/40 text-zinc-900/50 font-semibold border border-white/60">
                          {tx.type === 'TAKE' ? 'CHIQIM' : 'KIRIM'}
                        </span>
                      </div>
                      <div className="text-sm text-zinc-900/60 truncate mt-1 group-hover:text-zinc-900/80 transition-colors">
                        {tx.item.name}
                      </div>
                      <div className="text-xs text-zinc-900/30 flex gap-3 items-center mt-2 font-medium">
                        <span className={`px-2 py-0.5 rounded-md ${tx.type === 'TAKE' ? 'bg-rose-500/10 text-rose-400' : 'bg-emerald-500/10 text-emerald-400'}`}>
                          {tx.type === 'TAKE' ? '-' : '+'}{formatQty(tx.quantity, tx.item, tx.unitMode)}
                        </span>
                        •
                        <span>{tx.createdAt.toLocaleString('uz-UZ', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
