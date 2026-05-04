'use client'

import React, { useState } from 'react'
import { Calendar, DollarSign, Package, TrendingUp, X, ChevronRight, ArrowUpRight, ChevronDown, ChevronUp } from 'lucide-react'

type Item = {
  name: string
  quantity: number
  cost: number
  unit: string
}

type Event = {
  key: string
  name: string
  date: string
  totalCost: number
  items: Item[]
}

type Month = {
  monthName: string
  totalCost: number
  events: Event[]
  impulseCost: number
  externalEventCount: number
}

type RecentTransaction = {
  id: string
  itemName: string
  quantity: number
  totalPrice: number
  eventName: string | null
  createdAt: string
  unit: string
}

export default function AnalyticsDashboard({ 
  months, 
  totalInventoryValue, 
  totalEvents,
  recentTransactions,
  allEvents
}: { 
  months: Month[], 
  totalInventoryValue: number,
  totalEvents: number,
  recentTransactions: RecentTransaction[],
  allEvents: Event[]
}) {
  const [selectedMonth, setSelectedMonth] = useState<Month | null>(null)
  const [expandedEvent, setExpandedEvent] = useState<string | null>(null)
  const [expandedEventInModal, setExpandedEventInModal] = useState<string | null>(null)

  return (
    <div className="p-8 max-w-[1600px] mx-auto min-h-full">
      <header className="mb-10">
        <h1 className="text-4xl font-bold tracking-tight mb-2 text-white flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-amber-500/20 flex items-center justify-center text-amber-400">
            <TrendingUp size={24} />
          </div>
          Hisobotlar va Tahlil
        </h1>
        <p className="text-white/50 text-sm mt-2">Omborxona xarajatlari va oylik tahlil</p>
      </header>

      {/* Top Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-12">
        <div className="glass-card p-8 rounded-3xl relative overflow-hidden group border border-white/5 shadow-2xl">
          <div className="absolute top-0 right-0 w-64 h-64 bg-amber-500/5 rounded-full blur-3xl group-hover:bg-amber-500/10 transition-all"></div>
          <p className="text-white/40 text-sm font-bold uppercase tracking-widest mb-2">Ombordagi umumiy qiymat</p>
          <div className="flex items-end gap-3">
            <h3 className="text-4xl font-black text-white" suppressHydrationWarning>
              {totalInventoryValue.toLocaleString('uz-UZ')}
            </h3>
            <span className="text-amber-400 font-bold mb-1">UZS</span>
          </div>
        </div>

        <div className="glass-card p-8 rounded-3xl relative overflow-hidden group border border-white/5 shadow-2xl">
          <div className="absolute top-0 right-0 w-64 h-64 bg-brand-500/5 rounded-full blur-3xl group-hover:bg-brand-500/10 transition-all"></div>
          <p className="text-white/40 text-sm font-bold uppercase tracking-widest mb-2">Jami tadbirlar</p>
          <div className="flex items-end gap-3">
            <h3 className="text-4xl font-black text-white">{totalEvents}</h3>
            <span className="text-brand-400 font-bold mb-1">ta</span>
          </div>
        </div>
      </div>

      {/* Monthly Cards */}
      <h2 className="text-2xl font-bold text-white mb-8 flex items-center gap-3">
        <div className="w-2 h-8 bg-brand-500 rounded-full"></div>
        Oylik Hisobotlar
      </h2>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-16">
        {months.map((m) => (
          <div 
            key={m.monthName} 
            onClick={() => setSelectedMonth(m)}
            className="glass-card p-8 rounded-[2rem] border border-white/5 relative group cursor-pointer hover:border-brand-500/40 hover:-translate-y-2 transition-all shadow-xl bg-white/[0.02]"
          >
            <div className="absolute top-6 right-6 w-10 h-10 rounded-full bg-white/5 flex items-center justify-center text-white/20 group-hover:bg-brand-500/20 group-hover:text-brand-400 transition-all">
              <ArrowUpRight size={20} />
            </div>
            
            <div className="text-brand-400 text-xs font-black uppercase tracking-widest mb-6">{m.monthName}</div>
            
            <div className="space-y-6">
              <div>
                <p className="text-white/30 text-xs font-medium mb-1 uppercase">Jami xarajat</p>
                <div className="text-3xl font-black text-white" suppressHydrationWarning>
                  {m.totalCost.toLocaleString('uz-UZ')} <span className="text-xs text-white/20">UZS</span>
                </div>
              </div>

              <div className="pt-6 border-t border-white/5">
                <div className="flex justify-between items-center text-sm mb-3">
                  <span className="text-white/40 font-medium">Tadbirlar soni</span>
                  <span className="text-emerald-400 font-bold">{m.externalEventCount} ta</span>
                </div>
                <div className="flex justify-between items-center text-sm">
                  <span className="text-white/40 font-medium">Impulse (O'zimiz)</span>
                  <span className="text-violet-400 font-bold" suppressHydrationWarning>{m.impulseCost.toLocaleString('uz-UZ')} UZS</span>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Events Explorer */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 mb-16">
        <div>
          <h2 className="text-2xl font-bold text-white mb-8 flex items-center gap-3">
            <div className="w-2 h-8 bg-emerald-500 rounded-full"></div>
            Tadbirlar Ketma-ketligi
          </h2>
          <div className="glass-card rounded-[2.5rem] overflow-hidden border border-white/5 shadow-2xl bg-white/[0.01] h-[600px] flex flex-col">
            <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
              <div className="space-y-4">
                {allEvents.map((event) => (
                  <div key={event.key} className="glass-card rounded-2xl border border-white/5 overflow-hidden group hover:border-emerald-500/30 transition-all">
                    <button 
                      onClick={() => setExpandedEvent(expandedEvent === event.key ? null : event.key)}
                      className="w-full p-6 text-left flex justify-between items-center bg-white/[0.02] hover:bg-white/[0.04] transition-colors"
                    >
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-400 group-hover:scale-110 transition-transform">
                          <Calendar size={20} />
                        </div>
                        <div>
                          <div className={`font-bold ${event.name.toLowerCase().includes('impulse') ? 'text-violet-400' : 'text-white'}`}>
                            {event.name}
                          </div>
                          <div className="text-xs text-white/30 mt-1">{event.date}</div>
                        </div>
                      </div>
                      <div className="flex items-center gap-6">
                        <div className="text-right">
                          <div className="text-lg font-black text-white" suppressHydrationWarning>{event.totalCost.toLocaleString('uz-UZ')} UZS</div>
                        </div>
                        <div className="text-white/20">
                          {expandedEvent === event.key ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                        </div>
                      </div>
                    </button>
                    
                    {expandedEvent === event.key && (
                      <div className="p-6 bg-black/40 border-t border-white/5 animate-in slide-in-from-top-2 duration-200">
                        <div className="grid grid-cols-1 gap-3">
                          {event.items.map((item, i) => (
                            <div key={i} className="flex justify-between items-center p-3 rounded-xl bg-white/5 border border-white/5">
                              <div>
                                <div className="text-sm font-medium text-white/80">{item.name}</div>
                                <div className="text-xs text-rose-400 font-bold">-{item.quantity} {item.unit.toLowerCase()}</div>
                              </div>
                              <div className="text-sm text-emerald-400 font-bold" suppressHydrationWarning>
                                {item.cost.toLocaleString('uz-UZ')} UZS
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div>
          <h2 className="text-2xl font-bold text-white mb-8 flex items-center gap-3">
            <div className="w-2 h-8 bg-violet-500 rounded-full"></div>
            Oxirgi Mahsulotlar
          </h2>
          <div className="glass-card rounded-[2.5rem] overflow-hidden border border-white/5 shadow-2xl bg-white/[0.01] h-[600px]">
             <div className="overflow-y-auto h-full custom-scrollbar">
                <table className="w-full text-left border-collapse">
                  <thead className="bg-white/[0.04] sticky top-0 z-10 backdrop-blur-md">
                    <tr>
                      <th className="p-6 font-bold text-white/30 text-[10px] uppercase tracking-widest">Mahsulot</th>
                      <th className="p-6 font-bold text-white/30 text-[10px] uppercase tracking-widest text-right">Miqdor</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {recentTransactions.map(t => (
                      <tr key={t.id} className="hover:bg-white/[0.02] transition-colors group">
                        <td className="p-6">
                          <div className="font-bold text-white group-hover:text-violet-400 transition-colors">{t.itemName}</div>
                          <div className="text-[10px] text-white/20 mt-1 uppercase tracking-wider font-bold">
                            {t.eventName || 'Noma\'lum'} • {t.createdAt}
                          </div>
                        </td>
                        <td className="p-6 text-right font-black text-rose-400">-{Math.abs(t.quantity)} {t.unit.toLowerCase()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
             </div>
          </div>
        </div>
      </div>

      {/* Detail Modal */}
      {selectedMonth && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 md:p-8">
          <div className="absolute inset-0 bg-black/80 backdrop-blur-md" onClick={() => setSelectedMonth(null)}></div>
          
          <div className="glass-card w-full max-w-5xl max-h-[90vh] rounded-[2.5rem] border border-white/10 shadow-2xl flex flex-col relative z-10 overflow-hidden animate-in fade-in zoom-in duration-300">
            {/* Modal Header */}
            <div className="p-8 border-b border-white/5 flex justify-between items-center bg-white/[0.02]">
              <div>
                <h2 className="text-3xl font-black text-white uppercase tracking-tight">{selectedMonth.monthName} Hisoboti</h2>
                <div className="text-white/40 text-sm mt-1 flex items-center gap-2">
                  <TrendingUp size={14} className="text-brand-400" />
                  <span>Jami {selectedMonth.events.length} ta tadbir o'tkazilgan</span>
                </div>
              </div>
              <button 
                onClick={() => setSelectedMonth(null)}
                className="w-12 h-12 rounded-2xl bg-white/5 flex items-center justify-center text-white/40 hover:bg-rose-500/20 hover:text-rose-400 transition-all"
              >
                <X size={24} />
              </button>
            </div>

            {/* Modal Content - ACCORDION STYLE */}
            <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
              <div className="space-y-4">
                {selectedMonth.events.map((event, idx) => {
                  const eventKeyInModal = `modal_${event.key}_${idx}`;
                  const isExpanded = expandedEventInModal === eventKeyInModal;
                  
                  return (
                    <div key={eventKeyInModal} className="glass-card rounded-2xl border border-white/5 overflow-hidden">
                      <button 
                        onClick={() => setExpandedEventInModal(isExpanded ? null : eventKeyInModal)}
                        className="w-full p-6 text-left flex justify-between items-center bg-white/[0.03] hover:bg-white/[0.05] transition-colors"
                      >
                        <div className="flex items-center gap-4">
                          <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${event.name.toLowerCase().includes('impulse') ? 'bg-violet-500/10 text-violet-400' : 'bg-brand-500/10 text-brand-400'}`}>
                            <Calendar size={18} />
                          </div>
                          <div>
                            <h4 className={`font-bold ${event.name.toLowerCase().includes('impulse') ? 'text-violet-400' : 'text-white'}`}>
                              {event.name}
                            </h4>
                            <p className="text-xs text-white/30 mt-0.5">{event.date}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-6">
                          <div className="text-right">
                            <div className="text-lg font-black text-white" suppressHydrationWarning>{event.totalCost.toLocaleString('uz-UZ')} UZS</div>
                          </div>
                          <div className="text-white/20">
                            {isExpanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                          </div>
                        </div>
                      </button>
                      
                      {isExpanded && (
                        <div className="p-6 bg-black/30 border-t border-white/5 animate-in slide-in-from-top-1 duration-200">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            {event.items.map((item, i) => (
                              <div key={i} className="flex justify-between items-center p-4 rounded-xl bg-white/5 border border-white/5">
                                <div>
                                  <div className="text-sm font-bold text-white/80">{item.name}</div>
                                  <div className="text-xs text-rose-400 font-bold mt-1">-{item.quantity} {item.unit.toLowerCase()}</div>
                                </div>
                                <div className="text-right text-sm font-black text-white/60" suppressHydrationWarning>
                                  {item.cost.toLocaleString('uz-UZ')} UZS
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-8 border-t border-white/5 bg-white/[0.02] flex justify-between items-center">
               <div className="flex gap-8">
                  <div>
                    <p className="text-white/20 text-[10px] uppercase font-bold mb-1">Jami xarajat</p>
                    <p className="text-2xl font-black text-white" suppressHydrationWarning>{selectedMonth.totalCost.toLocaleString('uz-UZ')} <span className="text-xs opacity-30">UZS</span></p>
                  </div>
                  <div>
                    <p className="text-white/20 text-[10px] uppercase font-bold mb-1">Impulse iste'moli</p>
                    <p className="text-2xl font-black text-violet-400" suppressHydrationWarning>{selectedMonth.impulseCost.toLocaleString('uz-UZ')} <span className="text-xs opacity-30">UZS</span></p>
                  </div>
               </div>
               <button onClick={() => setSelectedMonth(null)} className="px-8 py-4 rounded-2xl bg-brand-500 text-black font-black hover:bg-brand-400 transition-all">YOPISH</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
