'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Droplet, Coffee, Search, RefreshCw, CheckCircle2, Clock, Lock, AlertTriangle } from 'lucide-react'
import { setItemErpCategory, syncErpNow } from '@/app/actions'

export type MapItem = { id: string; name: string; erpCategory: string | null }
export type EventRow = {
  id: number
  name: string
  date: string
  water: number
  coffee: number
  state: 'ok' | 'pending' | 'locked' | 'notfound' | 'error'
  error: string
  notes: string[]
}

const som = (n: number) => Math.round(n).toLocaleString('ru-RU').replace(/,/g, ' ')
const TASHKENT_MS = 5 * 60 * 60 * 1000
const dmy = (iso: string) => {
  const d = new Date(new Date(iso).getTime() + TASHKENT_MS).toISOString()
  return `${d.slice(8, 10)}.${d.slice(5, 7)}.${d.slice(0, 4)}`
}

const OPTIONS: { key: string | null; label: string }[] = [
  { key: null, label: "Yo'q" },
  { key: 'water', label: 'Suv' },
  { key: 'coffee', label: 'Kofe' },
]

const STATE: Record<EventRow['state'], { label: string; cls: string; Icon: typeof CheckCircle2 }> = {
  ok: { label: "ERP'da", cls: 'bg-emerald-100 text-emerald-800', Icon: CheckCircle2 },
  pending: { label: 'Yuborilmoqda', cls: 'bg-amber-100 text-amber-800', Icon: Clock },
  locked: { label: 'Oy yopilgan', cls: 'bg-zinc-200 text-zinc-700', Icon: Lock },
  notfound: { label: "ERP'da topilmadi", cls: 'bg-rose-100 text-rose-700', Icon: AlertTriangle },
  error: { label: 'Xato', cls: 'bg-rose-100 text-rose-700', Icon: AlertTriangle },
}

