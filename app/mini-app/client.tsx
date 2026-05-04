'use client'

import React, { useState, useEffect } from 'react'
import { Package, ChevronRight, Check, AlertCircle, Minus, Plus, Search } from 'lucide-react'

type Item = {
  id: string
  name: string
  quantity: number
  unit: string
  price: number
}

type SelectedItem = {
  item: Item
  qty: number
}

type Step = 'event' | 'items' | 'confirm' | 'done' | 'error'

declare global {
  interface Window {
    Telegram?: {
      WebApp?: {
        ready: () => void
        close: () => void
        expand: () => void
        initDataUnsafe?: { user?: { id: number; first_name: string } }
        MainButton: {
          text: string
          show: () => void
          hide: () => void
          onClick: (cb: () => void) => void
          showProgress: (b: boolean) => void
          hideProgress: () => void
          enable: () => void
          disable: () => void
        }
        colorScheme: string
        themeParams: { bg_color?: string }
      }
    }
  }
}

export default function MiniAppClient({ items }: { items: Item[] }) {
  const [mounted, setMounted] = useState(false)
  const [step, setStep] = useState<Step>('event')
  const [eventName, setEventName] = useState('')
  const [selected, setSelected] = useState<SelectedItem[]>([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')
  const [tgUser, setTgUser] = useState<{ id: string; name: string } | null>(null)
  const [manualName, setManualName] = useState('')

  useEffect(() => {
    setMounted(true)
    const tg = window.Telegram?.WebApp
    if (tg) {
      tg.ready()
      tg.expand()
      const user = tg.initDataUnsafe?.user
      if (user?.id) {
        setTgUser({ id: String(user.id), name: user.first_name })
        return
      }
    }
    // If Telegram didn't give us a name, check localStorage
    const savedName = localStorage.getItem('sklad_user_name')
    if (savedName) {
      setManualName(savedName)
    }
  }, [])

  if (!mounted) {
    return (
      <div style={{ minHeight: '100vh', background: '#0f0f13', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ color: 'white', opacity: 0.4, fontSize: 14 }}>Yuklanmoqda...</div>
      </div>
    )
  }

  const displayName = tgUser?.name || manualName || ''
  const userId = tgUser?.id || `miniapp_user`

  const filteredItems = items.filter(i =>
    i.name.toLowerCase().includes(search.toLowerCase())
  )

  const toggleItem = (item: Item) => {
    setSelected(prev => {
      const exists = prev.find(s => s.item.id === item.id)
      if (exists) return prev.filter(s => s.item.id !== item.id)
      return [...prev, { item, qty: 1 }]
    })
  }

  const changeQty = (itemId: string, delta: number) => {
    setSelected(prev => prev.map(s => {
      if (s.item.id !== itemId) return s
      const newQty = Math.max(1, Math.min(s.item.quantity, s.qty + delta))
      return { ...s, qty: newQty }
    }))
  }

  const totalCost = selected.reduce((sum, s) => sum + s.item.price * s.qty, 0)

  const handleSubmit = async () => {
    if (!eventName.trim()) { setStep('event'); return }
    if (selected.length === 0) return

    setLoading(true)
    try {
      const apiUrl = `${window.location.origin}/api/mini-app/submit`
      const res = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          eventName: eventName.trim(),
          telegramId: userId,
          telegramName: displayName,
          items: selected.map(s => ({
            itemId: s.item.id,
            quantity: s.qty,
            totalPrice: s.item.price * s.qty
          }))
        })
      })
      const data = await res.json()
      if (data.success) {
        setStep('done')
        setTimeout(() => window.Telegram?.WebApp?.close(), 2500)
      } else {
        setErrorMsg(data.error || 'Xatolik yuz berdi')
        setStep('error')
      }
    } catch {
      setErrorMsg("Server bilan aloqa yo'q")
      setStep('error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#0f0f13] text-white font-sans" style={{ fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      
      {/* Header */}
      <div className="sticky top-0 z-20 bg-[#0f0f13]/95 backdrop-blur-sm border-b border-white/5 px-5 py-4">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-indigo-500/20 flex items-center justify-center">
            <Package size={18} className="text-indigo-400" />
          </div>
          <div>
            <h1 className="font-bold text-base text-white leading-tight">Chiqim kiritish</h1>
            <p className="text-[11px] text-white/30">{displayName || 'Impulse Sklad'}</p>
          </div>
        </div>

        {/* Step indicators */}
        <div className="flex items-center gap-2 mt-4">
          {['event', 'items', 'confirm'].map((s, i) => (
            <React.Fragment key={s}>
              <div className={`h-1.5 flex-1 rounded-full transition-all ${
                step === 'done' ? 'bg-emerald-500' :
                ['event', 'items', 'confirm'].indexOf(step) >= i ? 'bg-indigo-500' : 'bg-white/10'
              }`} />
            </React.Fragment>
          ))}
        </div>
      </div>

      <div className="px-5 py-6">

        {/* STEP 1: Event Name */}
        {step === 'event' && (
          <div className="space-y-5 animate-in fade-in slide-in-from-bottom-4 duration-300">
            <div>
              <h2 className="text-xl font-black text-white mb-1">Qaysi tadbir uchun?</h2>
              <p className="text-white/40 text-sm">Tadbir nomi yoki "Impulse" ni kiriting</p>
            </div>

            {/* If Telegram didn't provide name - ask manually */}
            {!tgUser && (
              <div>
                <label className="block text-white/40 text-[10px] font-bold uppercase tracking-widest mb-2 ml-1">Ismingiz</label>
                <input
                  type="text"
                  placeholder="Ismi familyangizni kiriting..."
                  value={manualName}
                  onChange={e => setManualName(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 px-5 text-white placeholder-white/20 focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
                />
              </div>
            )}

            <div className="space-y-3">
              {['Impulse', 'Assodiq', 'Nodir aka', 'Hamza'].map(preset => (
                <button
                  key={preset}
                  onClick={() => setEventName(preset)}
                  className={`w-full text-left px-5 py-4 rounded-2xl border transition-all font-bold ${
                    eventName === preset
                      ? 'bg-indigo-500/20 border-indigo-500/50 text-indigo-300'
                      : 'bg-white/5 border-white/5 text-white/70 active:bg-white/10'
                  }`}
                >
                  {preset}
                </button>
              ))}
            </div>

            <div className="relative">
              <input
                type="text"
                placeholder="Boshqa tadbir nomini yozing..."
                value={!['Impulse', 'Assodiq', 'Nodir aka', 'Hamza'].includes(eventName) ? eventName : ''}
                onChange={e => setEventName(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 px-5 text-white placeholder-white/20 focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
              />
            </div>

            <button
              onClick={() => {
                const nameOk = tgUser || manualName.trim()
                if (eventName.trim() && nameOk) {
                  // Save name for future visits
                  if (!tgUser && manualName.trim()) {
                    localStorage.setItem('sklad_user_name', manualName.trim())
                  }
                  setStep('items')
                }
              }}
              disabled={!eventName.trim() || (!tgUser && !manualName.trim())}
              className="w-full py-4 rounded-2xl bg-indigo-500 text-white font-black text-sm uppercase tracking-widest disabled:opacity-30 active:bg-indigo-600 transition-all flex items-center justify-center gap-2"
            >
              Davom etish <ChevronRight size={18} />
            </button>
          </div>
        )}

        {/* STEP 2: Select Items */}
        {step === 'items' && (
          <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-300">
            <div>
              <h2 className="text-xl font-black text-white mb-1">Mahsulotlarni tanlang</h2>
              <p className="text-white/40 text-sm">Tadbir: <span className="text-indigo-400 font-bold">{eventName}</span></p>
            </div>

            <div className="relative">
              <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-white/20" />
              <input
                type="text"
                placeholder="Qidirish..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-2xl py-3 pl-10 pr-5 text-white placeholder-white/20 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 text-sm"
              />
            </div>

            <div className="space-y-3 max-h-[55vh] overflow-y-auto pr-1">
              {filteredItems.map(item => {
                const sel = selected.find(s => s.item.id === item.id)
                return (
                  <div
                    key={item.id}
                    className={`rounded-2xl border transition-all ${
                      sel
                        ? 'bg-indigo-500/10 border-indigo-500/40'
                        : 'bg-white/5 border-white/5'
                    }`}
                  >
                    <button
                      onClick={() => toggleItem(item)}
                      className="w-full text-left p-4 flex justify-between items-center"
                    >
                      <div>
                        <div className={`font-bold text-sm ${sel ? 'text-indigo-300' : 'text-white/80'}`}>{item.name}</div>
                        <div className="text-[11px] text-white/30 mt-0.5">{item.quantity} {item.unit.toLowerCase()} qoldi</div>
                      </div>
                      <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all ${
                        sel ? 'bg-indigo-500 border-indigo-500' : 'border-white/20'
                      }`}>
                        {sel && <Check size={12} className="text-white" strokeWidth={3} />}
                      </div>
                    </button>

                    {sel && (
                      <div className="px-4 pb-4 flex items-center gap-4 animate-in fade-in duration-150">
                        <button
                          onClick={() => changeQty(item.id, -1)}
                          className="w-9 h-9 rounded-xl bg-white/10 flex items-center justify-center active:bg-white/20"
                        >
                          <Minus size={16} />
                        </button>
                        <span className="flex-1 text-center font-black text-lg text-white">
                          {sel.qty} <span className="text-xs text-white/30 font-normal">{item.unit.toLowerCase()}</span>
                        </span>
                        <button
                          onClick={() => changeQty(item.id, 1)}
                          className="w-9 h-9 rounded-xl bg-white/10 flex items-center justify-center active:bg-white/20"
                        >
                          <Plus size={16} />
                        </button>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>

            <button
              onClick={() => selected.length > 0 && setStep('confirm')}
              disabled={selected.length === 0}
              className="w-full py-4 rounded-2xl bg-indigo-500 text-white font-black text-sm uppercase tracking-widest disabled:opacity-30 active:bg-indigo-600 transition-all flex items-center justify-center gap-2 sticky bottom-4"
            >
              Davom etish ({selected.length} ta) <ChevronRight size={18} />
            </button>
          </div>
        )}

        {/* STEP 3: Confirm */}
        {step === 'confirm' && (
          <div className="space-y-5 animate-in fade-in slide-in-from-bottom-4 duration-300">
            <div>
              <h2 className="text-xl font-black text-white mb-1">Tasdiqlang</h2>
              <p className="text-white/40 text-sm">Tadbir: <span className="text-indigo-400 font-bold">{eventName}</span></p>
            </div>

            <div className="space-y-3">
              {selected.map(s => (
                <div key={s.item.id} className="bg-white/5 border border-white/5 rounded-2xl p-4 flex justify-between items-center">
                  <div>
                    <div className="font-bold text-white text-sm">{s.item.name}</div>
                    <div className="text-rose-400 font-black text-xs mt-0.5">-{s.qty} {s.item.unit.toLowerCase()}</div>
                  </div>
                  <div className="text-right">
                    <div className="font-black text-white text-sm" suppressHydrationWarning>
                      {(s.item.price * s.qty).toLocaleString()} UZS
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="bg-indigo-500/10 border border-indigo-500/20 rounded-2xl p-5">
              <div className="flex justify-between items-center">
                <span className="text-white/50 text-sm font-medium">Jami rasxod</span>
                <span className="text-indigo-400 font-black text-xl" suppressHydrationWarning>
                  {totalCost.toLocaleString()} UZS
                </span>
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setStep('items')}
                className="flex-1 py-4 rounded-2xl bg-white/5 border border-white/10 text-white/60 font-bold text-sm active:bg-white/10"
              >
                Orqaga
              </button>
              <button
                onClick={handleSubmit}
                disabled={loading}
                className="flex-2 flex-grow-[2] py-4 rounded-2xl bg-indigo-500 text-white font-black text-sm uppercase tracking-widest disabled:opacity-50 active:bg-indigo-600 flex items-center justify-center gap-2"
              >
                {loading ? (
                  <span className="animate-pulse">Saqlanmoqda...</span>
                ) : (
                  <>✓ Tasdiqlash</>
                )}
              </button>
            </div>
          </div>
        )}

        {/* DONE */}
        {step === 'done' && (
          <div className="flex flex-col items-center justify-center py-20 space-y-4 animate-in fade-in zoom-in duration-300">
            <div className="w-20 h-20 rounded-full bg-emerald-500/20 flex items-center justify-center mb-2">
              <Check size={40} className="text-emerald-400" strokeWidth={3} />
            </div>
            <h2 className="text-2xl font-black text-white">Saqlandi!</h2>
            <p className="text-white/40 text-sm text-center">
              Chiqim muvaffaqiyatli qayd etildi.<br />Oyna yopilmoqda...
            </p>
          </div>
        )}

        {/* ERROR */}
        {step === 'error' && (
          <div className="flex flex-col items-center justify-center py-20 space-y-4">
            <div className="w-20 h-20 rounded-full bg-rose-500/20 flex items-center justify-center mb-2">
              <AlertCircle size={40} className="text-rose-400" />
            </div>
            <h2 className="text-2xl font-black text-white">Xatolik!</h2>
            <p className="text-white/40 text-sm text-center">{errorMsg}</p>
            <button
              onClick={() => setStep('confirm')}
              className="px-8 py-3 rounded-2xl bg-rose-500/20 border border-rose-500/30 text-rose-400 font-bold text-sm"
            >
              Qayta urinish
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
