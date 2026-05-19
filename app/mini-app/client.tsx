'use client'

import React, { useState, useEffect } from 'react'
import { Package, ChevronRight, Check, AlertCircle, Minus, Plus, Search, Calendar } from 'lucide-react'

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
  newTotalPrice?: string
}

type Step = 'event' | 'items' | 'confirm' | 'done' | 'error'

const cyrillicToLatinMap: Record<string, string> = {
  'а':'a', 'б':'b', 'в':'v', 'г':'g', 'д':'d', 'е':'e', 'ё':'yo', 'ж':'j', 'з':'z',
  'и':'i', 'й':'y', 'к':'k', 'л':'l', 'м':'m', 'н':'n', 'о':'o', 'п':'p', 'р':'r',
  'с':'s', 'т':'t', 'у':'u', 'ф':'f', 'х':'x', 'ц':'ts', 'ч':'ch', 'ш':'sh', 'щ':'shch',
  'ъ':'', 'ы':'i', 'ь':'', 'э':'e', 'ю':'yu', 'я':'ya', 'ў':'o', 'қ':'q', 'ғ':'g', 'ҳ':'h'
};

const normalize = (text: string) => {
  let t = text.toLowerCase();
  let res = '';
  for(let char of t) {
    res += cyrillicToLatinMap[char] || char;
  }
  // Remove special chars and spaces for fuzzy match, but maybe we want to keep spaces to allow multi-word
  return res.replace(/[^a-z0-9 ]/g, ''); 
}

// Define explicit synonyms for products
const itemKeywords: Record<string, string[]> = {
  'biolife': ['suv', 'voda', 'ichimlik'],
  'montella': ['suv', 'voda', 'ichimlik'],
  'family': ['suv', 'voda', 'ichimlik'],
  'dena': ['suv', 'sok', 'voda', 'ichimlik', 'sharbat'],
  'pepsi': ['suv', 'ichimlik', 'voda', 'gazli', 'kola'],
  'coca': ['suv', 'ichimlik', 'voda', 'gazli', 'kola'],
  'lazzat': ['choy', 'tea', 'chay', 'qora choy', 'kok choy'],
  'svetocopy': ['qogoz', 'bumaga', 'a4', 'qog\'oz'],
  'snegurochka': ['qogoz', 'bumaga', 'a4', 'qog\'oz'],
  'maccoffee': ['kofe', 'coffee', 'kofe', 'kofe3v1'],
  'jacobs': ['kofe', 'coffee', 'kofe'],
  'salfetka': ['qogoz', 'salfetka', 'bumaga'],
};