export default function RentabellikClient({ items, events, erpOn, days }: {
  items: MapItem[]
  events: EventRow[]
  erpOn: boolean
  days: number
}) {
  const router = useRouter()
  const [cats, setCats] = useState<Record<string, string | null>>(
    () => Object.fromEntries(items.map(i => [i.id, i.erpCategory])))
  const [search, setSearch] = useState('')
  const [savingId, setSavingId] = useState<string | null>(null)
  const [syncing, setSyncing] = useState(false)
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null)

  const choose = async (id: string, key: string | null) => {
    const before = cats[id]
    if (before === key) return
    setCats(c => ({ ...c, [id]: key }))
    setSavingId(id)
    const res = await setItemErpCategory(id, key)
    setSavingId(null)
    if (res.error) {
      setCats(c => ({ ...c, [id]: before }))
      setMsg({ text: res.error, ok: false })
      return
    }
    // Fonda yuborish tugashini kutib, jadvalni yangilaymiz
    setTimeout(() => router.refresh(), 1500)
  }

  const syncNow = async () => {
    setSyncing(true)
    setMsg(null)
    const res = await syncErpNow()
    setSyncing(false)
    if (res.error) setMsg({ text: res.error, ok: false })
    else setMsg({
      text: res.sent || res.failed
        ? `${res.sent} ta tadbir yuborildi${res.failed ? `, ${res.failed} tasida muammo` : ''}`
        : "Hammasi ERP bilan bir xil — yuboriladigan narsa yo'q",
      ok: !res.failed,
    })
    router.refresh()
  }

  const q = search.trim().toLowerCase()
  const mapped = items.filter(i => cats[i.id])
  const shown = items
    .filter(i => !q || i.name.toLowerCase().includes(q))
    .sort((a, b) => Number(!!cats[b.id]) - Number(!!cats[a.id]) || a.name.localeCompare(b.name))

  const totalWater = events.reduce((s, e) => s + e.water, 0)
  const totalCoffee = events.reduce((s, e) => s + e.coffee, 0)

  return (
    <div className="flex flex-col gap-8">
      {!erpOn && (
        <div className="rounded-2xl bg-amber-50 border border-amber-200 px-5 py-4 text-sm font-medium text-amber-900">
          ERP ulanmagan: Railway'da <b>ERP_URL</b> va <b>ERP_API_KEY</b> sozlanmagan — xarajatlar yuborilmaydi.
        </div>
      )}

      {/* ── Mahsulotlar ── */}
      <section className="glass-card rounded-2xl overflow-hidden border border-white/60">
        <div className="px-5 py-4 bg-white/40 border-b border-white/60 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold text-zinc-900">Qaysi mahsulot suv, qaysi biri kofe?</h2>
            <p className="text-xs font-medium text-zinc-900/60">
              Belgilangan: {mapped.length} ta
              {mapped.length > 0 && ` — ${mapped.map(i => i.name).join(', ')}`}
            </p>
          </div>
          <label className="relative">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Mahsulot qidirish"
              className="w-56 rounded-xl border border-zinc-200 bg-white/70 py-2 pl-9 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/30"
            />
          </label>
        </div>
        <ul className="divide-y divide-zinc-900/5 max-h-[420px] overflow-auto">
          {shown.map(i => (
            <li key={i.id} className="flex items-center justify-between gap-3 px-5 py-2.5">
              <span className="flex items-center gap-2 font-semibold text-zinc-900 min-w-0">
                {cats[i.id] === 'water' && <Droplet size={15} className="text-sky-500 shrink-0" />}
                {cats[i.id] === 'coffee' && <Coffee size={15} className="text-amber-800 shrink-0" />}
                <span className="truncate">{i.name}</span>
              </span>
              <div className={`flex bg-zinc-100 rounded-lg p-0.5 text-xs font-bold shrink-0 ${savingId === i.id ? 'opacity-60' : ''}`}>
                {OPTIONS.map(o => (
                  <button
                    key={o.label}
                    onClick={() => choose(i.id, o.key)}
                    disabled={savingId === i.id}
                    aria-pressed={cats[i.id] === o.key}
                    aria-label={`${i.name}: ${o.label}`}
                    className={`px-3 py-1 rounded-md ${cats[i.id] === o.key
                      ? o.key === 'water' ? 'bg-sky-500 text-white' : o.key === 'coffee' ? 'bg-amber-800 text-white' : 'bg-white shadow-sm text-zinc-900'
                      : 'text-zinc-500'}`}
                  >
                    {o.label}
                  </button>
                ))}
              </div>
            </li>
          ))}
          {shown.length === 0 && <li className="px-5 py-4 text-sm text-zinc-900/50">Topilmadi</li>}
        </ul>
      </section>

      {/* ── Tadbirlar ── */}
      <section className="glass-card rounded-2xl overflow-hidden border border-white/60">
        <div className="px-5 py-4 bg-white/40 border-b border-white/60 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold text-zinc-900">Tadbirlar — oxirgi {days} kun</h2>
            <p className="text-xs font-medium text-zinc-900/60">
              Suv: {som(totalWater)} so'm · Kofe: {som(totalCoffee)} so'm · avtomatik har 5 daqiqada yuboriladi
            </p>
          </div>
          <button
            onClick={syncNow}
            disabled={syncing || !erpOn}
            className="flex items-center gap-2 px-4 py-2 rounded-xl font-bold text-white bg-brand-500 hover:bg-brand-600 disabled:opacity-40"
          >
            <RefreshCw size={15} className={syncing ? 'animate-spin' : ''} /> Hozir yuborish
          </button>
        </div>
        {msg && (
          <div className={`px-5 py-2.5 text-sm font-semibold ${msg.ok ? 'text-emerald-700' : 'text-rose-600'}`}>{msg.text}</div>
        )}
        {events.length === 0 ? (
          <div className="px-5 py-6 text-sm text-zinc-900/60">
            {mapped.length === 0
              ? "Avval yuqorida suv va kofe mahsulotlarini belgilang."
              : "Hali tadbirlarga suv yoki kofe chiqim qilinmagan."}
          </div>
        ) : (
          <ul className="divide-y divide-zinc-900/5">
            {events.map(ev => {
              const st = STATE[ev.state]
              return (
                <li key={ev.id} className="px-5 py-3 flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="font-bold text-zinc-900">{ev.name}</div>
                    <div className="text-xs font-medium text-zinc-900/60">
                      {dmy(ev.date)}{ev.notes.length > 0 && ` · ${ev.notes.map(n => n.replace(/^Sklad: /, '')).join(' · ')}`}
                    </div>
                    {(ev.state === 'error' || ev.state === 'notfound' || ev.state === 'locked') && ev.error && (
                      <div className="text-xs font-medium text-rose-600 mt-0.5">{ev.error}</div>
                    )}
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <div className="text-right text-sm font-bold tabular-nums">
                      {ev.water > 0 && <div className="text-sky-600">Suv {som(ev.water)}</div>}
                      {ev.coffee > 0 && <div className="text-amber-800">Kofe {som(ev.coffee)}</div>}
                      {ev.water === 0 && ev.coffee === 0 && <div className="text-zinc-400">0</div>}
                    </div>
                    <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold ${st.cls}`}>
                      <st.Icon size={12} /> {st.label}
                    </span>
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </section>
    </div>
  )
}
