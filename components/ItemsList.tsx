'use client'

import React, { useState, useEffect } from 'react'
import { Edit3, Check, X, AlertTriangle } from 'lucide-react'
import { adjustStock } from '@/app/actions'

type Item = {
  id: string
  name: string
  price: number
  quantity: number
  unit: string
  updatedAt: any // Can be string or Date after serialization
}

export default function ItemsList({ initialItems }: { initialItems: Item[] }) {
  const [editingItem, setEditingItem] = useState<Item | null>(null)
  const [newQuantity, setNewQuantity] = useState<string>('')
  const [reason, setReason] = useState<string>('Inventarizatsiya tahriri')
  const [loading, setLoading] = useState(false)
  const [isMounted, setIsMounted] = useState(false)

  useEffect(() => {
    setIsMounted(true)
  }, [])

  if (!isMounted) return null

  const handleAdjust = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editingItem) return
    
    setLoading(true)
    try {
      const formData = new FormData()
      formData.append('itemId', editingItem.id)
      formData.append('quantity', newQuantity)
      formData.append('reason', reason)

      const result = await adjustStock(formData)
      if (result.success) {
        setEditingItem(null)
        window.location.reload()
      } else {
        alert(result.error || "Xatolik yuz berdi")
      }
    } catch (err) {
      alert("Aloqa xatosi")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex-1 overflow-x-auto p-0">
      <table className="w-full text-left border-collapse min-w-[600px]">
        <thead className="bg-dark-900/80 border-b border-white/5">
          <tr>
            <th className="p-5 font-medium text-white/40 text-xs uppercase tracking-wider">#</th>
            <th className="p-5 font-medium text-white/40 text-xs uppercase tracking-wider">Mahsulot Nomi</th>
            <th className="p-5 font-medium text-white/40 text-xs uppercase tracking-wider">Narxi</th>
            <th className="p-5 font-medium text-white/40 text-xs uppercase tracking-wider">Hozirgi Qoldiq</th>
            <th className="p-5 font-medium text-white/40 text-xs uppercase tracking-wider text-right">Amal</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-white/5">
          {initialItems.map((item, idx) => (
            <tr key={item.id} className="hover:bg-white/[0.02] transition-colors group">
              <td className="p-5 text-white/30 text-sm">{idx + 1}</td>
              <td className="p-5">
                <div className="font-bold text-white/90 group-hover:text-brand-400 transition-colors">{item.name}</div>
                <div className="text-[10px] text-white/20 uppercase font-bold mt-1 tracking-wider" suppressHydrationWarning>
                  Oxirgi o'zgarish: {new Date(item.updatedAt).toLocaleDateString('uz-UZ')}
                </div>
              </td>
              <td className="p-5">
                <span className="text-white/80 font-medium" suppressHydrationWarning>{item.price.toLocaleString('uz-UZ')} UZS</span>
              </td>
              <td className="p-5">
                <span className={`inline-flex items-center justify-center px-3 py-1 rounded-lg text-sm font-black border ${
                  item.quantity > 50 
                    ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' 
                    : item.quantity > 10
                    ? 'bg-brand-500/10 text-brand-400 border-brand-500/20'
                    : 'bg-rose-500/10 text-rose-400 border-rose-500/20'
                }`}>
                  {item.quantity} {item.unit.toLowerCase()}
                </span>
              </td>
              <td className="p-5 text-right">
                <button 
                  type="button"
                  onClick={(e) => {
                    e.preventDefault()
                    e.stopPropagation()
                    setEditingItem(item)
                    setNewQuantity(item.quantity.toString())
                  }}
                  className="px-4 py-2 rounded-xl bg-white/5 text-white/60 hover:bg-brand-500/20 hover:text-brand-400 transition-all border border-white/5 inline-flex items-center gap-2 text-xs font-bold relative z-10"
                >
                  <Edit3 size={14} />
                  TUZATISH
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Adjustment Modal */}
      {editingItem && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/80 backdrop-blur-md" onClick={() => setEditingItem(null)}></div>
          <div className="glass-card w-full max-w-md rounded-[2.5rem] border border-white/10 shadow-2xl relative z-[10000] overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="p-8 border-b border-white/5 flex justify-between items-center bg-white/[0.02]">
              <div>
                <h3 className="text-xl font-black text-white uppercase tracking-tight">Qoldiqni tuzatish</h3>
                <p className="text-white/40 text-xs mt-1">{editingItem.name}</p>
              </div>
              <button type="button" onClick={() => setEditingItem(null)} className="text-white/20 hover:text-white transition-colors p-2">
                <X size={24} />
              </button>
            </div>
            
            <form onSubmit={handleAdjust} className="p-8 space-y-6">
              <div className="bg-amber-500/10 border border-amber-500/20 p-4 rounded-2xl flex gap-3 items-start">
                <AlertTriangle className="text-amber-500 shrink-0" size={18} />
                <p className="text-[11px] text-amber-200/80 leading-relaxed font-medium">
                  Eslatma: Qoldiqni qo'lda o'zgartirish faqat bazadagi son skladdagi bilan mos kelmasa qilinadi.
                </p>
              </div>

              <div>
                <label className="block text-white/40 text-[10px] font-bold uppercase tracking-widest mb-2 ml-1">Yangi Qoldiq Soni</label>
                <div className="relative">
                  <input 
                    type="number" 
                    value={newQuantity}
                    onChange={(e) => setNewQuantity(e.target.value)}
                    required
                    autoFocus
                    className="w-full bg-white/10 border border-white/20 rounded-2xl py-4 px-6 text-white font-black focus:outline-none focus:ring-2 focus:ring-brand-500/50 transition-all text-2xl"
                  />
                  <span className="absolute right-6 top-1/2 -translate-y-1/2 text-white/20 font-bold uppercase text-xs">{editingItem.unit}</span>
                </div>
              </div>

              <div>
                <label className="block text-white/40 text-[10px] font-bold uppercase tracking-widest mb-2 ml-1">Sabab</label>
                <input 
                  type="text" 
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 px-6 text-white text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/50"
                />
              </div>

              <div className="flex gap-4 pt-2">
                <button 
                  type="button"
                  onClick={() => setEditingItem(null)}
                  className="flex-1 py-4 rounded-2xl bg-white/5 text-white/40 font-bold hover:bg-white/10 transition-all uppercase text-xs tracking-widest"
                >
                  Bekor qilish
                </button>
                <button 
                  type="submit"
                  disabled={loading}
                  className="flex-1 py-4 rounded-2xl bg-brand-500 text-black font-black hover:bg-brand-400 transition-all shadow-lg shadow-brand-500/20 uppercase text-xs tracking-widest disabled:opacity-50"
                >
                  {loading ? 'SAQLANMOQDA...' : 'SAQLASH'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
