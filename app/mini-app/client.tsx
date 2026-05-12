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
      <div className="min-h-screen bg-[#f4f4f5] flex items-center justify-center">
        <div className="w-8 h-8 rounded-full border-4 border-brand-500 border-t-transparent animate-spin"></div>
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
    <div className="min-h-screen bg-[#f4f4f5] text-zinc-900 font-sans relative overflow-x-hidden selection:bg-brand-500/30">
      
      {/* Animated Background Blobs */}
      <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-5%] left-[-10%] w-[60%] h-[40%] bg-brand-500/15 rounded-full blur-[80px] animate-blob"></div>
        <div className="absolute top-[20%] right-[-10%] w-[50%] h-[50%] bg-rose-500/15 rounded-full blur-[80px] animate-blob animation-delay-2000"></div>
        <div className="absolute bottom-[-10%] left-[10%] w-[50%] h-[50%] bg-violet-500/15 rounded-full blur-[80px] animate-blob animation-delay-4000"></div>
      </div>

      <div className="relative z-10">
        {/* Header */}
        <div className="sticky top-0 z-30 bg-white/60 backdrop-blur-xl border-b border-white/80 shadow-sm px-5 py-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-brand-500/10 border border-brand-500/20 flex items-center justify-center shadow-inner">
              <Package size={20} className="text-brand-500" />
            </div>
            <div>
              <h1 className="font-bold text-lg text-zinc-900 leading-tight">Chiqim kiritish</h1>
              <p className="text-xs font-medium text-zinc-500">{displayName || 'Impulse Sklad'}</p>
            </div>
          </div>

          {/* Step indicators */}
          <div className="flex items-center gap-2 mt-4">
            {['event', 'items', 'confirm'].map((s, i) => (
              <React.Fragment key={s}>
                <div className={`h-1.5 flex-1 rounded-full transition-all duration-300 ${
                  step === 'done' ? 'bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.3)]' :
                  ['event', 'items', 'confirm'].indexOf(step) >= i ? 'bg-brand-500 shadow-[0_0_10px_rgba(99,102,241,0.3)]' : 'bg-zinc-900/10'
                }`} />
              </React.Fragment>
            ))}
          </div>
        </div>

        <div className="px-5 py-6">

          {/* STEP 1: Event Name */}
          {step === 'event' && (
            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-300">
              <div>
                <h2 className="text-2xl font-bold text-zinc-900 mb-1 tracking-tight">Qaysi tadbir uchun?</h2>
                <p className="text-zinc-500 text-sm font-medium">Tadbir nomini tanlang yoki kiriting</p>
              </div>

              {/* If Telegram didn't provide name - ask manually */}
              {!tgUser && (
                <div className="space-y-2">
                  <label className="block text-zinc-500 text-xs font-bold uppercase tracking-widest ml-1">Ismingiz</label>
                  <input
                    type="text"
                    placeholder="Ismi familyangizni kiriting..."
                    value={manualName}
                    onChange={e => setManualName(e.target.value)}
                    className="w-full bg-white/70 backdrop-blur-md border border-white/80 shadow-sm rounded-2xl py-4 px-5 text-zinc-900 placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-brand-500/50 transition-all font-medium"
                  />
                </div>
              )}

              <div className="space-y-3">
                {['Impulse', 'Assodiq', 'Nodir aka', 'Hamza'].map(preset => (
                  <button
                    key={preset}
                    onClick={() => setEventName(preset)}
                    className={`w-full text-left px-5 py-4 rounded-2xl border transition-all duration-200 font-bold shadow-sm ${
                      eventName === preset
                        ? 'bg-brand-500/10 border-brand-500/30 text-brand-600 shadow-[0_4px_15px_rgba(99,102,241,0.1)]'
                        : 'bg-white/60 backdrop-blur-md border-white/80 text-zinc-700 hover:bg-white/80 active:scale-[0.98]'
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
                  className="w-full bg-white/70 backdrop-blur-md border border-white/80 shadow-sm rounded-2xl py-4 px-5 text-zinc-900 placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-brand-500/50 transition-all font-medium"
                />
              </div>

              <button
                onClick={() => {
                  const nameOk = tgUser || manualName.trim()
                  if (eventName.trim() && nameOk) {
                    if (!tgUser && manualName.trim()) {
                      localStorage.setItem('sklad_user_name', manualName.trim())
                    }
                    setStep('items')
                  }
                }}
                disabled={!eventName.trim() || (!tgUser && !manualName.trim())}
                className="w-full py-4 rounded-2xl bg-gradient-to-r from-brand-500 to-violet-500 text-white font-bold text-sm uppercase tracking-widest disabled:opacity-50 active:scale-[0.98] transition-all flex items-center justify-center gap-2 shadow-[0_8px_20px_rgba(99,102,241,0.3)] mt-8"
              >
                Davom etish <ChevronRight size={18} />
              </button>
            </div>
          )}

          {/* STEP 2: Select Items */}
          {step === 'items' && (
            <div className="space-y-5 animate-in fade-in slide-in-from-bottom-4 duration-300">
              <div>
                <h2 className="text-2xl font-bold text-zinc-900 mb-1 tracking-tight">Mahsulotlar</h2>
                <p className="text-zinc-500 text-sm font-medium">Tadbir: <span className="text-brand-500 font-bold">{eventName}</span></p>
              </div>

              <div className="relative">
                <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400" />
                <input
                  type="text"
                  placeholder="Qidirish..."
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  className="w-full bg-white/70 backdrop-blur-md border border-white/80 shadow-sm rounded-2xl py-3.5 pl-11 pr-5 text-zinc-900 placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-brand-500/50 transition-all font-medium text-sm"
                />
              </div>

              <div className="space-y-3 pb-24">
                {filteredItems.map(item => {
                  const sel = selected.find(s => s.item.id === item.id)
                  return (
                    <div
                      key={item.id}
                      className={`rounded-2xl border transition-all duration-200 overflow-hidden ${
                        sel
                          ? 'bg-brand-500/5 border-brand-500/30 shadow-[0_4px_15px_rgba(99,102,241,0.05)]'
                          : 'bg-white/60 backdrop-blur-md border-white/80 shadow-sm'
                      }`}
                    >
                      <button
                        onClick={() => toggleItem(item)}
                        className="w-full text-left p-4 flex justify-between items-center active:bg-zinc-900/5 transition-colors"
                      >
                        <div>
                          <div className={`font-bold text-base tracking-tight ${sel ? 'text-brand-600' : 'text-zinc-800'}`}>{item.name}</div>
                          <div className="text-xs font-medium text-zinc-500 mt-1">{item.quantity} {item.unit.toLowerCase()} qoldi</div>
                        </div>
                        <div className={`w-6 h-6 rounded-full flex items-center justify-center transition-all ${
                          sel ? 'bg-brand-500 border-none' : 'border-2 border-zinc-300'
                        }`}>
                          {sel && <Check size={14} className="text-white" strokeWidth={3} />}
                        </div>
                      </button>

                      {sel && (
                        <div className="px-4 pb-4 pt-1 flex items-center gap-4 animate-in fade-in slide-in-from-top-2 duration-200">
                          <button
                            onClick={() => changeQty(item.id, -1)}
                            className="w-10 h-10 rounded-xl bg-white shadow-sm border border-zinc-200 flex items-center justify-center active:scale-95 transition-all text-zinc-600 hover:bg-zinc-50"
                          >
                            <Minus size={18} />
                          </button>
                          <span className="flex-1 text-center font-bold text-xl text-zinc-900">
                            {sel.qty} <span className="text-sm text-zinc-500 font-medium">{item.unit.toLowerCase()}</span>
                          </span>
                          <button
                            onClick={() => changeQty(item.id, 1)}
                            className="w-10 h-10 rounded-xl bg-white shadow-sm border border-zinc-200 flex items-center justify-center active:scale-95 transition-all text-zinc-600 hover:bg-zinc-50"
                          >
                            <Plus size={18} />
                          </button>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>

              <div className="fixed bottom-0 left-0 right-0 p-5 bg-gradient-to-t from-[#f4f4f5] via-[#f4f4f5]/90 to-transparent z-20">
                <button
                  onClick={() => selected.length > 0 && setStep('confirm')}
                  disabled={selected.length === 0}
                  className="w-full py-4 rounded-2xl bg-gradient-to-r from-brand-500 to-violet-500 text-white font-bold text-sm uppercase tracking-widest disabled:opacity-50 active:scale-[0.98] transition-all flex items-center justify-center gap-2 shadow-[0_8px_20px_rgba(99,102,241,0.3)]"
                >
                  Tasdiqlash ({selected.length}) <ChevronRight size={18} />
                </button>
              </div>
            </div>
          )}

          {/* STEP 3: Confirm */}
          {step === 'confirm' && (
            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-300">
              <div>
                <h2 className="text-2xl font-bold text-zinc-900 mb-1 tracking-tight">Tasdiqlang</h2>
                <p className="text-zinc-500 text-sm font-medium">Tadbir: <span className="text-brand-500 font-bold">{eventName}</span></p>
              </div>

              <div className="space-y-3">
                {selected.map(s => (
                  <div key={s.item.id} className="bg-white/70 backdrop-blur-md border border-white/80 shadow-sm rounded-2xl p-5 flex justify-between items-center">
                    <div>
                      <div className="font-bold text-zinc-800 text-base tracking-tight">{s.item.name}</div>
                      <div className="text-rose-500 font-bold text-sm mt-1">-{s.qty} {s.item.unit.toLowerCase()}</div>
                    </div>
                    <div className="text-right">
                      <div className="font-bold text-zinc-900 text-base tracking-tight" suppressHydrationWarning>
                        {(s.item.price * s.qty).toLocaleString()} UZS
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="bg-brand-500/5 border border-brand-500/20 rounded-2xl p-6 shadow-inner relative overflow-hidden">
                <div className="absolute top-0 right-0 w-32 h-32 bg-brand-500/10 rounded-full blur-3xl"></div>
                <div className="flex justify-between items-center relative z-10">
                  <span className="text-zinc-600 text-sm font-bold tracking-wide uppercase">Jami rasxod</span>
                  <span className="text-brand-600 font-black text-2xl tracking-tight" suppressHydrationWarning>
                    {totalCost.toLocaleString()} <span className="text-lg">UZS</span>
                  </span>
                </div>
              </div>

              <div className="flex gap-3 mt-8">
                <button
                  onClick={() => setStep('items')}
                  className="flex-1 py-4 rounded-2xl bg-white border border-zinc-200 text-zinc-600 font-bold text-sm active:scale-[0.98] transition-all shadow-sm"
                >
                  Orqaga
                </button>
                <button
                  onClick={handleSubmit}
                  disabled={loading}
                  className="flex-[2] py-4 rounded-2xl bg-gradient-to-r from-brand-500 to-violet-500 text-white font-bold text-sm uppercase tracking-widest disabled:opacity-70 active:scale-[0.98] transition-all shadow-[0_8px_20px_rgba(99,102,241,0.3)] flex items-center justify-center gap-2"
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
            <div className="flex flex-col items-center justify-center py-24 space-y-5 animate-in fade-in zoom-in duration-300">
              <div className="relative">
                <div className="absolute inset-0 bg-emerald-500/20 blur-xl rounded-full"></div>
                <div className="w-24 h-24 rounded-full bg-emerald-100 border-4 border-white shadow-xl flex items-center justify-center relative z-10">
                  <Check size={48} className="text-emerald-500" strokeWidth={3} />
                </div>
              </div>
              <h2 className="text-3xl font-black text-zinc-900 tracking-tight">Muvaffaqiyatli!</h2>
              <p className="text-zinc-500 font-medium text-base text-center leading-relaxed max-w-[250px]">
                Chiqim saqlandi.<br />Oyna avtomatik yopiladi...
              </p>
            </div>
          )}

          {/* ERROR */}
          {step === 'error' && (
            <div className="flex flex-col items-center justify-center py-24 space-y-5 animate-in fade-in zoom-in duration-300">
               <div className="relative">
                <div className="absolute inset-0 bg-rose-500/20 blur-xl rounded-full"></div>
                <div className="w-24 h-24 rounded-full bg-rose-100 border-4 border-white shadow-xl flex items-center justify-center relative z-10">
                  <AlertCircle size={48} className="text-rose-500" />
                </div>
              </div>
              <h2 className="text-3xl font-black text-zinc-900 tracking-tight">Xatolik!</h2>
              <p className="text-zinc-500 font-medium text-base text-center leading-relaxed max-w-[250px]">{errorMsg}</p>
              <button
                onClick={() => setStep('confirm')}
                className="mt-4 px-8 py-4 rounded-2xl bg-white border border-zinc-200 text-zinc-700 font-bold text-sm shadow-sm active:scale-95 transition-all"
              >
                Qayta urinish
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
