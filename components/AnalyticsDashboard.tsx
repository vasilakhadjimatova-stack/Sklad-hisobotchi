'use client'

import React, { useState } from 'react'
import { Calendar, DollarSign, Package, TrendingUp, X, ChevronRight, ArrowUpRight, ChevronDown, ChevronUp, BarChart2, List } from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, Cell } from 'recharts'

type Item = {
  name: string
  quantity: number  // sof ishlatilgan (olingan - qaytgan), bazaviy birlikda
  cost: number      // sof xarajat
  unit: string
  taken?: number    // jami olingan (chiqim)
  returned?: number // jami qaytgan (kirim)
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
  products: Item[]
}

type RecentTransaction = {
  id: string
  itemName: string
  quantity: number
  totalPrice: number
  eventName: string | null
  createdAt: string
  unit: string
  type: string // 'TAKE' (chiqim) | 'ADD' / 'RETURN' (qaytarish)
}

// Sof miqdor yorlig'i: chiqim "-N", qaytarish ko'p bo'lsa "+N" ko'rinadi
const netLabel = (item: Item) => (item.quantity >= 0 ? `-${item.quantity}` : `+${-item.quantity}`)

// Qaytgan mahsulot bo'lsa "olingan X · qaytdi Y" eslatmasi
function ReturnNote({ item }: { item: Item }) {
  if (!item.returned || item.returned <= 0) return null
  return (
    <div className="text-[10px] text-zinc-900/40 font-medium mt-1">
      {item.taken} olingan · <span className="text-emerald-500 font-bold">{item.returned} qaytdi</span>
    </div>
  )
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
  const [modalTab, setModalTab] = useState<'events' | 'products'>('events')

  return (
    <div className="p-8 max-w-[1600px] mx-auto min-h-full">
      <header className="mb-10">
        <h1 className="text-4xl font-bold tracking-tight mb-2 text-zinc-900 flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-amber-500/20 flex items-center justify-center text-amber-400">
            <TrendingUp size={24} />
          </div>
          Hisobotlar va Tahlil
        </h1>
        <p className="text-zinc-900/50 text-sm mt-2">Omborxona xarajatlari va oylik tahlil</p>
      </header>

      {/* Top Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-12">
        <div className="glass-card p-8 rounded-3xl relative overflow-hidden group border border-white/60 shadow-2xl">
          <div className="absolute top-0 right-0 w-64 h-64 bg-amber-500/5 rounded-full blur-3xl group-hover:bg-amber-500/10 transition-all"></div>
          <p className="text-zinc-900/40 text-sm font-bold uppercase tracking-widest mb-2">Ombordagi umumiy qiymat</p>
          <div className="flex items-end gap-3">
            <h3 className="text-4xl font-black text-zinc-900" suppressHydrationWarning>
              {totalInventoryValue.toLocaleString('uz-UZ')}
            </h3>
            <span className="text-amber-400 font-bold mb-1">UZS</span>
          </div>
        </div>

        <div className="glass-card p-8 rounded-3xl relative overflow-hidden group border border-white/60 shadow-2xl">
          <div className="absolute top-0 right-0 w-64 h-64 bg-brand-500/5 rounded-full blur-3xl group-hover:bg-brand-500/10 transition-all"></div>
          <p className="text-zinc-900/40 text-sm font-bold uppercase tracking-widest mb-2">Jami tadbirlar</p>
          <div className="flex items-end gap-3">
            <h3 className="text-4xl font-black text-zinc-900">{totalEvents}</h3>
            <span className="text-brand-400 font-bold mb-1">ta</span>
          </div>
        </div>
      </div>

      {/* Monthly Cards */}
      <h2 className="text-2xl font-bold text-zinc-900 mb-8 flex items-center gap-3">
        <div className="w-2 h-8 bg-brand-500 rounded-full"></div>
        Oylik Hisobotlar
      </h2>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-16">
        {months.map((m) => (
          <div 
            key={m.monthName} 
            onClick={() => setSelectedMonth(m)}
            className="glass-card p-8 rounded-[2rem] border border-white/60 relative group cursor-pointer hover:border-brand-500/40 hover:-translate-y-2 transition-all shadow-xl bg-white/40"
          >
            <div className="absolute top-6 right-6 w-10 h-10 rounded-full bg-white/40 flex items-center justify-center text-zinc-900/20 group-hover:bg-brand-500/20 group-hover:text-brand-400 transition-all">
              <ArrowUpRight size={20} />
            </div>
            
            <div className="text-brand-400 text-xs font-black uppercase tracking-widest mb-6">{m.monthName}</div>
            
            <div className="space-y-6">
              <div>
                <p className="text-zinc-900/30 text-xs font-medium mb-1 uppercase">Jami xarajat</p>
                <div className="text-3xl font-black text-zinc-900" suppressHydrationWarning>
                  {m.totalCost.toLocaleString('uz-UZ')} <span className="text-xs text-zinc-900/20">UZS</span>
                </div>
              </div>

              <div className="pt-6 border-t border-white/60">
                <div className="flex justify-between items-center text-sm mb-3">
                  <span className="text-zinc-900/40 font-medium">Tadbirlar soni</span>
                  <span className="text-emerald-400 font-bold">{m.externalEventCount} ta</span>
                </div>
                <div className="flex justify-between items-center text-sm">
                  <span className="text-zinc-900/40 font-medium">Impulse (O'zimiz)</span>
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
          <h2 className="text-2xl font-bold text-zinc-900 mb-8 flex items-center gap-3">
            <div className="w-2 h-8 bg-emerald-500 rounded-full"></div>
            Tadbirlar Ketma-ketligi
          </h2>
          <div className="glass-card rounded-[2.5rem] overflow-hidden border border-white/60 shadow-2xl bg-white/[0.01] h-[600px] flex flex-col">
            <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
              <div className="space-y-4">
                {allEvents.map((event) => (
                  <div key={event.key} className="glass-card rounded-2xl border border-white/60 overflow-hidden group hover:border-emerald-500/30 transition-all">
                    <button 
                      onClick={() => setExpandedEvent(expandedEvent === event.key ? null : event.key)}
                      className="w-full p-6 text-left flex justify-between items-center bg-white/40 hover:bg-white/60 transition-colors"
                    >
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-400 group-hover:scale-110 transition-transform">
                          <Calendar size={20} />
                        </div>
                        <div>
                          <div className={`font-bold ${event.name.toLowerCase().includes('impulse') ? 'text-violet-400' : 'text-zinc-900'}`}>
                            {event.name}
                          </div>
                          <div className="text-xs text-zinc-900/30 mt-1">{event.date}</div>
                        </div>
                      </div>
                      <div className="flex items-center gap-6">
                        <div className="text-right">
                          <div className="text-lg font-black text-zinc-900" suppressHydrationWarning>{event.totalCost.toLocaleString('uz-UZ')} UZS</div>
                        </div>
                        <div className="text-zinc-900/20">
                          {expandedEvent === event.key ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                        </div>
                      </div>
                    </button>
                    
                    {expandedEvent === event.key && (
                      <div className="p-6 bg-black/40 border-t border-white/60 animate-in slide-in-from-top-2 duration-200">
                        <div className="grid grid-cols-1 gap-3">
                          {event.items.map((item, i) => (
                            <div key={i} className="flex justify-between items-center p-3 rounded-xl bg-white/40 border border-white/60">
                              <div>
                                <div className="text-sm font-medium text-zinc-900/80">{item.name}</div>
                                <div className="text-xs text-rose-400 font-bold">{netLabel(item)} {item.unit.toLowerCase()}</div>
                                <ReturnNote item={item} />
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
          <h2 className="text-2xl font-bold text-zinc-900 mb-8 flex items-center gap-3">
            <div className="w-2 h-8 bg-violet-500 rounded-full"></div>
            Oxirgi Mahsulotlar
          </h2>
          <div className="glass-card rounded-[2.5rem] overflow-hidden border border-white/60 shadow-2xl bg-white/[0.01] h-[600px]">
             <div className="overflow-y-auto h-full custom-scrollbar">
                <table className="w-full text-left border-collapse">
                  <thead className="bg-white/60 sticky top-0 z-10 backdrop-blur-md">
                    <tr>
                      <th className="p-6 font-bold text-zinc-900/30 text-[10px] uppercase tracking-widest">Mahsulot</th>
                      <th className="p-6 font-bold text-zinc-900/30 text-[10px] uppercase tracking-widest text-right">Miqdor</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {recentTransactions.map(t => (
                      <tr key={t.id} className="hover:bg-white/40 transition-colors group">
                        <td className="p-6">
                          <div className="font-bold text-zinc-900 group-hover:text-violet-400 transition-colors">{t.itemName}</div>
                          <div className="text-[10px] text-zinc-900/20 mt-1 uppercase tracking-wider font-bold">
                            {t.eventName || 'Noma\'lum'} • {t.createdAt}
                          </div>
                        </td>
                        <td className={`p-6 text-right font-black ${t.type === 'TAKE' ? 'text-rose-400' : 'text-emerald-500'}`}>
                          {t.type === 'TAKE' ? '-' : '+'}{Math.abs(t.quantity)} {t.unit.toLowerCase()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
             </div>
          </div>
        </div>
      </div>

      {/* Full-Screen Month Detail View */}
      {selectedMonth && (
        <div className="fixed inset-0 z-[100] bg-zinc-50 flex flex-col overflow-hidden animate-in fade-in duration-300">
          
          {/* Header */}
          <header className="px-8 py-6 bg-white border-b border-zinc-200 flex justify-between items-center z-10 shrink-0">
            <div className="flex items-center gap-6">
              <button 
                onClick={() => setSelectedMonth(null)}
                className="w-12 h-12 rounded-full border border-zinc-200 flex items-center justify-center text-zinc-400 hover:bg-zinc-100 hover:text-zinc-900 transition-all"
              >
                <X size={24} />
              </button>
              <div>
                <h2 className="text-3xl font-black text-zinc-900 uppercase tracking-tight">{selectedMonth.monthName} Hisoboti</h2>
                <div className="text-zinc-500 text-sm mt-1 flex items-center gap-2 font-medium">
                  <TrendingUp size={14} className="text-brand-500" />
                  <span>Jami {selectedMonth.events.length} ta tadbir o'tkazilgan</span>
                </div>
              </div>
            </div>
            
            <div className="flex items-center gap-8">
              <div className="text-right">
                <p className="text-zinc-400 text-[10px] uppercase font-bold mb-1 tracking-widest">Jami Xarajat</p>
                <p className="text-2xl font-black text-zinc-900" suppressHydrationWarning>{selectedMonth.totalCost.toLocaleString('uz-UZ')} <span className="text-xs text-zinc-400">UZS</span></p>
              </div>
              <div className="text-right pl-8 border-l border-zinc-200">
                <p className="text-zinc-400 text-[10px] uppercase font-bold mb-1 tracking-widest">Impulse Iste'moli</p>
                <p className="text-2xl font-black text-violet-500" suppressHydrationWarning>{selectedMonth.impulseCost.toLocaleString('uz-UZ')} <span className="text-xs text-violet-300">UZS</span></p>
              </div>
            </div>
          </header>

          {/* Sub-header Tabs */}
          <div className="px-8 py-4 bg-white/50 border-b border-zinc-200 shrink-0">
            <div className="max-w-[1600px] mx-auto flex gap-2 p-1 bg-zinc-100 rounded-2xl w-fit">
              <button 
                onClick={() => setModalTab('events')} 
                className={`px-8 py-3 rounded-xl text-sm font-bold transition-all flex items-center gap-2 ${modalTab === 'events' ? 'bg-white shadow-sm text-zinc-900' : 'text-zinc-500 hover:text-zinc-700'}`}
              >
                <List size={18} />
                Tadbirlar ro'yxati
              </button>
              <button 
                onClick={() => setModalTab('products')} 
                className={`px-8 py-3 rounded-xl text-sm font-bold transition-all flex items-center gap-2 ${modalTab === 'products' ? 'bg-white shadow-sm text-zinc-900' : 'text-zinc-500 hover:text-zinc-700'}`}
              >
                <BarChart2 size={18} />
                Mahsulot sarfi tahlili
              </button>
            </div>
          </div>

          {/* Main Content Area */}
          <div className="flex-1 overflow-y-auto bg-zinc-50 p-8 custom-scrollbar">
            <div className="max-w-[1600px] mx-auto">
              
              {modalTab === 'events' ? (
                <div className="max-w-4xl mx-auto space-y-4 pb-20">
                  {selectedMonth.events.map((event, idx) => {
                    const eventKeyInModal = `modal_${event.key}_${idx}`;
                    const isExpanded = expandedEventInModal === eventKeyInModal;
                    
                    return (
                      <div key={eventKeyInModal} className="bg-white rounded-[2rem] border border-zinc-200 overflow-hidden shadow-sm hover:shadow-md transition-shadow">
                        <button 
                          onClick={() => setExpandedEventInModal(isExpanded ? null : eventKeyInModal)}
                          className="w-full p-6 text-left flex justify-between items-center hover:bg-zinc-50 transition-colors"
                        >
                          <div className="flex items-center gap-5">
                            <div className={`w-14 h-14 rounded-2xl flex items-center justify-center ${event.name.toLowerCase().includes('impulse') ? 'bg-violet-50 text-violet-500' : 'bg-brand-50 text-brand-500'}`}>
                              <Calendar size={24} />
                            </div>
                            <div>
                              <h4 className={`text-xl font-bold ${event.name.toLowerCase().includes('impulse') ? 'text-violet-600' : 'text-zinc-900'}`}>
                                {event.name}
                              </h4>
                              <p className="text-sm font-medium text-zinc-400 mt-1">{event.date}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-8">
                            <div className="text-right">
                              <div className="text-2xl font-black text-zinc-900" suppressHydrationWarning>{event.totalCost.toLocaleString('uz-UZ')} UZS</div>
                            </div>
                            <div className="w-10 h-10 rounded-full bg-zinc-100 flex items-center justify-center text-zinc-400">
                              {isExpanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                            </div>
                          </div>
                        </button>
                        
                        {isExpanded && (
                          <div className="p-6 bg-zinc-50 border-t border-zinc-100 animate-in slide-in-from-top-2 duration-300">
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                              {event.items.map((item, i) => (
                                <div key={i} className="flex justify-between items-center p-5 rounded-2xl bg-white border border-zinc-200 shadow-sm">
                                  <div>
                                    <div className="text-sm font-bold text-zinc-900 mb-1">{item.name}</div>
                                    <div className="inline-block px-2 py-0.5 rounded bg-rose-50 text-rose-500 text-xs font-bold">
                                      {netLabel(item)} {item.unit.toLowerCase()}
                                    </div>
                                    <ReturnNote item={item} />
                                  </div>
                                  <div className="text-right text-sm font-black text-emerald-600" suppressHydrationWarning>
                                    {item.cost.toLocaleString('uz-UZ')} <span className="text-[10px] text-emerald-400">UZS</span>
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
              ) : (
                <div className="grid grid-cols-1 xl:grid-cols-3 gap-8 pb-20">
                  
                  {/* Left Col: Chart */}
                  <div className="xl:col-span-2 space-y-8">
                    <div className="bg-white p-8 rounded-[2.5rem] border border-zinc-200 shadow-sm">
                      <h3 className="text-xl font-bold text-zinc-900 mb-8 flex items-center gap-3">
                        <div className="w-2 h-6 bg-brand-500 rounded-full"></div>
                        Top Xarajatlar Grafigi
                      </h3>
                      <div className="h-[400px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={selectedMonth.products.slice(0, 10)}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e4e4e7" />
                            <XAxis 
                              dataKey="name" 
                              axisLine={false}
                              tickLine={false}
                              tick={{ fill: '#a1a1aa', fontSize: 12, fontWeight: 600 }}
                              dy={10}
                            />
                            <YAxis 
                              axisLine={false}
                              tickLine={false}
                              tick={{ fill: '#a1a1aa', fontSize: 12, fontWeight: 600 }}
                              tickFormatter={(value) => `${(value / 1000).toFixed(0)}k`}
                              dx={-10}
                            />
                            <RechartsTooltip 
                              cursor={{ fill: '#f4f4f5' }}
                              contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 25px rgba(0,0,0,0.1)', fontWeight: 'bold' }}
                              formatter={(value: number) => [`${value.toLocaleString('uz-UZ')} UZS`, "Sarflangan"]}
                            />
                            <Bar dataKey="cost" radius={[8, 8, 0, 0]}>
                              {selectedMonth.products.slice(0, 10).map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={index === 0 ? '#6366f1' : index === 1 ? '#8b5cf6' : index === 2 ? '#10b981' : '#cbd5e1'} />
                              ))}
                            </Bar>
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                  </div>

                  {/* Right Col: Table */}
                  <div className="xl:col-span-1">
                    <div className="bg-white rounded-[2.5rem] border border-zinc-200 shadow-sm overflow-hidden flex flex-col h-[520px]">
                      <div className="p-8 border-b border-zinc-100">
                        <h3 className="text-xl font-bold text-zinc-900 flex items-center gap-3">
                          <div className="w-2 h-6 bg-rose-500 rounded-full"></div>
                          Batafsil Ro'yxat
                        </h3>
                      </div>
                      <div className="flex-1 overflow-y-auto custom-scrollbar">
                        <table className="w-full text-left border-collapse">
                          <thead className="bg-zinc-50/80 sticky top-0 z-10 backdrop-blur-md border-b border-zinc-100">
                            <tr>
                              <th className="p-4 pl-8 font-bold text-zinc-400 text-[10px] uppercase tracking-widest">Mahsulot nomi</th>
                              <th className="p-4 pr-8 font-bold text-zinc-400 text-[10px] uppercase tracking-widest text-right">Sarf</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-zinc-50">
                            {selectedMonth.products.map((item, i) => (
                              <tr key={i} className="hover:bg-zinc-50 transition-colors group">
                                <td className="p-4 pl-8">
                                  <div className="font-bold text-sm text-zinc-900 group-hover:text-brand-600 transition-colors">{item.name}</div>
                                  <div className="text-xs font-medium text-rose-500 mt-0.5">
                                    {netLabel(item)} {item.unit.toLowerCase()}
                                  </div>
                                  <ReturnNote item={item} />
                                </td>
                                <td className="p-4 pr-8 text-right">
                                  <div className="font-black text-sm text-zinc-900" suppressHydrationWarning>
                                    {item.cost.toLocaleString('uz-UZ')}
                                  </div>
                                  <div className="text-[10px] font-bold text-zinc-400">UZS</div>
                                </td>
                              </tr>
                            ))}
                            {selectedMonth.products.length === 0 && (
                              <tr>
                                <td colSpan={2} className="p-8 text-center text-zinc-400 font-medium">Bu oyda mahsulot ishlatilmagan</td>
                              </tr>
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>

                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
