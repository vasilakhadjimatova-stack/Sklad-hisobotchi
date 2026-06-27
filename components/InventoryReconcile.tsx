'use client'

import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { Search, Save, ClipboardCheck, AlertTriangle, Check, Filter, History, ChevronDown } from 'lucide-react'

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
  by: string
}

const UZ_MONTHS = ['Yanvar', 'Fevral', 'Mart', 'Aprel', 'May', 'Iyun', 'Iyul', 'Avgust', 'Sentabr', 'Oktabr', 'Noyabr', 'Dekabr']

export default function InventoryReconcile({ rows, month, adjustments }: { rows: Row[]; month: string; adjustments: Adjustment[] }) {
  const router = useRouter()
  const [counts, setCounts] = useState<Record<string, string>>({})
  const [search, setSearch] = useState('')
  const [onlyMismatch, setOnlyMismatch] = useState(false)
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState('')
  const [corrected, setCorrected] = useState<any[]>([])
  const [histOpen, setHistOpen] = useState(true)

  const monthLabel = (() => {
    const [yy, mm] = month.split('-').map(Number)
    return `${UZ_MONTHS[(mm || 1) - 1] || ''} ${yy || ''}`.trim()
  })()

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
                  <div key={a.id} className="flex justify-between items-center gap-3 text-sm border-b border-white/40 last:border-0 py-2">
                    <div className="min-w-0">
                      <div className="font-medium text-zinc-800 truncate">{a.name}</div>
                      <div className="text-xs text-zinc-400">{a.date}{a.by ? ` · ${a.by}` : ''}</div>
                    </div>
                    <span className={`font-bold tabular-nums shrink-0 ${a.delta < 0 ? 'text-rose-500' : 'text-amber-500'}`}>
                      {a.delta > 0 ? '+' : ''}{a.delta} <span className="text-zinc-400 font-normal text-xs">{a.unit}</span>
                    </span>
                  </div>
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
    </div>
  )
}