// Cache the searchable text for performance
const getSearchableText = (itemName: string) => {
  let normName = normalize(itemName);
  let extras: string[] = [];
  
  for (const [key, keywords] of Object.entries(itemKeywords)) {
    if (normName.includes(key)) {
      extras.push(...keywords.map(normalize));
    }
  }
  return normName + " " + extras.join(" ");
}

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
  const [actionType, setActionType] = useState<'TAKE' | 'ADD'>('TAKE')
  const [step, setStep] = useState<Step>('event')
  const [eventName, setEventName] = useState('')
  const [selected, setSelected] = useState<SelectedItem[]>([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')
  const [tgUser, setTgUser] = useState<{ id: string; name: string } | null>(null)
  const [manualName, setManualName] = useState('')
  const [selectedDate, setSelectedDate] = useState(() => {
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const dd = String(today.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  });

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

  const filteredItems = items.filter(i => {
    if (!search) return true;
    const searchTerms = normalize(search).split(' ').filter(Boolean);
    const searchableText = getSearchableText(i.name);
    // All words in the search must be present in the searchable text
    return searchTerms.every(term => searchableText.includes(term));
  })

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

  const totalCost = selected.reduce((sum, s) => {
    if (actionType === 'ADD') {
      return sum + (parseInt(s.newTotalPrice || '0', 10) || 0)
    }
    return sum + s.item.price * s.qty
  }, 0)

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
          actionType,
          eventName: eventName.trim(),
          telegramId: userId,
          telegramName: displayName,
          date: selectedDate,
          items: selected.map(s => ({
            itemId: s.item.id,
            quantity: s.qty,
            totalPrice: actionType === 'ADD' ? (parseInt(s.newTotalPrice || '0', 10) || 0) : (s.item.price * s.qty)
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
            <div className={`w-10 h-10 rounded-xl ${actionType === 'TAKE' ? 'bg-brand-500/10 border-brand-500/20' : 'bg-emerald-500/10 border-emerald-500/20'} border flex items-center justify-center shadow-inner`}>
              <Package size={20} className={actionType === 'TAKE' ? 'text-brand-500' : 'text-emerald-500'} />
            </div>
            <div>
              <h1 className="font-bold text-lg text-zinc-900 leading-tight">{actionType === 'TAKE' ? 'Chiqim kiritish' : 'Qaytarish (Kirim)'}</h1>
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
              <div className="flex bg-zinc-200/50 p-1 rounded-xl mb-6 shadow-inner">
                <button 
                  onClick={() => setActionType('TAKE')}
                  className={`flex-1 py-2.5 text-sm font-bold rounded-lg transition-all ${actionType === 'TAKE' ? 'bg-white shadow-sm text-zinc-900' : 'text-zinc-500 hover:text-zinc-700'}`}
                >
                  Chiqim qilish
                </button>
                <button 
                  onClick={() => setActionType('ADD')}
                  className={`flex-1 py-2.5 text-sm font-bold rounded-lg transition-all ${actionType === 'ADD' ? 'bg-white shadow-sm text-zinc-900' : 'text-zinc-500 hover:text-zinc-700'}`}
                >
                  Qaytarish (Kirim)
                </button>
              </div>

              <div>
                <h2 className="text-2xl font-bold text-zinc-900 mb-1 tracking-tight">Qaysi tadbir?</h2>
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

              <div className="space-y-2">
                <label className="block text-zinc-500 text-xs font-bold uppercase tracking-widest ml-1 flex items-center gap-1.5">
                  <Calendar size={14} className="text-zinc-400" /> Sana tanlang
                </label>
                <input
                  type="date"
                  value={selectedDate}
                  onChange={e => setSelectedDate(e.target.value)}
                  className="w-full bg-white/70 backdrop-blur-md border border-white/80 shadow-sm rounded-2xl py-4 px-5 text-zinc-900 focus:outline-none focus:ring-2 focus:ring-brand-500/50 transition-all font-bold text-base"
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
                      <div className={`${actionType === 'TAKE' ? 'text-rose-500' : 'text-emerald-500'} font-bold text-sm mt-1`}>
                        {actionType === 'TAKE' ? '-' : '+'}{s.qty} {s.item.unit.toLowerCase()}
                      </div>
                    </div>
                    <div className="text-right">
                      {actionType === 'ADD' ? (
                        <div className="flex flex-col items-end gap-1">
                          <label className="text-[10px] text-zinc-400 font-bold uppercase tracking-widest">Jami Summa (UZS)</label>
                          <input 
                            type="number"
                            placeholder="Summa..."
                            value={s.newTotalPrice || ''}
                            onChange={(e) => {
                              setSelected(prev => prev.map(p => p.item.id === s.item.id ? { ...p, newTotalPrice: e.target.value } : p))
                            }}
                            className="w-28 text-right bg-white/50 border border-zinc-200 shadow-inner rounded-lg py-1 px-2 text-sm font-bold text-zinc-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 transition-all"
                          />
                        </div>
                      ) : (
                        <div className="font-bold text-zinc-900 text-base tracking-tight" suppressHydrationWarning>
                          {(s.item.price * s.qty).toLocaleString()} UZS
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              <div className={`${actionType === 'TAKE' ? 'bg-brand-500/5 border-brand-500/20' : 'bg-emerald-500/5 border-emerald-500/20'} border rounded-2xl p-6 shadow-inner relative overflow-hidden`}>
                <div className={`absolute top-0 right-0 w-32 h-32 ${actionType === 'TAKE' ? 'bg-brand-500/10' : 'bg-emerald-500/10'} rounded-full blur-3xl`}></div>
                <div className="flex justify-between items-center relative z-10">
                  <span className="text-zinc-600 text-sm font-bold tracking-wide uppercase">Jami summa</span>
                  <span className={`${actionType === 'TAKE' ? 'text-brand-600' : 'text-emerald-600'} font-black text-2xl tracking-tight`} suppressHydrationWarning>
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
                {actionType === 'TAKE' ? 'Chiqim' : 'Kirim'} saqlandi.<br />Oyna avtomatik yopiladi...
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
