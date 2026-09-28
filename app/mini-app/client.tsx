'use client'

import React, { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Package, ChevronRight, Check, AlertCircle, Minus, Plus, Search, Calendar, ArrowLeft, Mic, History, RotateCcw, Clock, MapPin, Users } from 'lucide-react'

type Item = {
  id: string
  name: string
  quantity: number
  unit: string
  price: number
  packSize: number
  packUnit: string
  packOnly?: boolean
}

type UnitMode = 'pack' | 'piece'

type SelectedItem = {
  item: Item
  qty: number
  mode: UnitMode
  newTotalPrice?: string
}

// Mahsulot pachkali bo'lsa (packSize > 1) ikkala birlik tanlanadi
const hasPack = (it: Item) => (it.packSize || 1) > 1
// "Faqat pachkada" belgilangan mahsulotda dona tanlovi umuman ko'rsatilmaydi
const isPackOnly = (it: Item) => hasPack(it) && Boolean(it.packOnly)
// Mahsulot uchun boshlang'ich birlik rejimi
const defaultMode = (it: Item): UnitMode => (isPackOnly(it) ? 'pack' : 'piece')
const unitName = (it: Item, mode: UnitMode) =>
  (mode === 'pack' ? it.packUnit : it.unit || 'dona')
// Tanlangan birlikdagi miqdorni bazaviy (dona) ga aylantirish
const toBase = (s: SelectedItem) =>
  s.mode === 'pack' ? s.qty * Math.max(1, s.item.packSize || 1) : s.qty
// Tanlangan birlikda mavjud maksimal miqdor
const maxFor = (it: Item, mode: UnitMode) =>
  mode === 'pack'
    ? Math.floor((it.quantity || 0) / Math.max(1, it.packSize || 1))
    : (it.quantity || 0)

type Step = 'event' | 'eventDetail' | 'items' | 'confirm' | 'done' | 'error' | 'history'

// ERP kalendaridagi tadbir + unga shu paytgacha nima olingani (server jamlaydi)
export type EventCard = {
  id: number
  name: string
  date: string        // YYYY-MM-DD
  start_time: string
  end_time: string
  hall: string
  guests: number
  status: string
  isToday: boolean
  lines: { name: string; taken: string; returned: string }[]
  takenValue: number
  lastAt: string | null   // oxirgi chiqim vaqti (HH:MM)
}

// Brauzerning bugungi sanasi (YYYY-MM-DD)
const todayLocal = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

const fmtSum = (n: number) => `${Math.round(n).toLocaleString('ru-RU')} so'm`

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

const blobToBase64 = (blob: Blob): Promise<string> =>
  new Promise((resolve, reject) => {
    const r = new FileReader()
    r.onloadend = () => resolve(String(r.result).split(',')[1] || '')
    r.onerror = reject
    r.readAsDataURL(blob)
  })

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

