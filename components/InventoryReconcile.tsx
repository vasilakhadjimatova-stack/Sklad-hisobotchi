'use client'

import { useState, useMemo, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Search, Save, ClipboardCheck, AlertTriangle, Check, Filter, History, ChevronDown, X } from 'lucide-react'

type Row = {
  id: string
  name: string
  unit: string
  packSize: number
  packUnit: string
  qty: number
  used: number
  added: number
}

type Adjustment = {
  id: string
  name: string
  unit: string
  delta: number
  date: string
  time: string
  by: string
  price: number
  qty: number
}

const UZ_MONTHS = ['Yanvar', 'Fevral', 'Mart', 'Aprel', 'May', 'Iyun', 'Iyul', 'Avgust', 'Sentabr', 'Oktabr', 'Noyabr', 'Dekabr']

const som = (n: number) => `${Math.round(n).toLocaleString('ru-RU')} so'm`

export default function InventoryReconcile({ rows, month, adjustments }: { rows: Row[]; month: string; adjustments: Adjustment[] }) {
  const router = useRouter()
  const [counts, setCounts] = useState<Record<string, string>>({})
  const [search, setSearch] = useState('')
  const [onlyMismatch, setOnlyMismatch] = useState(false)
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState('')
  const [corrected, setCorrected] = useState<any[]>([])
  const [histOpen, setHistOpen] = useState(true)
  const [selected, setSelected] = useState<Adjustment | null>(null)
  const [summaryOpen, setSummaryOpen] = useState(false)

  const monthLabel = (() => {
    const [yy, mm] = month.split('-').map(Number)
    return `${UZ_MONTHS[(mm || 1) - 1] || ''} ${yy || ''}`.trim()
  })()

  useEffect(() => {
    if (!selected && !summaryOpen) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') { setSelected(null); setSummaryOpen(false) } }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [selected, summaryOpen])

  const diffOf = (r: Row): number | null => {
    const v = counts[r.id]
    if (v === undefined || v.trim() === '') return null
    const p = parseInt(v, 10)
    if (isNaN(p)) return null
    return p - r.qty
  }

  const stats = useMemo(() => {
    let counted = 0, mismatch = 0, net = 0
    for (const r of rows) {
      const d = diffOf(r)
      if (d !== null) {
        counted++
        if (d !== 0) { mismatch++; net += d }
      }
    }
    return { counted, mismatch, net }
  }, [counts, rows])

  // O'tgan tuzatishlar xulosasi (shu oy) — sahifa bo'sh ko'rinmasligi uchun
  const adjSummary = useMemo(() => {
    let net = 0, value = 0
    for (const a of adjustments) { net += a.delta; value += a.delta * a.price }
    return { count: adjustments.length, net, value, last: adjustments[0] || null }
  }, [adjustments])

  // Modal uchun: qiymat (delta×narx) bo'yicha eng kattadan saralangan
  const adjByImpact = useMemo(
    () => [...adjustments].sort((a, b) => Math.abs(b.delta * b.price) - Math.abs(a.delta * a.price)),
    [adjustments]
  )

  const visible = rows.filter(r => {
    if (search && !r.name.toLowerCase().includes(search.toLowerCase())) return false
    if (onlyMismatch) { const d = diffOf(r); return d !== null && d !== 0 }
    return true
  })

  const save = async () => {
    const payload = rows
      .map(r => ({ itemId: r.id, raw: counts[r.id] }))
      .filter(c => c.raw !== undefined && c.raw.trim() !== '')
      .map(c => ({ itemId: c.itemId, physical: parseInt(c.raw, 10) }))
      .filter(c => Number.isFinite(c.physical) && c.physical >= 0)

    if (payload.length === 0) { setMsg('Avval haqiqiy sanoqni kiriting.'); return }
    if (!confirm(`${payload.length} ta mahsulot bo'yicha qoldiq haqiqiy songa to'g'rilanadimi? (Farqlar ADJUST sifatida yoziladi)`)) return

    setSaving(true); setMsg('')
    try {
      const res = await fetch('/api/inventory/reconcile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ counts: payload }),
      })
      const d = await res.json()
      if (d.success) {
        setMsg('')
        setCorrected(Array.isArray(d.details) ? d.details : [])
        setCounts({})
        router.refresh()
      } else setMsg(d.error || 'Xato')
    } catch {
      setMsg("Server bilan aloqa yo'q.")
    }
    setSaving(false)
  }

  return (
    <div className="p-6 md:p-8 max-w-[1400px] mx-auto min-h-full">
      <header className="mb-8 flex flex-col md:flex-row md:justify-between md:items-end gap-4">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full glass border border-brand-500/30 text-brand-500 text-xs font-semibold mb-3">
            <ClipboardCheck size={14} /> OYLIK HISOB
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-zinc-900">Inventarizatsiya</h1>
          <p className="text-zinc-500 text-sm mt-1">Haqiqiy sanoqni kiriting — qoldiq bilan solishtirib, mos kelmasa to'g'rilanadi.</p>
        </div>
        <div className="flex items-center gap-2">
          <label className="text-sm font-medium text-zinc-500">Oy:</label>
          <input
            type="month"
            value={month}
            onChange={e => e.target.value && router.push(`/inventarizatsiya?month=${e.target.value}`)}
            className="glass-card px-3 py-2 rounded-xl text-sm font-bold text-zinc-900 border border-white/60 focus:outline-none focus:ring-2 focus:ring-brand-500/40"
          />
        </div>
      </header>

      {/* Xulosa kartalari */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <div className="glass-card p-5 rounded-2xl">
          <p className="text-zinc-500 text-xs font-medium mb-1">Jami mahsulot</p>
          <h3 className="text-2xl font-bold text-zinc-900">{rows.length}</h3>
        </div>
        <div className="glass-card p-5 rounded-2xl">
          <p className="text-zinc-500 text-xs font-medium mb-1">Sanab chiqilgan</p>
          <h3 className="text-2xl font-bold text-brand-500">{stats.counted}</h3>
        </div>
        <div className="glass-card p-5 rounded-2xl">
          <p className="text-zinc-500 text-xs font-medium mb-1">Mos kelmagan</p>
          <h3 className="text-2xl font-bold text-rose-500">{stats.mismatch}</h3>
        </div>
        <div className="glass-card p-5 rounded-2xl">
          <p className="text-zinc-500 text-xs font-medium mb-1">Net farq</p>
          <h3 className={`text-2xl font-bold ${stats.net < 0 ? 'text-rose-500' : stats.net > 0 ? 'text-emerald-500' : 'text-zinc-900'}`}>
            {stats.net > 0 ? '+' : ''}{stats.net}
          </h3>
        </div>
      </div>

      {/* O'tgan tuzatishlar xulosasi (shu oy) — bosilsa batafsil modal */}
      {adjustments.length > 0 && (
        <button
          onClick={() => setSummaryOpen(true)}
          className="-mt-4 mb-8 w-full text-left glass-card border border-brand-500/20 rounded-2xl px-5 py-3.5 flex flex-wrap items-center gap-x-6 gap-y-1.5 text-sm hover:border-brand-500/40 hover:bg-white/40 transition-colors"
        >
          <span className="flex items-center gap-2 font-bold text-zinc-700">
            <History size={16} className="text-brand-500" /> {monthLabel}da tuzatildi
          </span>
          <span className="text-zinc-500">Mahsulot: <b className="text-zinc-900 tabular-nums">{adjSummary.count}</b></span>
          <span className="text-zinc-500">Jami o'zgarish: <b className={`tabular-nums ${adjSummary.net < 0 ? 'text-rose-500' : adjSummary.net > 0 ? 'text-amber-500' : 'text-zinc-900'}`}>{adjSummary.net > 0 ? '+' : ''}{adjSummary.net}</b></span>
          <span className="text-zinc-500">Qiymat: <b className={`tabular-nums ${adjSummary.value < 0 ? 'text-rose-500' : adjSummary.value > 0 ? 'text-emerald-600' : 'text-zinc-900'}`}>{adjSummary.value > 0 ? '+' : ''}{som(adjSummary.value)}</b></span>
          {adjSummary.last && (
            <span className="text-zinc-400">oxirgisi: {adjSummary.last.date} {adjSummary.last.time}</span>
          )}
          <span className="md:ml-auto flex items-center gap-1 text-brand-600 font-semibold shrink-0">
            Batafsil <ChevronDown size={15} className="-rotate-90" />
          </span>
        </button>
      )}

      {/* Boshqaruv */}
      <div className="flex flex-col md:flex-row gap-3 mb-5 items-stretch md:items-center">
        <div className="relative flex-1">
          <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Mahsulot qidirish..."
            className="w-full glass-card border border-white/60 rounded-xl py-2.5 pl-11 pr-4 text-sm font-medium text-zinc-900 placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-brand-500/40"
          />
        </div>
        <button
          onClick={() => setOnlyMismatch(v => !v)}
          className={`px-4 py-2.5 rounded-xl text-sm font-bold flex items-center gap-2 border transition-all ${onlyMismatch ? 'bg-rose-500 text-white border-rose-500' : 'glass-card text-zinc-600 border-white/60'}`}
        >
          <Filter size={16} /> Faqat farqlilar
        </button>
        <button
          onClick={save}
          disabled={saving || stats.counted === 0}
          className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-brand-500 to-violet-500 text-white font-bold text-sm flex items-center justify-center gap-2 disabled:opacity-50 active:scale-[0.98] transition-all shadow-[0_8px_20px_rgba(99,102,241,0.3)]"
        >
          <Save size={16} /> {saving ? 'Saqlanmoqda...' : `Tuzatish (${stats.mismatch})`}
        </button>
      </div>

      {msg && (
        <div className="mb-4 text-sm font-medium text-zinc-700 glass-card border border-white/60 rounded-xl px-4 py-3">{msg}</div>
      )}

      {corrected.length > 0 && (
        <div className="mb-5 glass-card border border-emerald-500/30 rounded-2xl p-5">
          <div className="flex items-center justify-between mb-3">
            <div className="font-bold text-emerald-600 text-sm flex items-center gap-2">
              <Check size={16} /> Hozir tuzatildi ({corrected.length})
            </div>
            <button onClick={() => setCorrected([])} className="text-xs text-zinc-400 hover:text-zinc-600 font-medium">yashirish</button>
          </div>
          <div className="space-y-1.5">
            {corrected.map((c, i) => (
              <div key={i} className="flex justify-between items-center text-sm border-b border-white/40 last:border-0 pb-1.5 last:pb-0">
                <span className="font-medium text-zinc-800 truncate pr-3">{c.name}</span>
                <span className="tabular-nums shrink-0">
                  <span className="text-zinc-400">{c.old}</span>
                  <span className="mx-1.5 text-zinc-300">→</span>
                  <span className="font-bold text-zinc-900">{c.new}</span>
                  <span className={`ml-2 font-bold ${c.delta < 0 ? 'text-rose-500' : 'text-amber-500'}`}>
                    ({c.delta > 0 ? '+' : ''}{c.delta})
                  </span>
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {adjustments.length > 0 && (
        <div className="mb-5 glass-card border border-white/60 rounded-2xl overflow-hidden">
          <button
            onClick={() => setHistOpen(o => !o)}
            className="w-full flex items-center justify-between px-5 py-3.5 hover:bg-white/40 transition-colors"
          >
            <div className="font-bold text-zinc-700 text-sm flex items-center gap-2">
              <History size={16} className="text-brand-500" /> Tuzatishlar tarixi · {monthLabel} ({adjustments.length})
            </div>
            <ChevronDown size={18} className={`text-zinc-400 transition-transform ${histOpen ? 'rotate-180' : ''}`} />
          </button>
          {histOpen && (
            <div className="px-5 pb-4 max-h-72 overflow-y-auto">
              <div className="space-y-1">
                {adjustments.map(a => (
                  <button
                    key={a.id}
                    onClick={() => setSelected(a)}
                    className="w-full flex justify-between items-center gap-3 text-sm border-b border-white/40 last:border-0 py-2 px-2 -mx-2 text-left rounded-lg hover:bg-white/50 transition-colors"
                  >
                    <div className="min-w-0">
                      <div className="font-medium text-zinc-800 truncate">{a.name}</div>
                      <div className="text-xs text-zinc-400">{a.date}{a.by ? ` · ${a.by}` : ''}</div>
                    </div>
                    <span className="flex items-center gap-1.5 shrink-0">
                      <span className={`font-bold tabular-nums ${a.delta < 0 ? 'text-rose-500' : 'text-amber-500'}`}>
                        {a.delta > 0 ? '+' : ''}{a.delta} <span className="text-zinc-400 font-normal text-xs">{a.unit}</span>
                      </span>
                      <ChevronDown size={15} className="-rotate-90 text-zinc-300" />
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Jadval */}
      <div className="glass-card rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead className="sticky top-0 backdrop-blur-md bg-white/80 border-b border-white/60">
              <tr>
                <th className="p-4 font-medium text-zinc-900/40 text-xs uppercase tracking-wider">Mahsulot</th>
                <th className="p-4 font-medium text-zinc-900/40 text-xs uppercase tracking-wider text-right">Oyda ishlatilgan</th>
                <th className="p-4 font-medium text-zinc-900/40 text-xs uppercase tracking-wider text-right">Omborda (hisob)</th>
                <th className="p-4 font-medium text-zinc-900/40 text-xs uppercase tracking-wider text-right w-40">Haqiqiy sanoq</th>
                <th className="p-4 font-medium text-zinc-900/40 text-xs uppercase tracking-wider text-right w-28">Farq</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/40">
              {visible.length === 0 ? (
                <tr><td colSpan={5} className="p-10 text-center text-zinc-400 font-medium">Mahsulot topilmadi</td></tr>
              ) : visible.map(r => {
                const d = diffOf(r)
                const u = (r.unit || 'dona').toLowerCase()
                const rowBg = d !== null && d !== 0 ? 'bg-rose-500/[0.04]' : ''
                return (
                  <tr key={r.id} className={`hover:bg-white/40 transition-colors ${rowBg}`}>
                    <td className="p-4 font-medium text-zinc-900/90">{r.name}</td>
                    <td className="p-4 text-right text-rose-500 font-bold tabular-nums">
                      {r.used > 0 ? `−${r.used}` : '0'} <span className="text-zinc-400 font-normal text-xs">{u}</span>
                    </td>
                    <td className="p-4 text-right font-bold text-zinc-700 tabular-nums">
                      {r.qty} <span className="text-zinc-400 font-normal text-xs">{u}</span>
                    </td>
                    <td className="p-4 text-right">
                      <input
                        type="number"
                        inputMode="numeric"
                        min={0}
                        value={counts[r.id] ?? ''}
                        onChange={e => setCounts(prev => ({ ...prev, [r.id]: e.target.value }))}
                        placeholder="—"
                        className="w-28 text-right bg-white/70 border border-zinc-200 shadow-inner rounded-lg py-1.5 px-3 text-sm font-bold text-zinc-900 focus:outline-none focus:ring-2 focus:ring-brand-500/40"
                      />
                    </td>
                    <td className="p-4 text-right tabular-nums">
                      {d === null ? (
                        <span className="text-zinc-300">—</span>
                      ) : d === 0 ? (
                        <span className="inline-flex items-center gap-1 text-emerald-500 font-bold"><Check size={14} /> mos</span>
                      ) : (
                        <span className={`inline-flex items-center gap-1 font-bold ${d < 0 ? 'text-rose-500' : 'text-amber-500'}`}>
                          <AlertTriangle size={13} /> {d > 0 ? '+' : ''}{d}
                        </span>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      <p className="text-xs text-zinc-400 mt-4">
        Farq = haqiqiy − hisob. <span className="text-rose-500 font-medium">Manfiy (kam)</span> — hisobда ko'p ko'rsatilgan (chiqimi yozilmagan).
        <span className="text-amber-500 font-medium"> Musbat (ko'p)</span> — ortiqcha. "Tuzatish" qoldiqни haqiqiy songa moslaydi.
      </p>

      {selected && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-900/40 backdrop-blur-sm"
          onClick={() => setSelected(null)}
        >
          <div
            className="bg-white border border-zinc-100 rounded-3xl p-6 w-full max-w-md shadow-2xl"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-start justify-between mb-5">
              <div className="min-w-0 pr-3">
                <h3 className="text-lg font-bold text-zinc-900 leading-tight">{selected.name}</h3>
                <p className="text-xs text-zinc-400 mt-1">
                  {selected.date} {selected.time}{selected.by ? ` · ${selected.by}` : ''}
                </p>
              </div>
              <button
                onClick={() => setSelected(null)}
                className="shrink-0 p-2 rounded-full hover:bg-zinc-100 text-zinc-400 hover:text-zinc-700 transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            <div className="space-y-2">
              <div className="flex justify-between items-center py-2.5 px-3.5 rounded-xl bg-zinc-50">
                <span className="text-sm text-zinc-500 font-medium">O'zgarish</span>
                <span className={`font-bold tabular-nums ${selected.delta < 0 ? 'text-rose-500' : 'text-amber-500'}`}>
                  {selected.delta > 0 ? '+' : ''}{selected.delta} <span className="text-zinc-400 font-normal text-xs">{selected.unit}</span>
                </span>
              </div>

              <div className="flex justify-between items-center py-2.5 px-3.5 rounded-xl bg-zinc-50">
                <span className="text-sm text-zinc-500 font-medium">Birlik narxi</span>
                <span className="font-bold tabular-nums text-zinc-800">
                  {selected.price > 0 ? som(selected.price) : <span className="text-zinc-400 font-normal text-sm">narx kiritilmagan</span>}
                </span>
              </div>

              <div className="flex justify-between items-center py-3 px-3.5 rounded-xl bg-gradient-to-r from-brand-500/10 to-violet-500/10 border border-brand-500/20">
                <span className="text-sm text-zinc-600 font-semibold">O'zgarish qiymati</span>
                <span className={`font-extrabold tabular-nums ${selected.delta < 0 ? 'text-rose-500' : 'text-emerald-600'}`}>
                  {selected.delta > 0 ? '+' : ''}{som(selected.delta * selected.price)}
                </span>
              </div>

              <div className="h-px bg-zinc-100 my-1" />

              <div className="flex justify-between items-center py-2.5 px-3.5 rounded-xl bg-zinc-50">
                <span className="text-sm text-zinc-500 font-medium">Hozirgi qoldiq</span>
                <span className="font-bold tabular-nums text-zinc-800">
                  {selected.qty} <span className="text-zinc-400 font-normal text-xs">{selected.unit}</span>
                </span>
              </div>

              <div className="flex justify-between items-center py-2.5 px-3.5 rounded-xl bg-zinc-50">
                <span className="text-sm text-zinc-500 font-medium">Qoldiq qiymati</span>
                <span className="font-bold tabular-nums text-zinc-800">{som(selected.qty * selected.price)}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {summaryOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-900/40 backdrop-blur-sm"
          onClick={() => setSummaryOpen(false)}
        >
          <div
            className="bg-white border border-zinc-100 rounded-3xl w-full max-w-3xl shadow-2xl flex flex-col max-h-[88vh]"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-start justify-between p-6 pb-4">
              <div>
                <h3 className="text-lg font-bold text-zinc-900">{monthLabel} — tuzatishlar</h3>
                <p className="text-xs text-zinc-400 mt-0.5">Inventarizatsiya natijasida o'zgargan mahsulotlar (eng kattadan)</p>
              </div>
              <button
                onClick={() => setSummaryOpen(false)}
                className="shrink-0 p-2 rounded-full hover:bg-zinc-100 text-zinc-400 hover:text-zinc-700 transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            <div className="grid grid-cols-3 gap-3 px-6 pb-4">
              <div className="rounded-xl bg-zinc-50 p-3 text-center">
                <p className="text-xs text-zinc-500 mb-0.5">Mahsulot</p>
                <p className="text-xl font-bold text-zinc-900 tabular-nums">{adjSummary.count}</p>
              </div>
              <div className="rounded-xl bg-zinc-50 p-3 text-center">
                <p className="text-xs text-zinc-500 mb-0.5">Jami o'zgarish</p>
                <p className={`text-xl font-bold tabular-nums ${adjSummary.net < 0 ? 'text-rose-500' : adjSummary.net > 0 ? 'text-amber-500' : 'text-zinc-900'}`}>{adjSummary.net > 0 ? '+' : ''}{adjSummary.net}</p>
              </div>
              <div className="rounded-xl bg-zinc-50 p-3 text-center">
                <p className="text-xs text-zinc-500 mb-0.5">Qiymat</p>
                <p className={`text-base font-bold tabular-nums ${adjSummary.value < 0 ? 'text-rose-500' : adjSummary.value > 0 ? 'text-emerald-600' : 'text-zinc-900'}`}>{adjSummary.value > 0 ? '+' : ''}{som(adjSummary.value)}</p>
              </div>
            </div>

            <div className="overflow-y-auto px-6 pb-6">
              <table className="w-full text-sm border-collapse">
                <thead className="sticky top-0 bg-white">
                  <tr className="text-xs text-zinc-400 uppercase tracking-wider">
                    <th className="py-2 pr-2 font-medium text-left">Mahsulot</th>
                    <th className="py-2 px-2 font-medium text-right">O'zgarish</th>
                    <th className="py-2 px-2 font-medium text-right">Narx</th>
                    <th className="py-2 pl-2 font-medium text-right">Qiymat</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100">
                  {adjByImpact.map(a => {
                    const val = a.delta * a.price
                    return (
                      <tr key={a.id}>
                        <td className="py-2.5 pr-2 align-top">
                          <div className="font-medium text-zinc-800 leading-tight">{a.name}</div>
                          <div className="text-xs text-zinc-400">{a.date}{a.by ? ` · ${a.by}` : ''}</div>
                        </td>
                        <td className={`py-2.5 px-2 text-right font-bold tabular-nums whitespace-nowrap ${a.delta < 0 ? 'text-rose-500' : 'text-amber-500'}`}>
                          {a.delta > 0 ? '+' : ''}{a.delta} <span className="text-zinc-400 font-normal text-xs">{a.unit}</span>
                        </td>
                        <td className="py-2.5 px-2 text-right tabular-nums text-zinc-500 whitespace-nowrap">
                          {a.price > 0 ? som(a.price) : '—'}
                        </td>
                        <td className={`py-2.5 pl-2 text-right font-bold tabular-nums whitespace-nowrap ${val < 0 ? 'text-rose-500' : val > 0 ? 'text-emerald-600' : 'text-zinc-300'}`}>
                          {val > 0 ? '+' : ''}{som(val)}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
