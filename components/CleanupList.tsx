'use client'

import React, { useState } from 'react'
import { Trash2, X, AlertTriangle, PackageX, Copy, CheckCircle2 } from 'lucide-react'
import { deleteItem } from '@/app/actions'

export type CleanupItem = {
  id: string
  name: string
  quantity: number
  unit: string
  price: number
  updatedAt: string
  txCount: number
}

export type DuplicateGroup = {
  key: string
  items: CleanupItem[]
}

export default function CleanupList({
  finished,
  duplicates,
}: {
  finished: CleanupItem[]
  duplicates: DuplicateGroup[]
}) {
  const [target, setTarget] = useState<CleanupItem | null>(null)
  const [loading, setLoading] = useState(false)

  const handleDelete = async () => {
    if (!target) return
    setLoading(true)
    try {
      const formData = new FormData()
      formData.append('itemId', target.id)
      const result = await deleteItem(formData)
      if (result.success) {
        setTarget(null)
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

  const totalDupItems = duplicates.reduce((acc, g) => acc + g.items.length, 0)

  return (
    <div className="space-y-8">
      {/* Tugagan mahsulotlar */}
      <section className="glass-card rounded-[2.5rem] overflow-hidden border border-white/60 shadow-2xl">
        <div className="p-8 border-b border-white/60 flex items-center gap-3 bg-white/40">
          <div className="w-10 h-10 rounded-xl bg-rose-500/15 flex items-center justify-center text-rose-500 border border-rose-500/20">
            <PackageX size={20} />
          </div>
          <div>
            <h2 className="font-black text-xl uppercase tracking-tight text-zinc-900">Tugagan mahsulotlar</h2>
            <p className="text-[11px] text-zinc-900/40 font-semibold uppercase tracking-wider mt-0.5">Qoldig'i 0 ga teng</p>
          </div>
          <span className="ml-auto px-4 py-1.5 bg-rose-500/10 rounded-xl text-rose-500 border border-rose-500/20 text-xs font-black uppercase tracking-widest">
            {finished.length} ta
          </span>
        </div>

        {finished.length === 0 ? (
          <div className="p-12 text-center text-zinc-900/30 font-medium flex flex-col items-center gap-3">
            <CheckCircle2 size={32} className="opacity-30" />
            Tugagan mahsulot yo'q
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[560px]">
              <thead className="bg-white/60 border-b border-white/60">
                <tr>
                  <th className="p-5 font-medium text-zinc-900/40 text-xs uppercase tracking-wider">Mahsulot Nomi</th>
                  <th className="p-5 font-medium text-zinc-900/40 text-xs uppercase tracking-wider">Narxi</th>
                  <th className="p-5 font-medium text-zinc-900/40 text-xs uppercase tracking-wider">Tarix</th>
                  <th className="p-5 font-medium text-zinc-900/40 text-xs uppercase tracking-wider text-right">Amal</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/40">
                {finished.map((item) => (
                  <tr key={item.id} className="hover:bg-white/40 transition-colors group">
                    <td className="p-5">
                      <div className="font-bold text-zinc-900/90">{item.name}</div>
                      <div className="text-[10px] text-zinc-900/25 uppercase font-bold mt-1 tracking-wider">
                        Oxirgi o'zgarish: {new Date(item.updatedAt).toLocaleDateString('uz-UZ')}
                      </div>
                    </td>
                    <td className="p-5 text-zinc-900/70 font-medium">{item.price.toLocaleString('uz-UZ')} UZS</td>
                    <td className="p-5 text-zinc-900/40 text-sm font-medium">{item.txCount} ta yozuv</td>
                    <td className="p-5 text-right">
                      <button
                        type="button"
                        onClick={() => setTarget(item)}
                        className="px-4 py-2 rounded-xl bg-rose-500/10 text-rose-500 hover:bg-rose-500/20 transition-all border border-rose-500/20 inline-flex items-center gap-2 text-xs font-bold"
                      >
                        <Trash2 size={14} />
                        O'CHIRISH
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Dublikat mahsulotlar */}
      <section className="glass-card rounded-[2.5rem] overflow-hidden border border-white/60 shadow-2xl">
        <div className="p-8 border-b border-white/60 flex items-center gap-3 bg-white/40">
          <div className="w-10 h-10 rounded-xl bg-amber-500/15 flex items-center justify-center text-amber-500 border border-amber-500/20">
            <Copy size={20} />
          </div>
          <div>
            <h2 className="font-black text-xl uppercase tracking-tight text-zinc-900">Dublikat mahsulotlar</h2>
            <p className="text-[11px] text-zinc-900/40 font-semibold uppercase tracking-wider mt-0.5">Nomi bir xil (katta-kichik harf hisobga olinmaydi)</p>
          </div>
          <span className="ml-auto px-4 py-1.5 bg-amber-500/10 rounded-xl text-amber-600 border border-amber-500/20 text-xs font-black uppercase tracking-widest">
            {duplicates.length} guruh · {totalDupItems} ta
          </span>
        </div>

        {duplicates.length === 0 ? (
          <div className="p-12 text-center text-zinc-900/30 font-medium flex flex-col items-center gap-3">
            <CheckCircle2 size={32} className="opacity-30" />
            Dublikat mahsulot yo'q
          </div>
        ) : (
          <div className="p-6 space-y-5">
            {duplicates.map((group) => (
              <div key={group.key} className="rounded-2xl border border-amber-500/20 bg-amber-500/5 overflow-hidden">
                <div className="px-5 py-3 bg-amber-500/10 border-b border-amber-500/20 flex items-center gap-2">
                  <Copy size={14} className="text-amber-600" />
                  <span className="font-bold text-sm text-zinc-900/80">"{group.items[0].name}"</span>
                  <span className="text-xs text-zinc-900/40 font-semibold">— {group.items.length} ta nusxa</span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse min-w-[560px]">
                    <tbody className="divide-y divide-white/40">
                      {group.items.map((item) => (
                        <tr key={item.id} className="hover:bg-white/40 transition-colors">
                          <td className="p-4">
                            <div className="font-bold text-zinc-900/90">{item.name}</div>
                            <div className="text-[10px] text-zinc-900/25 uppercase font-bold mt-1 tracking-wider">
                              {item.txCount} ta yozuv · {new Date(item.updatedAt).toLocaleDateString('uz-UZ')}
                            </div>
                          </td>
                          <td className="p-4">
                            <span className={`inline-flex items-center justify-center px-3 py-1 rounded-lg text-sm font-black border ${
                              item.quantity > 0
                                ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20'
                                : 'bg-rose-500/10 text-rose-500 border-rose-500/20'
                            }`}>
                              {item.quantity} {item.unit.toLowerCase()}
                            </span>
                          </td>
                          <td className="p-4 text-zinc-900/70 font-medium text-sm">{item.price.toLocaleString('uz-UZ')} UZS</td>
                          <td className="p-4 text-right">
                            <button
                              type="button"
                              onClick={() => setTarget(item)}
                              className="px-4 py-2 rounded-xl bg-rose-500/10 text-rose-500 hover:bg-rose-500/20 transition-all border border-rose-500/20 inline-flex items-center gap-2 text-xs font-bold"
                            >
                              <Trash2 size={14} />
                              O'CHIRISH
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Tasdiqlash modali */}
      {target && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/80 backdrop-blur-md" onClick={() => !loading && setTarget(null)}></div>
          <div className="glass-card w-full max-w-md rounded-[2.5rem] border border-white/60 shadow-2xl relative z-[10000] overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="p-8 border-b border-white/60 flex justify-between items-center bg-white/40">
              <div>
                <h3 className="text-xl font-black text-zinc-900 uppercase tracking-tight">Mahsulotni o'chirish</h3>
                <p className="text-zinc-900/40 text-xs mt-1">{target.name}</p>
              </div>
              <button type="button" onClick={() => !loading && setTarget(null)} className="text-zinc-900/20 hover:text-zinc-900 transition-colors p-2">
                <X size={24} />
              </button>
            </div>

            <div className="p-8 space-y-6">
              <div className="bg-rose-500/10 border border-rose-500/20 p-4 rounded-2xl flex gap-3 items-start">
                <AlertTriangle className="text-rose-500 shrink-0" size={18} />
                <p className="text-[12px] text-rose-900/70 leading-relaxed font-medium">
                  Bu mahsulot butunlay o'chiriladi. Uning <b>{target.txCount} ta</b> tranzaksiya (kirim/chiqim) tarixi ham o'chib ketadi. Bu amalni orqaga qaytarib bo'lmaydi.
                </p>
              </div>

              <div className="flex gap-4">
                <button
                  type="button"
                  onClick={() => setTarget(null)}
                  disabled={loading}
                  className="flex-1 py-4 rounded-2xl bg-white/40 text-zinc-900/50 font-bold hover:bg-white/60 transition-all uppercase text-xs tracking-widest disabled:opacity-50"
                >
                  Bekor qilish
                </button>
                <button
                  type="button"
                  onClick={handleDelete}
                  disabled={loading}
                  className="flex-1 py-4 rounded-2xl bg-rose-500 text-white font-black hover:bg-rose-600 transition-all shadow-lg shadow-rose-500/20 uppercase text-xs tracking-widest disabled:opacity-50 inline-flex items-center justify-center gap-2"
                >
                  <Trash2 size={14} />
                  {loading ? "O'CHIRILMOQDA..." : "O'CHIRISH"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
