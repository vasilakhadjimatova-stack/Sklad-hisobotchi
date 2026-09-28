'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { CheckCircle2, ArrowRight } from 'lucide-react'
import { repriceTakes } from '@/app/actions'
import type { PriceGroup } from '@/lib/reprice'

export type RepriceItem = {
  id: string
  name: string
  unit: string
  price: number
  groups: PriceGroup[]
}

const som = (n: number) => Math.round(n).toLocaleString('ru-RU').replace(/,/g, ' ')
const dmy = (d: string) => `${d.slice(8, 10)}.${d.slice(5, 7)}.${d.slice(0, 4)}`

export default function RepriceList({ items }: { items: RepriceItem[] }) {
  const router = useRouter()
  // mahsulot id → belgilangan 1 dona narxlari
  const [picked, setPicked] = useState<Record<string, number[]>>({})
  const [busy, setBusy] = useState<string | null>(null)
  const [msg, setMsg] = useState<{ id: string; text: string; ok: boolean } | null>(null)

  if (items.length === 0) {
    return (
      <div className="glass-card rounded-2xl p-8 flex items-center gap-3 text-emerald-700 font-semibold">
        <CheckCircle2 size={22} /> Hamma chiqimlar mahsulotlarning hozirgi narxida yozilgan.
      </div>
    )
  }

  const toggle = (id: string, unitPrice: number) => {
    setPicked(prev => {
      const cur = prev[id] ?? []
      return { ...prev, [id]: cur.includes(unitPrice) ? cur.filter(p => p !== unitPrice) : [...cur, unitPrice] }
    })
  }

  const apply = async (it: RepriceItem) => {
    const prices = picked[it.id] ?? []
    const groups = it.groups.filter(g => prices.includes(g.unitPrice))
    if (groups.length === 0) return
    const n = groups.reduce((s, g) => s + g.count, 0)
    const before = groups.reduce((s, g) => s + g.oldTotal, 0)
    const after = groups.reduce((s, g) => s + g.newTotal, 0)
    if (!window.confirm(
      `${it.name}: ${n} ta chiqim ${som(it.price)} so'm narxga o'tkaziladi.\n` +
      `Jami summa: ${som(before)} → ${som(after)} so'm.\n\nDavom etasizmi?`
    )) return

    setBusy(it.id)
    setMsg(null)
    const res = await repriceTakes(it.id, prices)
    setBusy(null)
    if (res.error) {
      setMsg({ id: it.id, text: res.error, ok: false })
      return
    }
    setPicked(prev => ({ ...prev, [it.id]: [] }))
    setMsg({ id: it.id, text: `${res.count} ta chiqim tuzatildi: ${som(res.before ?? 0)} → ${som(res.after ?? 0)} so'm`, ok: true })
    router.refresh()
  }

  const totalCount = items.reduce((s, i) => s + i.groups.reduce((a, g) => a + g.count, 0), 0)

  return (
    <div className="flex flex-col gap-5">
      <div className="text-sm font-semibold text-zinc-900/60">
        {items.length} ta mahsulotda hozirgi narxdan boshqa narxda yozilgan {totalCount} ta chiqim bor.
      </div>

      {items.map(it => {
        const sel = picked[it.id] ?? []
        const selGroups = it.groups.filter(g => sel.includes(g.unitPrice))
        const diff = selGroups.reduce((s, g) => s + g.newTotal - g.oldTotal, 0)
        return (
          <section key={it.id} className="glass-card rounded-2xl overflow-hidden border border-white/60">
            <div className="px-5 py-4 bg-white/40 border-b border-white/60 flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="text-lg font-bold text-zinc-900">{it.name}</h2>
              <div className="text-sm font-semibold text-zinc-900/70">
                Hozirgi narx: <span className="text-zinc-900 font-bold">{som(it.price)} so'm</span> / 1 {it.unit}
              </div>
            </div>

            <ul className="divide-y divide-zinc-900/5">
              {it.groups.map(g => {
                const on = sel.includes(g.unitPrice)
                const d = g.newTotal - g.oldTotal
                return (
                  <li key={g.unitPrice}>
                    <label className={`flex items-start gap-3 px-5 py-3.5 cursor-pointer ${on ? 'bg-brand-500/5' : 'hover:bg-white/40'}`}>
                      <input
                        type="checkbox"
                        checked={on}
                        onChange={() => toggle(it.id, g.unitPrice)}
                        className="mt-1 w-4 h-4 accent-brand-500"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 font-bold text-zinc-900">
                          <span>{som(g.unitPrice)} so'm</span>
                          <ArrowRight size={14} className="text-zinc-900/40" />
                          <span className="text-brand-600">{som(it.price)} so'm</span>
                          <span className="text-sm font-semibold text-zinc-900/60">· {g.count} ta chiqim</span>
                        </div>
                        <div className="text-xs font-medium text-zinc-900/60 mt-0.5">
                          {g.from === g.to ? dmy(g.from) : `${dmy(g.from)} – ${dmy(g.to)}`}
                          {g.events.length > 0 && (
                            <> · {g.events.slice(0, 3).join(', ')}{g.events.length > 3 ? ` va yana ${g.events.length - 3} ta` : ''}</>
                          )}
                        </div>
                      </div>
                      <div className="text-right text-xs font-semibold tabular-nums shrink-0">
                        <div className="text-zinc-900/60">{som(g.oldTotal)} → {som(g.newTotal)}</div>
                        <div className={d > 0 ? 'text-rose-600' : 'text-emerald-600'}>
                          {d > 0 ? '+' : '−'}{som(Math.abs(d))} so'm
                        </div>
                      </div>
                    </label>
                  </li>
                )
              })}
            </ul>

            <div className="px-5 py-3.5 bg-white/30 border-t border-white/60 flex flex-wrap items-center justify-between gap-3">
              <div className="text-sm font-medium">
                {msg?.id === it.id ? (
                  <span className={msg.ok ? 'text-emerald-700' : 'text-rose-600'}>{msg.text}</span>
                ) : selGroups.length > 0 ? (
                  <span className="text-zinc-900/70">
                    Tanlandi: {selGroups.reduce((s, g) => s + g.count, 0)} ta chiqim, farq {diff > 0 ? '+' : '−'}{som(Math.abs(diff))} so'm
                  </span>
                ) : (
                  <span className="text-zinc-900/40">Noto'g'ri narxdagi qatorlarni belgilang</span>
                )}
              </div>
              <button
                onClick={() => apply(it)}
                disabled={selGroups.length === 0 || busy !== null}
                className="px-5 py-2.5 rounded-xl font-bold text-white bg-brand-500 hover:bg-brand-600 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {busy === it.id ? 'Tuzatilmoqda...' : `Hozirgi narxga o'tkazish`}
              </button>
            </div>
          </section>
        )
      })}
    </div>
  )
}