export default function MiniAppClient({
  items,
  recentEvents = [],
  eventCards = [],
  erpStatus = 'off',
}: {
  items: Item[]
  recentEvents?: string[]
  eventCards?: EventCard[]
  erpStatus?: 'ok' | 'off' | 'error'
}) {
  const router = useRouter()
  const [mounted, setMounted] = useState(false)
  const [actionType, setActionType] = useState<'TAKE' | 'ADD'>('TAKE')
  const [step, setStep] = useState<Step>('event')
  // Tadbir kartochkasidan kirilgan bo'lsa — ERP tadbir id'si. Kartochka
  // ma'lumoti props'dan olinadi, shunda router.refresh() dan keyin yangilanadi.
  const [activeEventId, setActiveEventId] = useState<number | null>(null)
  const [eventName, setEventName] = useState('')
  const [selected, setSelected] = useState<SelectedItem[]>([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')
  const [tgUser, setTgUser] = useState<{ id: string; name: string } | null>(null)
  const [manualName, setManualName] = useState('')
  const [listening, setListening] = useState(false)
  const [voiceMsg, setVoiceMsg] = useState('')
  const mediaRecRef = useRef<any>(null)
  const chunksRef = useRef<any[]>([])
  const [history, setHistory] = useState<any[]>([])
  const [histLoading, setHistLoading] = useState(false)
  const [histFilter, setHistFilter] = useState<string>('all')
  const [histSearch, setHistSearch] = useState('')
  const [cancelingId, setCancelingId] = useState<string | null>(null)
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
  // Telegram'siz (mustaqil PWA) — har bir xodim ismi bo'yicha alohida foydalanuvchi
  const userId = tgUser?.id || (manualName.trim()
    ? `web_${manualName.trim().toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '')}`
    : 'web_guest')

  const activeEvent = activeEventId !== null
    ? eventCards.find(e => e.id === activeEventId) ?? null
    : null
  const todayCards = eventCards.filter(e => e.isToday)
  const yesterdayCards = eventCards.filter(e => !e.isToday)
  const needName = !tgUser && !manualName.trim()

  const openEvent = (ev: EventCard) => {
    setActiveEventId(ev.id)
    setStep('eventDetail')
  }

  // Bosh sahifaga — kartochka tanlovini va uning sanasini tozalaymiz
  const goHome = () => {
    setActiveEventId(null)
    setSelected([])
    setSearch('')
    setEventName('')
    setSelectedDate(todayLocal())
    setStep('event')
  }

  // Kartochkadan chiqim/qaytarish: tadbir nomi va SANASI avtomatik —
  // kechagi tadbirga ertasi kuni yozilsa ham o'z kuniga tushadi.
  const startForEvent = (ev: EventCard, type: 'TAKE' | 'ADD') => {
    if (needName) return
    if (!tgUser && manualName.trim()) localStorage.setItem('sklad_user_name', manualName.trim())
    setActionType(type)
    setEventName(ev.name)
    setSelectedDate(ev.date)
    setSelected([])
    setSearch('')
    setStep('items')
  }

  const renderEventCard = (ev: EventCard) => {
    const empty = ev.lines.length === 0
    return (
      <button
        key={ev.id}
        onClick={() => openEvent(ev)}
        className="w-full text-left bg-white/80 backdrop-blur-md border border-white/90 rounded-3xl p-5 shadow-sm active:scale-[0.98] transition-all"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 text-xs font-bold text-brand-600">
              <Clock size={13} /> {ev.start_time}{ev.end_time ? `–${ev.end_time}` : ''}
            </div>
            <div className="mt-1 text-lg font-black text-zinc-900 leading-tight break-words">{ev.name}</div>
            <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs font-medium text-zinc-500">
              {ev.hall && <span className="flex items-center gap-1"><MapPin size={12} />{ev.hall}</span>}
              {ev.guests > 0 && <span className="flex items-center gap-1"><Users size={12} />{ev.guests} kishi</span>}
            </div>
          </div>
          <ChevronRight size={20} className="text-zinc-300 shrink-0 mt-1" />
        </div>
        <div className={`mt-4 px-3.5 py-2.5 rounded-2xl text-xs font-bold border ${
          empty
            ? 'bg-amber-500/10 text-amber-700 border-amber-500/20'
            : 'bg-emerald-500/10 text-emerald-700 border-emerald-500/20'
        }`}>
          {empty
            ? "Hali chiqim qilinmagan — bosib qo'shing"
            : `${ev.lines.length} xil mahsulot olingan${ev.lastAt ? ` · oxirgisi ${ev.lastAt}` : ''}`}
        </div>
      </button>
    )
  }

  // Tadbir tugmalari: "Impulse" doim + oxirgi kiritilgan nomlar (bazadan)
  const eventPresets = ['Impulse', ...recentEvents
    .map(e => (e || '').trim())
    .filter(e => e && e.toLowerCase() !== 'impulse')
  ].slice(0, 5)

  // Gemini natijasini formaga to'ldirish
  const applyVoice = (d: any) => {
    if (d.action === 'ADD' || d.action === 'TAKE') setActionType(d.action)
    if (d.eventName) setEventName(String(d.eventName))
    if (typeof d.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d.date)) setSelectedDate(d.date)
    const newSel: SelectedItem[] = []
    for (const it of (d.items || [])) {
      const qty = Math.max(1, parseInt(String(it.quantity ?? 1), 10) || 1)
      let match = items.find(i => i.name === it.itemName)
      if (!match) {
        const t = normalize(String(it.itemName || ''))
        if (t) match = items.find(i => { const n = normalize(i.name); return n.includes(t) || t.includes(n) })
      }
      if (match && !newSel.find(s => s.item.id === match!.id)) {
        newSel.push({ item: match, qty, mode: defaultMode(match) })
      }
    }
    if (newSel.length === 0) {
      setVoiceMsg(`"${d.transcript || ''}" — mahsulot topilmadi. Qo'lda tanlang.`)
      setStep('items')
      return
    }
    setSelected(newSel)
    setVoiceMsg('')
    setStep(d.eventName ? 'confirm' : 'event')
  }

  // 📋 Amallar tarixi: yuklash + bekor qilish
  const loadHistory = async (type: string) => {
    setHistLoading(true)
    try {
      const qs = type === 'TAKE' || type === 'ADD' ? `?type=${type}` : ''
      const res = await fetch(`${window.location.origin}/api/mini-app/history${qs}`)
      const d = await res.json()
      setHistory(Array.isArray(d.rows) ? d.rows : [])
    } catch { setHistory([]) }
    setHistLoading(false)
  }
  const openHistory = () => { setHistFilter('all'); setHistSearch(''); setStep('history'); loadHistory('all') }
  const cancelTx = async (id: string) => {
    if (cancelingId) return
    if (!window.confirm('Bu amal bekor qilinsinmi? Qoldiq tiklanadi.')) return
    setCancelingId(id)
    try {
      const res = await fetch(`${window.location.origin}/api/mini-app/history`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ txId: id }),
      })
      const d = await res.json()
      if (d.success) setHistory(prev => prev.filter(r => r.id !== id))
      else alert(d.error || 'Bekor qilinmadi')
    } catch { alert("Server bilan aloqa yo'q") }
    setCancelingId(null)
  }

  // 🎤 Ovozli kiritish — OpenAI eshitadi (ovoz→matn), Claude tushunadi.
  // Bir marta bosib boshlanadi, yana bosib to'xtaydi (yoki 20s da avto).
  const startVoice = async () => {
    if (listening) {
      try { mediaRecRef.current?.stop() } catch {}
      return
    }
    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      setVoiceMsg("Bu qurilma mikrofonni qo'llamaydi. Qo'lda kiriting.")
      return
    }
    let stream: MediaStream
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true })
    } catch {
      setVoiceMsg("Mikrofonga ruxsat berilmadi. Sozlamalardan ruxsat bering.")
      return
    }
    let mr: MediaRecorder
    try {
      mr = new MediaRecorder(stream)
    } catch {
      stream.getTracks().forEach(t => t.stop())
      setVoiceMsg("Ovoz yozib bo'lmadi.")
      return
    }
    chunksRef.current = []
    mr.ondataavailable = (e: BlobEvent) => { if (e.data && e.data.size) chunksRef.current.push(e.data) }
    mr.onstop = async () => {
      stream.getTracks().forEach(t => t.stop())
      setListening(false)
      const blob = new Blob(chunksRef.current, { type: mr.mimeType || 'audio/webm' })
      if (blob.size < 800) { setVoiceMsg("Ovoz juda qisqa — qaytadan urinib ko'ring."); return }
      setVoiceMsg('Tahlil qilinmoqda…')
      try {
        const b64 = await blobToBase64(blob)
        const res = await fetch(`${window.location.origin}/api/mini-app/voice`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ audio: b64, mimeType: blob.type, events: eventPresets }),
        })
        const d = await res.json()
        if (d.error) {
          setVoiceMsg(
            d.needKey === 'openai' ? "Ovoz kaliti sozlanmagan. (Admin: Railway'ga OPENAI_API_KEY qo'shsin.)"
            : d.needKey === 'anthropic' ? "AI kaliti sozlanmagan. (Admin: Railway'ga ANTHROPIC_API_KEY qo'shsin.)"
            : `Tushunilmadi${d.transcript ? `: "${d.transcript}"` : ''}. Qaytadan ayting yoki qo'lda kiriting.`)
          return
        }
        applyVoice(d)
      } catch {
        setVoiceMsg("Server bilan aloqa yo'q.")
      }
    }
    mediaRecRef.current = mr
    setVoiceMsg("Tinglanmoqda… (to'xtatish uchun yana bosing)")
    setListening(true)
    try {
      mr.start()
      setTimeout(() => { if (mr.state === 'recording') { try { mr.stop() } catch {} } }, 20000)
    } catch {
      setListening(false)
      setVoiceMsg("Ovoz yozib bo'lmadi.")
    }
  }

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
      return [...prev, { item, qty: 1, mode: defaultMode(item) }]
    })
  }

  const changeQty = (itemId: string, delta: number) => {
    setSelected(prev => prev.map(s => {
      if (s.item.id !== itemId) return s
      const max = Math.max(1, maxFor(s.item, s.mode))
      const newQty = Math.max(1, Math.min(max, s.qty + delta))
      return { ...s, qty: newQty }
    }))
  }

  const setItemMode = (itemId: string, mode: UnitMode) => {
    setSelected(prev => prev.map(s => {
      if (s.item.id !== itemId) return s
      const max = Math.max(1, maxFor(s.item, mode))
      return { ...s, mode, qty: Math.max(1, Math.min(s.qty, max)) }
    }))
  }

  const totalCost = selected.reduce((sum, s) => {
    if (actionType === 'ADD') {
      return sum + (parseInt(s.newTotalPrice || '0', 10) || 0)
    }
    return sum + s.item.price * toBase(s)
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
          erpEventId: activeEventId,
          items: selected.map(s => ({
            itemId: s.item.id,
            quantity: s.qty,
            unitMode: s.mode,
            totalPrice: actionType === 'ADD' ? (parseInt(s.newTotalPrice || '0', 10) || 0) : (s.item.price * toBase(s))
          }))
        })
      })
      const data = await res.json()
      if (data.success) {
        setStep('done')
        if (activeEventId !== null) {
          // Tadbir kartochkasidan: oyna yopilmaydi — kartochkaga qaytamiz va
          // ro'yxatni yangilaymiz, kun bo'yi yana qo'shish bir bosishda bo'lsin.
          router.refresh()
          setTimeout(() => {
            setSelected([])
            setSearch('')
            setActionType('TAKE')
            setStep('eventDetail')
          }, 1400)
        } else {
          setTimeout(() => window.Telegram?.WebApp?.close(), 2500)
        }
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
            {(step === 'eventDetail' || step === 'items' || step === 'confirm') && (
              <button
                onClick={() => {
                  if (step === 'confirm') setStep('items')
                  else if (step === 'items' && activeEvent) setStep('eventDetail')
                  else goHome()
                }}
                aria-label="Orqaga"
                className="w-10 h-10 rounded-xl bg-white/70 border border-white/80 shadow-sm flex items-center justify-center text-zinc-600 active:scale-95 transition-all shrink-0"
              >
                <ArrowLeft size={20} />
              </button>
            )}
            <div className={`w-10 h-10 rounded-xl ${actionType === 'TAKE' ? 'bg-brand-500/10 border-brand-500/20' : 'bg-emerald-500/10 border-emerald-500/20'} border flex items-center justify-center shadow-inner shrink-0`}>
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
                  ['event', 'items', 'confirm'].indexOf(step === 'eventDetail' ? 'event' : step) >= i ? 'bg-brand-500 shadow-[0_0_10px_rgba(99,102,241,0.3)]' : 'bg-zinc-900/10'
                }`} />
              </React.Fragment>
            ))}
          </div>
        </div>

        <div className="px-5 py-6">

          {/* STEP 1: Event Name */}
          {step === 'event' && (
            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-300">
              {/* ERP kalendaridagi tadbirlar — ochilganda birinchi ko'rinadigan narsa */}
              {erpStatus !== 'off' && (
                <div className="space-y-3">
                  <div className="flex items-end justify-between">
                    <h2 className="text-2xl font-bold text-zinc-900 tracking-tight">Bugungi tadbirlar</h2>
                    {todayCards.length > 0 && (
                      <span className="text-xs font-bold text-zinc-400">{todayCards.length} ta</span>
                    )}
                  </div>
                  {todayCards.map(renderEventCard)}
                  {erpStatus === 'ok' && todayCards.length === 0 && (
                    <div className="text-sm font-medium text-zinc-500 bg-white/60 border border-white/80 rounded-2xl px-4 py-3">
                      Bugun kalendarda tadbir yo'q.
                    </div>
                  )}
                  {erpStatus === 'error' && (
                    <div className="text-sm font-medium text-amber-700 bg-amber-500/10 border border-amber-500/20 rounded-2xl px-4 py-3">
                      Kalendar yuklanmadi. Tadbirni pastda qo'lda tanlang.
                    </div>
                  )}
                  {yesterdayCards.length > 0 && (
                    <div className="pt-2 space-y-3">
                      <h3 className="text-xs font-bold text-zinc-500 uppercase tracking-widest ml-1">Kechagi tadbirlar</h3>
                      {yesterdayCards.map(renderEventCard)}
                    </div>
                  )}
                  <div className="pt-4 flex items-center gap-3">
                    <div className="h-px flex-1 bg-zinc-900/10" />
                    <span className="text-[11px] font-bold text-zinc-400 uppercase tracking-widest text-center">Boshqa tadbir yoki ichki ehtiyoj</span>
                    <div className="h-px flex-1 bg-zinc-900/10" />
                  </div>
                </div>
              )}

              <button
                onClick={openHistory}
                className="w-full py-3 rounded-2xl bg-white/60 border border-white/80 text-zinc-600 font-bold text-xs flex items-center justify-center gap-2 active:scale-[0.98] transition-all shadow-sm"
              >
                <History size={15} /> Amallar tarixi · bekor qilish
              </button>
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

              <button
                onClick={startVoice}
                className={`w-full py-4 rounded-2xl font-bold text-sm flex items-center justify-center gap-2 transition-all shadow-sm border ${
                  listening
                    ? 'bg-rose-500/10 border-rose-500/30 text-rose-600 animate-pulse'
                    : 'bg-gradient-to-r from-brand-500/10 to-violet-500/10 border-brand-500/30 text-brand-600 active:scale-[0.98]'
                }`}
              >
                <Mic size={18} /> {listening ? "⏹ Tinglanmoqda… (bosib to'xtating)" : '🎤 Ovozli kiritish'}
              </button>
              {voiceMsg && (
                <div className="text-xs font-medium text-zinc-600 bg-white/70 border border-white/80 rounded-xl px-4 py-3 leading-relaxed">
                  {voiceMsg}
                </div>
              )}

              <div>
                <h2 className="text-2xl font-bold text-zinc-900 mb-1 tracking-tight">Qaysi tadbir?</h2>
                <p className="text-zinc-500 text-sm font-medium">Yoki tadbir nomini tanlang / kiriting</p>
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
                {eventPresets.map(preset => (
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
                  value={!eventPresets.includes(eventName) ? eventName : ''}
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

          {/* TADBIR KARTOCHKASI: nima olingan + chiqim qo'shish */}
          {step === 'eventDetail' && (
            activeEvent ? (
              <div className="space-y-5 animate-in fade-in slide-in-from-bottom-4 duration-300">
                <div className="bg-white/80 backdrop-blur-md border border-white/90 rounded-3xl p-5 shadow-sm">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-brand-600">
                    <Clock size={13} /> {activeEvent.isToday ? 'Bugun' : 'Kecha'} · {activeEvent.start_time}{activeEvent.end_time ? `–${activeEvent.end_time}` : ''}
                  </div>
                  <h2 className="mt-1 text-2xl font-black text-zinc-900 leading-tight break-words">{activeEvent.name}</h2>
                  <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs font-medium text-zinc-500">
                    {activeEvent.hall && <span className="flex items-center gap-1"><MapPin size={12} />{activeEvent.hall}</span>}
                    {activeEvent.guests > 0 && <span className="flex items-center gap-1"><Users size={12} />{activeEvent.guests} kishi</span>}
                  </div>
                </div>

                {needName && (
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

                <button
                  onClick={() => startForEvent(activeEvent, 'TAKE')}
                  disabled={needName}
                  className="w-full py-5 rounded-2xl bg-gradient-to-r from-brand-500 to-violet-500 text-white font-black text-base uppercase tracking-widest disabled:opacity-50 active:scale-[0.98] transition-all flex items-center justify-center gap-2 shadow-[0_8px_20px_rgba(99,102,241,0.3)]"
                >
                  <Plus size={20} strokeWidth={3} /> Chiqim qo'shish
                </button>

                <div>
                  <h3 className="text-xs font-bold text-zinc-500 uppercase tracking-widest ml-1 mb-2">Olingan narsalar</h3>
                  {activeEvent.lines.length === 0 ? (
                    <div className="bg-amber-500/10 border border-amber-500/20 text-amber-700 rounded-2xl px-4 py-4 text-sm font-medium">
                      Bu tadbirga hali hech narsa chiqim qilinmagan.
                    </div>
                  ) : (
                    <div className="bg-white/80 backdrop-blur-md border border-white/90 rounded-3xl shadow-sm divide-y divide-zinc-900/5">
                      {activeEvent.lines.map(l => (
                        <div key={l.name} className="px-4 py-3 flex items-start justify-between gap-3">
                          <span className="font-bold text-zinc-800 text-sm break-words min-w-0">{l.name}</span>
                          <span className="text-right shrink-0">
                            {l.taken && <span className="block text-sm font-black text-brand-600">{l.taken}</span>}
                            {l.returned && <span className="block text-[11px] font-bold text-emerald-600">{l.returned} qaytdi</span>}
                          </span>
                        </div>
                      ))}
                      {activeEvent.takenValue > 0 && (
                        <div className="px-4 py-3 flex items-center justify-between text-sm">
                          <span className="font-bold text-zinc-500">Jami chiqim</span>
                          <span className="font-black text-zinc-900">{fmtSum(activeEvent.takenValue)}</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <button
                  onClick={() => startForEvent(activeEvent, 'ADD')}
                  disabled={needName}
                  className="w-full py-3.5 rounded-2xl bg-white/70 border border-white/90 text-emerald-700 font-bold text-sm disabled:opacity-50 active:scale-[0.98] transition-all flex items-center justify-center gap-2 shadow-sm"
                >
                  <RotateCcw size={16} /> Ortib qolganini qaytarish
                </button>
              </div>
            ) : (
              <div className="text-center py-16 space-y-4">
                <p className="text-zinc-500 font-medium">Bu tadbir kalendardan topilmadi.</p>
                <button
                  onClick={goHome}
                  className="px-6 py-3 rounded-2xl bg-white/70 border border-white/90 text-zinc-700 font-bold text-sm shadow-sm"
                >
                  Bosh sahifaga
                </button>
              </div>
            )
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
                          <div className="text-xs font-medium text-zinc-500 mt-1">
                            {isPackOnly(item) ? (
                              // Faqat pachkada chiqadigan mahsulotda qoldiq ham pachkada ko'rsatiladi
                              <>
                                {maxFor(item, 'pack')} {item.packUnit} qoldi
                                <span className="text-zinc-400"> · {item.quantity} {(item.unit || 'dona').toLowerCase()}</span>
                              </>
                            ) : (
                              <>
                                {item.quantity} {(item.unit || 'dona').toLowerCase()} qoldi
                                {hasPack(item) && (
                                  <span className="text-zinc-400"> · {maxFor(item, 'pack')} {item.packUnit}</span>
                                )}
                              </>
                            )}
                          </div>
                        </div>
                        <div className={`w-6 h-6 rounded-full flex items-center justify-center transition-all ${
                          sel ? 'bg-brand-500 border-none' : 'border-2 border-zinc-300'
                        }`}>
                          {sel && <Check size={14} className="text-white" strokeWidth={3} />}
                        </div>
                      </button>

                      {sel && (
                        <div className="px-4 pb-4 pt-1 space-y-3 animate-in fade-in slide-in-from-top-2 duration-200">
                          {isPackOnly(item) && (
                            <div className="text-center text-[11px] font-bold text-zinc-500 bg-zinc-200/50 py-2 rounded-xl shadow-inner">
                              Faqat {item.packUnit} ({item.packSize} {(item.unit || 'dona').toLowerCase()})
                            </div>
                          )}
                          {hasPack(item) && !isPackOnly(item) && (
                            <div className="flex bg-zinc-200/50 p-1 rounded-xl shadow-inner">
                              <button
                                onClick={() => setItemMode(item.id, 'piece')}
                                className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${sel.mode === 'piece' ? 'bg-white shadow-sm text-zinc-900' : 'text-zinc-500'}`}
                              >
                                {item.unit || 'dona'}
                              </button>
                              <button
                                onClick={() => setItemMode(item.id, 'pack')}
                                className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${sel.mode === 'pack' ? 'bg-white shadow-sm text-zinc-900' : 'text-zinc-500'}`}
                              >
                                {item.packUnit} ({item.packSize} {item.unit || 'dona'})
                              </button>
                            </div>
                          )}
                          <div className="flex items-center gap-4">
                            <button
                              onClick={() => changeQty(item.id, -1)}
                              className="w-10 h-10 rounded-xl bg-white shadow-sm border border-zinc-200 flex items-center justify-center active:scale-95 transition-all text-zinc-600 hover:bg-zinc-50"
                            >
                              <Minus size={18} />
                            </button>
                            <span className="flex-1 text-center font-bold text-xl text-zinc-900">
                              {sel.qty} <span className="text-sm text-zinc-500 font-medium">{unitName(item, sel.mode).toLowerCase()}</span>
                              {hasPack(item) && sel.mode === 'pack' && (
                                <span className="block text-[11px] text-zinc-400 font-medium mt-0.5">= {sel.qty * Math.max(1, item.packSize)} {(item.unit || 'dona').toLowerCase()}</span>
                              )}
                            </span>
                            <button
                              onClick={() => changeQty(item.id, 1)}
                              className="w-10 h-10 rounded-xl bg-white shadow-sm border border-zinc-200 flex items-center justify-center active:scale-95 transition-all text-zinc-600 hover:bg-zinc-50"
                            >
                              <Plus size={18} />
                            </button>
                          </div>
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

              <div className="flex items-center gap-3 bg-white/70 backdrop-blur-md border border-white/80 shadow-sm rounded-2xl px-4 py-3">
                <Calendar size={18} className="text-brand-500 shrink-0" />
                <label className="text-sm font-bold text-zinc-600 shrink-0">Sana:</label>
                <input
                  type="date"
                  value={selectedDate}
                  onChange={e => setSelectedDate(e.target.value)}
                  className="flex-1 bg-transparent text-zinc-900 font-bold text-base focus:outline-none"
                />
              </div>

              <div className="space-y-3">
                {selected.map(s => (
                  <div key={s.item.id} className="bg-white/70 backdrop-blur-md border border-white/80 shadow-sm rounded-2xl p-5 flex justify-between items-center">
                    <div>
                      <div className="font-bold text-zinc-800 text-base tracking-tight">{s.item.name}</div>
                      <div className={`${actionType === 'TAKE' ? 'text-rose-500' : 'text-emerald-500'} font-bold text-sm mt-1`}>
                        {actionType === 'TAKE' ? '-' : '+'}{s.qty} {unitName(s.item, s.mode).toLowerCase()}
                        {s.mode === 'pack' && (
                          <span className="text-zinc-400 font-medium"> (= {toBase(s)} {(s.item.unit || 'dona').toLowerCase()})</span>
                        )}
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
                          {(s.item.price * toBase(s)).toLocaleString()} UZS
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

          {/* AMALLAR TARIXI — filtr + bekor qilish */}
          {step === 'history' && (
            <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-300">
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setStep('event')}
                  aria-label="Orqaga"
                  className="w-10 h-10 rounded-xl bg-white/70 border border-white/80 shadow-sm flex items-center justify-center text-zinc-600 active:scale-95 transition-all shrink-0"
                >
                  <ArrowLeft size={20} />
                </button>
                <h2 className="text-2xl font-bold text-zinc-900 tracking-tight">Amallar tarixi</h2>
              </div>

              <div className="flex gap-2">
                {(([['all', 'Hammasi'], ['TAKE', 'Chiqim'], ['ADD', 'Kirim']]) as [string, string][]).map(([k, label]) => (
                  <button
                    key={k}
                    onClick={() => { setHistFilter(k); loadHistory(k) }}
                    className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all border ${histFilter === k ? 'bg-brand-500 text-white border-brand-500 shadow-sm' : 'bg-white/60 text-zinc-500 border-white/80'}`}
                  >
                    {label}
                  </button>
                ))}
              </div>

              <div className="relative">
                <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400" />
                <input
                  value={histSearch}
                  onChange={e => setHistSearch(e.target.value)}
                  placeholder="Mahsulot yoki tadbir..."
                  className="w-full bg-white/70 border border-white/80 shadow-sm rounded-2xl py-3 pl-11 pr-4 text-sm font-medium text-zinc-900 placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-brand-500/40"
                />
              </div>

              {histLoading ? (
                <div className="flex justify-center py-12">
                  <div className="w-7 h-7 rounded-full border-4 border-brand-500 border-t-transparent animate-spin"></div>
                </div>
              ) : (
                <div className="space-y-2 pb-8">
                  {history.filter(r => {
                    const s = histSearch.trim().toLowerCase()
                    if (!s) return true
                    return (r.itemName || '').toLowerCase().includes(s) || (r.eventName || '').toLowerCase().includes(s) || (r.userName || '').toLowerCase().includes(s)
                  }).map(r => {
                    const isTake = r.type === 'TAKE'
                    const abs = Math.abs(r.quantity)
                    const dt = new Date(r.createdAt)
                    const dateStr = dt.toLocaleDateString('uz-UZ', { day: '2-digit', month: '2-digit' }) + ' ' + dt.toLocaleTimeString('uz-UZ', { hour: '2-digit', minute: '2-digit' })
                    return (
                      <div key={r.id} className="bg-white/70 backdrop-blur-md border border-white/80 shadow-sm rounded-2xl p-4 flex items-center gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="font-bold text-zinc-800 text-sm truncate">{r.itemName}</div>
                          <div className={`${isTake ? 'text-rose-500' : 'text-emerald-500'} font-bold text-sm`}>
                            {isTake ? '−' : '+'}{abs} {(r.unit || 'dona').toLowerCase()}
                          </div>
                          <div className="text-[11px] text-zinc-400 truncate mt-0.5">
                            {r.eventName || '—'} · {dateStr}{r.userName ? ' · ' + r.userName : ''}
                          </div>
                        </div>
                        <button
                          onClick={() => cancelTx(r.id)}
                          disabled={cancelingId === r.id}
                          className="shrink-0 px-3 py-2 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-600 font-bold text-xs flex items-center gap-1 active:scale-95 transition-all disabled:opacity-50"
                        >
                          {cancelingId === r.id ? '…' : <><RotateCcw size={13} /> Bekor</>}
                        </button>
                      </div>
                    )
                  })}
                  {history.length === 0 && (
                    <div className="text-center text-zinc-400 text-sm py-12">Amallar yo'q</div>
                  )}
                </div>
              )}
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
                {actionType === 'TAKE' ? 'Chiqim' : 'Kirim'} saqlandi.
                {activeEvent
                  ? <><br />Tadbir kartochkasiga qaytilmoqda...</>
                  : tgUser ? <><br />Oyna avtomatik yopiladi...</> : ''}
              </p>
              {!tgUser && !activeEvent && (
                <button
                  onClick={goHome}
                  className="mt-4 px-8 py-4 rounded-2xl bg-gradient-to-r from-brand-500 to-violet-500 text-white font-bold text-sm uppercase tracking-widest active:scale-[0.98] transition-all shadow-[0_8px_20px_rgba(99,102,241,0.3)]"
                >
                  Yangi amal
                </button>
              )}
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
