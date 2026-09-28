'use client'

import React, { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, Minus, Search, Mic, ChevronLeft, Clock, MapPin, Users, History, RotateCcw, X, Home, CalendarDays } from 'lucide-react'

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
type Mode = 'TAKE' | 'ADD'

type SelectedItem = {
  item: Item
  qty: number
  mode: UnitMode
}

// "Kun davomida" yozuvi — bitta "Saqlash" (bir nechta mahsulot bo'lishi mumkin)
export type EventEntry = {
  key: string
  ids: string[]          // shu yozuvning tranzaksiyalari (bekor qilish uchun)
  at: string             // HH:MM (Toshkent)
  type: Mode
  who: string
  whoId: string          // telegramId — kim yozgani (o'zinikini bekor qila oladi)
  text: string
}

// ERP kalendaridagi tadbir + unga shu paytgacha nima olingani (server jamlaydi)
export type EventCard = {
  id: number
  name: string        // kalendardagi nom (mijoz)
  type?: string       // tadbir turi
  date: string        // YYYY-MM-DD
  start_time: string
  end_time: string
  hall: string
  guests: number
  status: string
  isToday: boolean
  lines: { name: string; taken: string; returned: string }[]
  takenKinds: number
  netValue: number    // olingan − qaytarilgan (so'm)
  txCount: number
  people: number
  lastAt: string | null
  entries: EventEntry[]
}

// Mahsulot oynasi kimga yozadi: kalendardagi tadbirga yoki boshqa ehtiyojga
type Target = { kind: 'event'; eventId: number } | { kind: 'other' }

// ── Birlik yordamchilari ──
const hasPack = (it: Item) => (it.packSize || 1) > 1
const isPackOnly = (it: Item) => hasPack(it) && Boolean(it.packOnly)
const defaultMode = (it: Item): UnitMode => (isPackOnly(it) ? 'pack' : 'piece')
const unitName = (it: Item, mode: UnitMode) => (mode === 'pack' ? it.packUnit : it.unit || 'dona').toLowerCase()
const toBase = (s: SelectedItem) => (s.mode === 'pack' ? s.qty * Math.max(1, s.item.packSize || 1) : s.qty)
const maxFor = (it: Item, mode: UnitMode) =>
  mode === 'pack' ? Math.floor((it.quantity || 0) / Math.max(1, it.packSize || 1)) : it.quantity || 0
const stockText = (it: Item) =>
  isPackOnly(it)
    ? `${maxFor(it, 'pack')} ${it.packUnit.toLowerCase()} qoldi`
    : `${it.quantity} ${(it.unit || 'dona').toLowerCase()} qoldi`

const todayLocal = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
const WEEKDAYS = ['Yakshanba', 'Dushanba', 'Seshanba', 'Chorshanba', 'Payshanba', 'Juma', 'Shanba']
const MONTHS = ['yanvar', 'fevral', 'mart', 'aprel', 'may', 'iyun', 'iyul', 'avgust', 'sentabr', 'oktabr', 'noyabr', 'dekabr']
const todayHuman = () => {
  const d = new Date()
  return `${WEEKDAYS[d.getDay()]}, ${d.getDate()}-${MONTHS[d.getMonth()]}`
}
const fmtSum = (n: number) => `${Math.round(n).toLocaleString('ru-RU')} so'm`
const timeRange = (ev: EventCard) => `${ev.start_time}${ev.end_time ? `–${ev.end_time}` : ''}`

// ── Qidiruv (kirill → lotin, sinonimlar) ──
const cyrillicToLatinMap: Record<string, string> = {
  'а':'a', 'б':'b', 'в':'v', 'г':'g', 'д':'d', 'е':'e', 'ё':'yo', 'ж':'j', 'з':'z',
  'и':'i', 'й':'y', 'к':'k', 'л':'l', 'м':'m', 'н':'n', 'о':'o', 'п':'p', 'р':'r',
  'с':'s', 'т':'t', 'у':'u', 'ф':'f', 'х':'x', 'ц':'ts', 'ч':'ch', 'ш':'sh', 'щ':'shch',
  'ъ':'', 'ы':'i', 'ь':'', 'э':'e', 'ю':'yu', 'я':'ya', 'ў':'o', 'қ':'q', 'ғ':'g', 'ҳ':'h'
}

const normalize = (text: string) => {
  let res = ''
  for (const char of text.toLowerCase()) res += cyrillicToLatinMap[char] || char
  return res.replace(/[^a-z0-9 ]/g, '')
}

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
}

const getSearchableText = (itemName: string) => {
  const normName = normalize(itemName)
  const extras: string[] = []
  for (const [key, keywords] of Object.entries(itemKeywords)) {
    if (normName.includes(key)) extras.push(...keywords.map(normalize))
  }
  return normName + ' ' + extras.join(' ')
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
  frequentIds = [],
}: {
  items: Item[]
  recentEvents?: string[]
  eventCards?: EventCard[]
  erpStatus?: 'ok' | 'off' | 'error'
  frequentIds?: string[]
}) {
  const router = useRouter()
  const [mounted, setMounted] = useState(false)
  const [tgUser, setTgUser] = useState<{ id: string; name: string } | null>(null)
  const [manualName, setManualName] = useState('')
  // Tasdiqlangan ism (localStorage'da). manualName — yozilayotgan qiymat;
  // ular alohida, aks holda birinchi harfdayoq maydon yo'qolib qolardi.
  const [savedName, setSavedName] = useState('')
  const [nameNudge, setNameNudge] = useState(false)

  // Ekranlar: Bugun · tadbir sahifasi · tarix. Mahsulot oynasi ustidan ochiladi.
  const [view, setView] = useState<'today' | 'event' | 'history'>('today')
  const [activeEventId, setActiveEventId] = useState<number | null>(null)

  // Mahsulot oynasi
  const [sheet, setSheet] = useState<{ target: Target; mode: Mode } | null>(null)
  const [basket, setBasket] = useState<SelectedItem[]>([])
  const [qtyDraft, setQtyDraft] = useState<Record<string, string>>({})
  const [search, setSearch] = useState('')
  const [otherName, setOtherName] = useState('')
  const [otherDate, setOtherDate] = useState(todayLocal)
  const [saving, setSaving] = useState(false)
  const [sheetError, setSheetError] = useState('')

  const [toast, setToast] = useState<{ text: string; kind: 'ok' | 'err' } | null>(null)
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Tadbir sahifasidagi bekor qilish (ikki bosqichli)
  const [undoKey, setUndoKey] = useState<string | null>(null)
  const [undoing, setUndoing] = useState(false)

  // Ovoz
  const [listening, setListening] = useState(false)
  const [voiceMsg, setVoiceMsg] = useState('')
  const mediaRecRef = useRef<any>(null)
  const chunksRef = useRef<any[]>([])

  // Tarix
  const [history, setHistory] = useState<any[]>([])
  const [histLoading, setHistLoading] = useState(false)
  const [histFilter, setHistFilter] = useState<string>('all')
  const [histSearch, setHistSearch] = useState('')
  const [cancelingId, setCancelingId] = useState<string | null>(null)

  useEffect(() => {
    setMounted(true)
    // Botdagi "Tadbir tugadi" eslatmasidan kelinsa (?event=ID) — darhol shu tadbir
    const wanted = Number(new URLSearchParams(window.location.search).get('event'))
    if (wanted && eventCards.some(e => e.id === wanted)) {
      setActiveEventId(wanted)
      setView('event')
    }
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
    try {
      const stored = localStorage.getItem('sklad_user_name')
      if (stored) { setManualName(stored); setSavedName(stored) }
    } catch {}
  }, [])

  // Mahsulot oynasi ochiqligida orqa sahifa aylanmasin
  useEffect(() => {
    if (!sheet) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = prev }
  }, [sheet])

  if (!mounted) {
    return (
      <div className="min-h-screen bg-[#f4f5f9] flex items-center justify-center">
        <div className="w-8 h-8 rounded-full border-4 border-brand-500 border-t-transparent animate-spin"></div>
      </div>
    )
  }

  const webName = (savedName || manualName).trim()
  const displayName = tgUser?.name || savedName
  // Telegram'siz (mustaqil PWA) — har bir xodim ismi bo'yicha alohida foydalanuvchi
  const userId = tgUser?.id || (webName
    ? `web_${webName.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '')}`
    : 'web_guest')
  const needName = !tgUser && !savedName

  const todayCards = eventCards.filter(e => e.isToday)
  const yesterdayCards = eventCards.filter(e => !e.isToday)
  const missing = todayCards.filter(e => e.takenKinds === 0).length
  const activeEvent = activeEventId !== null ? eventCards.find(e => e.id === activeEventId) ?? null : null
  const sheetEvent = sheet?.target.kind === 'event'
    ? eventCards.find(e => e.id === (sheet.target as { eventId: number }).eventId) ?? null
    : null

  const eventPresets = ['Impulse', ...recentEvents
    .map(e => (e || '').trim())
    .filter(e => e && e.toLowerCase() !== 'impulse')
  ].slice(0, 5)

  const showToast = (text: string, kind: 'ok' | 'err' = 'ok') => {
    setToast({ text, kind })
    if (toastTimer.current) clearTimeout(toastTimer.current)
    toastTimer.current = setTimeout(() => setToast(null), 2600)
  }

  // Ismni tasdiqlaydi; muvaffaqiyatli bo'lsa true
  const saveName = () => {
    const n = manualName.trim()
    if (!n) return false
    try { localStorage.setItem('sklad_user_name', n) } catch {}
    setSavedName(n)
    setNameNudge(false)
    return true
  }

  // ── Navigatsiya ──
  const openEvent = (ev: EventCard) => {
    setActiveEventId(ev.id)
    setUndoKey(null)
    setView('event')
    window.scrollTo(0, 0)
  }
  const goToday = () => {
    setView('today')
    setActiveEventId(null)
    setUndoKey(null)
    window.scrollTo(0, 0)
  }
  const openHistory = () => {
    setView('history')
    setHistFilter('all')
    setHistSearch('')
    loadHistory('all')
    window.scrollTo(0, 0)
  }

  const openSheet = (target: Target, mode: Mode = 'TAKE', otherPreset = '') => {
    // Ism yozilgan-u hali tasdiqlanmagan bo'lsa — shu yerda tasdiqlaymiz
    if (needName && !saveName()) {
      setNameNudge(true)
      window.scrollTo({ top: 0, behavior: 'smooth' })
      return
    }
    setBasket([])
    setQtyDraft({})
    setSearch('')
    setVoiceMsg('')
    setSheetError('')
    if (target.kind === 'other') {
      setOtherName(otherPreset)
      setOtherDate(todayLocal())
    }
    setSheet({ target, mode })
  }
  const closeSheet = () => {
    if (saving) return
    try { mediaRecRef.current?.stop() } catch {}
    setSheet(null)
  }

  // ── Savat ──
  const inBasket = (id: string) => basket.find(s => s.item.id === id)
  const capFor = (s: SelectedItem, mode: UnitMode = s.mode) =>
    // Chiqimda qoldiqdan ko'p olib bo'lmaydi; qaytarishda cheklov yo'q
    sheet?.mode === 'TAKE' ? Math.max(1, maxFor(s.item, mode)) : Infinity

  const addItem = (item: Item) => {
    setBasket(prev => prev.find(s => s.item.id === item.id)
      ? prev
      : [...prev, { item, qty: 1, mode: defaultMode(item) }])
  }
  const changeQty = (id: string, delta: number) => {
    setBasket(prev => prev.flatMap(s => {
      if (s.item.id !== id) return [s]
      const q = s.qty + delta
      if (q <= 0) return []                       // 1 dan pastga — savatdan chiqadi
      return [{ ...s, qty: Math.min(capFor(s), q) }]
    }))
  }
  // Sonni qo'lda yozish. Yozilayotgan matn alohida saqlanadi — aks holda
  // "1" ni o'chirib "25" yozmoqchi bo'lganda maydon bo'shab qololmasdi.
  const setQtyTyped = (id: string, raw: string) => {
    const digits = raw.replace(/\D/g, '').slice(0, 6)
    setQtyDraft(prev => ({ ...prev, [id]: digits }))
    const n = Number(digits)
    if (n > 0) {
      setBasket(prev => prev.map(s => s.item.id !== id ? s : { ...s, qty: Math.min(capFor(s), n) }))
    }
  }
  const endQtyTyping = (id: string) => {
    setQtyDraft(prev => { const { [id]: _, ...rest } = prev; return rest })
  }
  const setUnit = (id: string, mode: UnitMode) => {
    setBasket(prev => prev.map(s =>
      s.item.id !== id ? s : { ...s, mode, qty: Math.max(1, Math.min(s.qty, capFor(s, mode))) }))
  }

  const basketSum = basket.reduce((sum, s) => sum + s.item.price * toBase(s), 0)
  const targetName = sheetEvent ? sheetEvent.name : otherName.trim()
  const canSave = basket.length > 0 && !!targetName && !saving

  const save = async () => {
    if (!sheet || !canSave) return
    setSaving(true)
    setSheetError('')
    const mode = sheet.mode
    try {
      const res = await fetch(`${window.location.origin}/api/mini-app/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          actionType: mode,
          eventName: targetName,
          telegramId: userId,
          telegramName: displayName,
          // Tadbirga yozilsa — tadbir kuni; kechagi tadbirga bugun yozilsa ham o'z kuniga tushadi
          date: sheetEvent ? sheetEvent.date : otherDate,
          erpEventId: sheetEvent ? sheetEvent.id : null,
          items: basket.map(s => ({
            itemId: s.item.id,
            quantity: s.qty,
            unitMode: s.mode,
            // Qaytarishda narx yuborilmaydi — mahsulot narxi o'zgarmasin
            totalPrice: mode === 'TAKE' ? s.item.price * toBase(s) : 0,
          })),
        }),
      })
      const data = await res.json()
      if (!data.success) {
        setSheetError(data.error || "Saqlanmadi. Qaytadan urinib ko'ring.")
        return
      }
      const n = basket.length
      setSheet(null)
      showToast(`${mode === 'TAKE' ? 'Chiqim' : 'Qaytarish'} saqlandi · ${n} mahsulot`)
      router.refresh()
    } catch {
      setSheetError("Server bilan aloqa yo'q. Internetni tekshirib, qaytadan bosing.")
    } finally {
      setSaving(false)
    }
  }

  // ── Tadbir sahifasida yozuvni bekor qilish ──
  const undoEntry = async (entry: EventEntry) => {
    if (undoing) return
    setUndoing(true)
    let failed = 0
    for (const id of entry.ids) {
      try {
        const res = await fetch(`${window.location.origin}/api/mini-app/history`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ txId: id }),
        })
        const d = await res.json()
        if (!d.success) failed++
      } catch { failed++ }
    }
    setUndoing(false)
    setUndoKey(null)
    showToast(failed ? "Bekor qilishda xato — tarixdan tekshiring" : 'Bekor qilindi, qoldiq qaytdi', failed ? 'err' : 'ok')
    router.refresh()
  }

  // ── Tarix ──
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
      if (d.success) {
        setHistory(prev => prev.filter(r => r.id !== id))
        router.refresh()
      } else showToast(d.error || 'Bekor qilinmadi', 'err')
    } catch { showToast("Server bilan aloqa yo'q", 'err') }
    setCancelingId(null)
  }

  // ── Ovoz: mahsulot oynasidagi mikrofon ──
  const applyVoice = (d: any) => {
    if (d.action === 'ADD' || d.action === 'TAKE') {
      setSheet(prev => prev ? { ...prev, mode: d.action } : prev)
    }
    if (sheet?.target.kind === 'other') {
      if (d.eventName) setOtherName(String(d.eventName))
      if (typeof d.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d.date)) setOtherDate(d.date)
    }
    let added = 0
    const next = [...basket]
    for (const it of (d.items || [])) {
      const qty = Math.max(1, parseInt(String(it.quantity ?? 1), 10) || 1)
      let match = items.find(i => i.name === it.itemName)
      if (!match) {
        const t = normalize(String(it.itemName || ''))
        if (t) match = items.find(i => { const n = normalize(i.name); return n.includes(t) || t.includes(n) })
      }
      if (match && !next.find(s => s.item.id === match!.id)) {
        next.push({ item: match, qty, mode: defaultMode(match) })
        added++
      }
    }
    setBasket(next)
    setVoiceMsg(added
      ? `Qo'shildi: ${added} ta mahsulot. Sonini tekshirib, «Saqlash»ni bosing.`
      : `"${d.transcript || ''}" — mahsulot topilmadi. Qo'lda tanlang.`)
  }

  const startVoice = async () => {
    if (listening) {
      try { mediaRecRef.current?.stop() } catch {}
      return
    }
    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      setVoiceMsg("Bu qurilma mikrofonni qo'llamaydi. Qo'lda tanlang.")
      return
    }
    let stream: MediaStream
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true })
    } catch {
      setVoiceMsg('Mikrofonga ruxsat berilmadi. Sozlamalardan ruxsat bering.')
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
          body: JSON.stringify({
            audio: b64,
            mimeType: blob.type,
            events: [...todayCards.map(e => e.name), ...eventPresets],
          }),
        })
        const d = await res.json()
        if (d.error) {
          setVoiceMsg(
            d.needKey === 'openai' ? "Ovoz kaliti sozlanmagan. (Admin: Railway'ga OPENAI_API_KEY qo'shsin.)"
            : d.needKey === 'anthropic' ? "AI kaliti sozlanmagan. (Admin: Railway'ga ANTHROPIC_API_KEY qo'shsin.)"
            : `Tushunilmadi${d.transcript ? `: "${d.transcript}"` : ''}. Qaytadan ayting yoki qo'lda tanlang.`)
          return
        }
        applyVoice(d)
      } catch {
        setVoiceMsg("Server bilan aloqa yo'q.")
      }
    }
    mediaRecRef.current = mr
    setVoiceMsg("Tinglanmoqda… To'xtatish uchun yana bosing.")
    setListening(true)
    try {
      mr.start()
      setTimeout(() => { if (mr.state === 'recording') { try { mr.stop() } catch {} } }, 20000)
    } catch {
      setListening(false)
      setVoiceMsg("Ovoz yozib bo'lmadi.")
    }
  }

  // Mahsulot oynasi ro'yxati: qidirilsa — natijalar; aks holda tez-tez olinadiganlar + hammasi
  const q = search.trim()
  const searchResults = q
    ? items.filter(i => {
        const terms = normalize(q).split(' ').filter(Boolean)
        const text = getSearchableText(i.name)
        return terms.every(t => text.includes(t))
      })
    : []
  const frequentItems = frequentIds
    .map(id => items.find(i => i.id === id))
    .filter((i): i is Item => Boolean(i))

  // ════════════════════════════════════════════════════════════════
  //  Kichik bo'laklar
  // ════════════════════════════════════════════════════════════════

  const renderEventCard = (ev: EventCard) => {
    const empty = ev.takenKinds === 0
    return (
      <div
        key={ev.id}
        className={`relative bg-white rounded-2xl border ${empty && ev.isToday ? 'border-amber-300' : 'border-zinc-200/80'} shadow-sm overflow-hidden`}
      >
        {empty && ev.isToday && <div className="absolute inset-y-0 left-0 w-1.5 bg-amber-400" aria-hidden />}
        <div className="flex items-center gap-3 p-4 pl-5">
          <button
            onClick={() => openEvent(ev)}
            className="flex-1 min-w-0 text-left active:opacity-70 transition-opacity"
          >
            <div className="flex items-center gap-1.5 text-xs font-bold text-brand-600 tabular-nums">
              <Clock size={12} /> {timeRange(ev)}
            </div>
            <div className="mt-0.5 text-[17px] font-extrabold text-zinc-900 leading-snug break-words">{ev.name}</div>
            {ev.type && ev.type !== ev.name && (
              <div className="text-xs font-semibold text-zinc-500 break-words">{ev.type}</div>
            )}
            {(ev.hall || ev.guests > 0) && (
              <div className="mt-0.5 flex flex-wrap gap-x-3 text-xs font-medium text-zinc-500">
                {ev.hall && <span className="flex items-center gap-1"><MapPin size={11} />{ev.hall}</span>}
                {ev.guests > 0 && <span className="flex items-center gap-1"><Users size={11} />{ev.guests} kishi</span>}
              </div>
            )}
            <span className={`inline-block mt-2 px-2.5 py-1 rounded-full text-[11px] font-bold ${
              empty ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800'
            }`}>
              {empty ? "Chiqim yo'q" : `${ev.takenKinds} xil${ev.lastAt ? ` · oxirgisi ${ev.lastAt}` : ''}`}
            </span>
          </button>
          <button
            onClick={() => openSheet({ kind: 'event', eventId: ev.id })}
            aria-label={`${ev.name} — chiqim qo'shish`}
            className={`shrink-0 w-12 h-12 rounded-2xl flex items-center justify-center active:scale-95 transition-transform ${
              ev.isToday
                ? 'bg-brand-500 text-white shadow-[0_8px_18px_-8px_rgba(99,102,241,0.9)]'
                : 'bg-zinc-100 text-brand-600 border border-zinc-200'
            }`}
          >
            <Plus size={24} strokeWidth={2.5} />
          </button>
        </div>
      </div>
    )
  }

  const renderItemRow = (item: Item) => {
    const s = inBasket(item.id)
    const out = sheet?.mode === 'TAKE' && maxFor(item, defaultMode(item)) <= 0
    return (
      <div key={item.id} className={`rounded-2xl border px-3.5 py-3 ${s ? 'border-brand-300 bg-brand-50/60' : 'border-zinc-200 bg-white'}`}>
        <div className="flex items-center gap-3">
          <div className="flex-1 min-w-0">
            <div className="font-bold text-zinc-900 text-[15px] leading-snug break-words">{item.name}</div>
            <div className={`text-xs font-medium tabular-nums ${out ? 'text-rose-500' : 'text-zinc-500'}`}>
              {out ? 'Tugagan' : stockText(item)}
              {isPackOnly(item) && !out && ' · faqat pachka'}
            </div>
          </div>
          {s ? (
            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={() => changeQty(item.id, -1)}
                aria-label="Kamaytirish"
                className="w-9 h-9 rounded-xl bg-white border border-zinc-200 flex items-center justify-center text-brand-600 active:scale-95"
              >
                <Minus size={16} strokeWidth={2.5} />
              </button>
              <label className="flex flex-col items-center leading-tight">
                <input
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  enterKeyHint="done"
                  value={qtyDraft[item.id] ?? String(s.qty)}
                  onChange={e => setQtyTyped(item.id, e.target.value)}
                  onFocus={e => e.target.select()}
                  onBlur={() => endQtyTyping(item.id)}
                  onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }}
                  aria-label={`${item.name} — soni`}
                  className="w-14 rounded-lg border border-zinc-200 bg-white py-1 text-center text-base font-extrabold text-zinc-900 tabular-nums focus:outline-none focus:ring-2 focus:ring-brand-500/40"
                />
                {Number(qtyDraft[item.id] || 0) > s.qty ? (
                  <span className="text-[10px] font-bold text-rose-500">maks {s.qty}</span>
                ) : (
                  <span className="text-[10px] font-bold text-zinc-500">{unitName(item, s.mode)}</span>
                )}
              </label>
              <button
                onClick={() => changeQty(item.id, 1)}
                aria-label="Ko'paytirish"
                className="w-9 h-9 rounded-xl bg-white border border-zinc-200 flex items-center justify-center text-brand-600 active:scale-95"
              >
                <Plus size={16} strokeWidth={2.5} />
              </button>
            </div>
          ) : (
            <button
              onClick={() => addItem(item)}
              disabled={out}
              aria-label={`${item.name} qo'shish`}
              className="shrink-0 w-10 h-10 rounded-xl bg-zinc-100 border border-zinc-200 flex items-center justify-center text-brand-600 active:scale-95 disabled:opacity-40"
            >
              <Plus size={20} strokeWidth={2.5} />
            </button>
          )}
        </div>
        {s && hasPack(item) && !isPackOnly(item) && (
          <div className="mt-2.5 flex items-center justify-between gap-2">
            <div className="flex bg-zinc-100 rounded-lg p-0.5 text-xs font-bold">
              {(['piece', 'pack'] as UnitMode[]).map(m => (
                <button
                  key={m}
                  onClick={() => setUnit(item.id, m)}
                  className={`px-3 py-1 rounded-md ${s.mode === m ? 'bg-white shadow-sm text-zinc-900' : 'text-zinc-500'}`}
                >
                  {m === 'pack' ? `${item.packUnit.toLowerCase()} (${item.packSize})` : (item.unit || 'dona').toLowerCase()}
                </button>
              ))}
            </div>
            {s.mode === 'pack' && (
              <span className="text-[11px] font-semibold text-zinc-500 tabular-nums">= {toBase(s)} {(item.unit || 'dona').toLowerCase()}</span>
            )}
          </div>
        )}
      </div>
    )
  }

  const renderTabBar = () => (
    <nav
      className="fixed bottom-0 inset-x-0 z-30 bg-white/95 backdrop-blur border-t border-zinc-200 grid grid-cols-2"
      style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
    >
      {([['today', 'Bugun', Home], ['history', 'Tarix', History]] as const).map(([key, label, Icon]) => {
        const on = key === 'history' ? view === 'history' : view !== 'history'
        return (
          <button
            key={key}
            onClick={() => (key === 'history' ? openHistory() : goToday())}
            className={`py-2.5 flex flex-col items-center gap-0.5 text-[11px] font-bold ${on ? 'text-brand-600' : 'text-zinc-400'}`}
          >
            <Icon size={21} strokeWidth={on ? 2.4 : 2} />
            {label}
          </button>
        )
      })}
    </nav>
  )

  // Impulse (kompaniyaning o'z ehtiyoji) — kalendarda yo'q, lekin har kuni
  // kerak bo'ladi. Pastki o'ng burchakda doim turadi, bir bosishda ochiladi.
  const renderImpulseTile = () => (
    <button
      onClick={() => openSheet({ kind: 'other' }, 'TAKE', 'Impulse')}
      aria-label="Impulse — chiqim qo'shish"
      className="fixed right-4 z-30 flex items-center gap-2 rounded-2xl bg-white border border-zinc-200 shadow-lg shadow-zinc-900/10 pl-3.5 pr-1.5 py-1.5 active:scale-95 transition-transform"
      style={{ bottom: 'calc(env(safe-area-inset-bottom, 0px) + 72px)' }}
    >
      <span className="text-sm font-extrabold text-zinc-900">Impulse</span>
      <span className="w-8 h-8 rounded-xl bg-brand-500 text-white flex items-center justify-center">
        <Plus size={18} strokeWidth={2.75} />
      </span>
    </button>
  )

  // ════════════════════════════════════════════════════════════════
  //  Sahifa
  // ════════════════════════════════════════════════════════════════

  return (
    <div className="min-h-screen bg-[#f4f5f9] text-zinc-900 font-sans pb-40">

      {toast && (
        <div
          role="status"
          className={`fixed left-4 right-4 z-[60] mx-auto max-w-md rounded-2xl px-4 py-3 text-sm font-bold shadow-lg ${
            toast.kind === 'ok' ? 'bg-emerald-600 text-white' : 'bg-rose-600 text-white'
          }`}
          style={{ top: 'calc(env(safe-area-inset-top, 0px) + 12px)' }}
        >
          {toast.text}
        </div>
      )}

      <div className="mx-auto max-w-md px-4" style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 16px)' }}>

        {/* ══════════ BUGUN ══════════ */}
        {view === 'today' && (
          <div className="flex flex-col gap-3">
            <header className="flex items-end justify-between gap-3 pb-1">
              <div>
                <div className="text-xs font-semibold text-zinc-500">{todayHuman()}</div>
                <h1 className="text-[28px] font-black tracking-tight leading-tight">Bugun</h1>
              </div>
              {displayName && (
                <div className="w-10 h-10 rounded-full bg-brand-500 text-white flex items-center justify-center font-bold" title={displayName}>
                  {displayName.charAt(0).toUpperCase()}
                </div>
              )}
            </header>

            {needName && (
              <div className={`rounded-2xl p-3.5 border ${nameNudge ? 'bg-amber-50 border-amber-300' : 'bg-white border-zinc-200'}`}>
                <label htmlFor="name-input" className="block text-xs font-bold text-zinc-600 mb-1.5">
                  {nameNudge ? 'Avval ismingizni yozing — chiqim kim nomidan yozilishi kerak' : 'Ismingiz'}
                </label>
                <input
                  id="name-input"
                  type="text"
                  value={manualName}
                  onChange={e => setManualName(e.target.value)}
                  onBlur={saveName}
                  onKeyDown={e => { if (e.key === 'Enter') saveName() }}
                  enterKeyHint="done"
                  placeholder="Ism familiya"
                  className="w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3.5 py-2.5 text-[15px] font-medium focus:outline-none focus:ring-2 focus:ring-brand-500/40"
                />
              </div>
            )}

            {missing > 0 && (
              <div className="rounded-2xl bg-amber-100 text-amber-900 px-4 py-2.5 text-sm font-bold">
                {missing} ta tadbirda chiqim yo'q
              </div>
            )}

            {todayCards.map(renderEventCard)}

            {erpStatus === 'ok' && todayCards.length === 0 && (
              <div className="rounded-2xl bg-white border border-zinc-200 px-4 py-4 text-sm font-medium text-zinc-500">
                Bugun kalendarda tadbir yo'q.
              </div>
            )}
            {erpStatus === 'error' && (
              <div className="rounded-2xl bg-amber-50 border border-amber-200 px-4 py-3 text-sm font-medium text-amber-800">
                Kalendar yuklanmadi. Chiqimni pastdagi «Boshqa ehtiyoj» orqali yozing.
              </div>
            )}

            {yesterdayCards.length > 0 && (
              <>
                <h2 className="mt-2 text-[11px] font-extrabold uppercase tracking-widest text-zinc-500">Kecha</h2>
                {yesterdayCards.map(renderEventCard)}
              </>
            )}

            <button
              onClick={() => openSheet({ kind: 'other' })}
              className="mt-1 flex items-center gap-3 rounded-2xl border-2 border-dashed border-zinc-300 px-4 py-3.5 text-left active:bg-white/60"
            >
              <div className="flex-1">
                <div className="font-extrabold text-[15px]">Boshqa ehtiyoj</div>
                <div className="text-xs font-medium text-zinc-500">Ofis, kalendarda yo'q tadbir</div>
              </div>
              <span className="w-10 h-10 rounded-xl bg-white border border-zinc-200 flex items-center justify-center text-brand-600">
                <Plus size={20} strokeWidth={2.5} />
              </span>
            </button>
          </div>
        )}

        {/* ══════════ TADBIR SAHIFASI ══════════ */}
        {view === 'event' && (
          activeEvent ? (
            <div className="flex flex-col gap-4">
              <button onClick={goToday} className="self-start flex items-center gap-1 text-sm font-bold text-zinc-500 -ml-1">
                <ChevronLeft size={18} /> Bugun
              </button>

              <div>
                <div className="flex items-center gap-1.5 text-xs font-bold text-brand-600 tabular-nums">
                  <Clock size={12} /> {activeEvent.isToday ? 'Bugun' : 'Kecha'} · {timeRange(activeEvent)}
                </div>
                <h1 className="mt-0.5 text-2xl font-black leading-tight break-words">{activeEvent.name}</h1>
                <div className="mt-1 flex flex-wrap gap-x-3 text-xs font-medium text-zinc-500">
                  {activeEvent.hall && <span className="flex items-center gap-1"><MapPin size={11} />{activeEvent.hall}</span>}
                  {activeEvent.guests > 0 && <span className="flex items-center gap-1"><Users size={11} />{activeEvent.guests} kishi</span>}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div className="rounded-2xl bg-white border border-zinc-200 px-3.5 py-3">
                  <div className="text-lg font-extrabold tabular-nums">{fmtSum(activeEvent.netValue)}</div>
                  <div className="text-[11px] font-medium text-zinc-500">sarflandi (qaytgani ayirilgan)</div>
                </div>
                <div className="rounded-2xl bg-white border border-zinc-200 px-3.5 py-3">
                  <div className="text-lg font-extrabold tabular-nums">{activeEvent.entries.length} ta yozuv</div>
                  <div className="text-[11px] font-medium text-zinc-500">{activeEvent.people} kishi yozgan</div>
                </div>
              </div>

              <button
                onClick={() => openSheet({ kind: 'event', eventId: activeEvent.id })}
                className="w-full rounded-2xl bg-brand-500 py-4 text-white text-base font-extrabold flex items-center justify-center gap-2 shadow-[0_10px_22px_-10px_rgba(99,102,241,0.9)] active:scale-[0.98] transition-transform"
              >
                <Plus size={20} strokeWidth={3} /> Chiqim qo'shish
              </button>

              <section>
                <h2 className="mb-2 text-[11px] font-extrabold uppercase tracking-widest text-zinc-500">Olingan</h2>
                {activeEvent.lines.length === 0 ? (
                  <div className="rounded-2xl bg-amber-50 border border-amber-200 px-4 py-4 text-sm font-medium text-amber-800">
                    Bu tadbirga hali hech narsa chiqim qilinmagan.
                  </div>
                ) : (
                  <div className="rounded-2xl bg-white border border-zinc-200 divide-y divide-zinc-100">
                    {activeEvent.lines.map(l => (
                      <div key={l.name} className="flex items-baseline justify-between gap-3 px-4 py-2.5">
                        <span className="font-bold text-sm break-words min-w-0">{l.name}</span>
                        <span className="text-right shrink-0 tabular-nums">
                          {l.taken && <span className="block text-sm font-extrabold text-brand-600">{l.taken}</span>}
                          {l.returned && <span className="block text-[11px] font-bold text-emerald-600">{l.returned} qaytdi</span>}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </section>

              {activeEvent.entries.length > 0 && (
                <section>
                  <h2 className="mb-2 text-[11px] font-extrabold uppercase tracking-widest text-zinc-500">Kun davomida</h2>
                  <div className="rounded-2xl bg-white border border-zinc-200 divide-y divide-zinc-100">
                    {activeEvent.entries.map((en, i) => {
                      // Faqat eng oxirgi va o'zingiz yozgan yozuvni bekor qilish mumkin
                      const canUndo = i === 0 && en.whoId === userId
                      const confirming = undoKey === en.key
                      return (
                        <div key={en.key} className="px-4 py-2.5">
                          <div className="flex items-start gap-3">
                            <time className="w-11 shrink-0 text-xs font-bold text-zinc-500 tabular-nums pt-0.5">{en.at}</time>
                            <div className="flex-1 min-w-0 text-sm">
                              {en.type === 'ADD' && <span className="font-bold text-emerald-600">Qaytdi · </span>}
                              <span className="font-semibold">{en.text}</span>
                              {en.who && <span className="text-zinc-500"> · {en.who}</span>}
                            </div>
                            {canUndo && !confirming && (
                              <button
                                onClick={() => setUndoKey(en.key)}
                                className="shrink-0 rounded-lg border border-rose-200 px-2 py-1 text-[11px] font-bold text-rose-600"
                              >
                                Bekor
                              </button>
                            )}
                          </div>
                          {confirming && (
                            <div className="mt-2 flex items-center gap-2 pl-14">
                              <span className="flex-1 text-xs font-medium text-zinc-600">Bekor qilinsinmi? Qoldiq qaytadi.</span>
                              <button
                                onClick={() => setUndoKey(null)}
                                disabled={undoing}
                                className="rounded-lg bg-zinc-100 px-3 py-1.5 text-xs font-bold text-zinc-600"
                              >
                                Yo'q
                              </button>
                              <button
                                onClick={() => undoEntry(en)}
                                disabled={undoing}
                                className="rounded-lg bg-rose-600 px-3 py-1.5 text-xs font-bold text-white disabled:opacity-60"
                              >
                                {undoing ? '…' : 'Ha, bekor qil'}
                              </button>
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </section>
              )}

              <button
                onClick={() => openSheet({ kind: 'event', eventId: activeEvent.id }, 'ADD')}
                className="w-full rounded-2xl bg-white border border-zinc-200 py-3 text-sm font-bold text-emerald-700 flex items-center justify-center gap-2 active:bg-zinc-50"
              >
                <RotateCcw size={16} /> Ortib qolganini qaytarish
              </button>
            </div>
          ) : (
            <div className="py-16 text-center">
              <p className="text-zinc-500 font-medium">Bu tadbir kalendardan topilmadi.</p>
              <button onClick={goToday} className="mt-4 rounded-2xl bg-white border border-zinc-200 px-5 py-3 text-sm font-bold">
                Bugunga qaytish
              </button>
            </div>
          )
        )}

        {/* ══════════ TARIX ══════════ */}
        {view === 'history' && (
          <div className="flex flex-col gap-3">
            <h1 className="text-[28px] font-black tracking-tight leading-tight">Tarix</h1>

            <div className="flex gap-2">
              {(([['all', 'Hammasi'], ['TAKE', 'Chiqim'], ['ADD', 'Qaytarish']]) as [string, string][]).map(([k, label]) => (
                <button
                  key={k}
                  onClick={() => { setHistFilter(k); loadHistory(k) }}
                  className={`flex-1 py-2 rounded-xl text-xs font-bold border ${histFilter === k ? 'bg-brand-500 text-white border-brand-500' : 'bg-white text-zinc-500 border-zinc-200'}`}
                >
                  {label}
                </button>
              ))}
            </div>

            <div className="relative">
              <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-400" />
              <input
                id="hist-search"
                value={histSearch}
                onChange={e => setHistSearch(e.target.value)}
                placeholder="Mahsulot, tadbir yoki xodim"
                className="w-full rounded-xl border border-zinc-200 bg-white py-2.5 pl-10 pr-3 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-brand-500/40"
              />
            </div>

            {histLoading ? (
              <div className="flex justify-center py-12">
                <div className="w-7 h-7 rounded-full border-4 border-brand-500 border-t-transparent animate-spin"></div>
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                {history.filter(r => {
                  const s = histSearch.trim().toLowerCase()
                  if (!s) return true
                  return (r.itemName || '').toLowerCase().includes(s) || (r.eventName || '').toLowerCase().includes(s) || (r.userName || '').toLowerCase().includes(s)
                }).map(r => {
                  const isTake = r.type === 'TAKE'
                  const dt = new Date(r.createdAt)
                  const dateStr = dt.toLocaleDateString('uz-UZ', { day: '2-digit', month: '2-digit' }) + ' ' + dt.toLocaleTimeString('uz-UZ', { hour: '2-digit', minute: '2-digit' })
                  return (
                    <div key={r.id} className="rounded-2xl bg-white border border-zinc-200 p-3.5 flex items-center gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="font-bold text-sm truncate">{r.itemName}</div>
                        <div className={`${isTake ? 'text-rose-600' : 'text-emerald-600'} font-bold text-sm tabular-nums`}>
                          {isTake ? '−' : '+'}{Math.abs(r.quantity)} {(r.unit || 'dona').toLowerCase()}
                        </div>
                        <div className="text-[11px] text-zinc-500 truncate">
                          {r.eventName || '—'} · {dateStr}{r.userName ? ' · ' + r.userName : ''}
                        </div>
                      </div>
                      <button
                        onClick={() => cancelTx(r.id)}
                        disabled={cancelingId === r.id}
                        className="shrink-0 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-bold text-rose-600 flex items-center gap-1 disabled:opacity-50"
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
      </div>

      {view !== 'event' && !sheet && renderImpulseTile()}
      {renderTabBar()}

      {/* ══════════ MAHSULOT OYNASI ══════════ */}
      {sheet && (
        <div className="fixed inset-0 z-50" role="dialog" aria-modal="true" aria-label="Mahsulot tanlash">
          <div className="absolute inset-0 bg-zinc-900/40" onClick={closeSheet} />
          <div
            className="absolute inset-x-0 bottom-0 mx-auto max-w-md bg-white rounded-t-3xl flex flex-col"
            style={{ top: 'calc(env(safe-area-inset-top, 0px) + 48px)' }}
          >
            <div className="px-4 pt-2.5 pb-3 border-b border-zinc-100">
              <div className="mx-auto mb-2 h-1 w-10 rounded-full bg-zinc-200" />
              {/* Qaysi tadbirga yozilayotgani — to'liq ko'rinsin, kesilmasin */}
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 pt-1 text-sm font-bold text-brand-600 leading-snug break-words">
                  {sheetEvent ? `${sheetEvent.name} · ${sheetEvent.start_time}` : otherName === 'Impulse' ? 'Impulse' : 'Boshqa ehtiyoj'}
                </div>
                <button onClick={closeSheet} aria-label="Yopish" className="shrink-0 w-9 h-9 rounded-xl bg-zinc-100 flex items-center justify-center text-zinc-500">
                  <X size={18} />
                </button>
              </div>
              <div className="mt-1 flex items-center justify-between gap-3">
                <div className="text-xl font-black">{sheet.mode === 'TAKE' ? 'Chiqim' : 'Qaytarish'}</div>
                <div className="flex bg-zinc-100 rounded-xl p-1 text-xs font-bold">
                  {(['TAKE', 'ADD'] as Mode[]).map(m => (
                    <button
                      key={m}
                      onClick={() => setSheet(prev => prev ? { ...prev, mode: m } : prev)}
                      className={`px-3 py-1.5 rounded-lg ${sheet.mode === m ? 'bg-white shadow-sm text-zinc-900' : 'text-zinc-500'}`}
                    >
                      {m === 'TAKE' ? 'Chiqim' : 'Qaytarish'}
                    </button>
                  ))}
                </div>
              </div>

              {sheet.target.kind === 'other' && (
                <div className="mt-3 flex flex-col gap-2">
                  <div className="flex flex-wrap gap-1.5">
                    {eventPresets.map(p => (
                      <button
                        key={p}
                        onClick={() => setOtherName(p)}
                        className={`rounded-full px-3 py-1.5 text-xs font-bold border ${otherName === p ? 'bg-brand-500 text-white border-brand-500' : 'bg-white text-zinc-600 border-zinc-200'}`}
                      >
                        {p}
                      </button>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <input
                      id="other-name"
                      value={eventPresets.includes(otherName) ? '' : otherName}
                      onChange={e => setOtherName(e.target.value)}
                      placeholder="Yoki nomini yozing"
                      className="flex-1 min-w-0 rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-brand-500/40"
                    />
                    <label className="relative flex items-center">
                      <CalendarDays size={14} className="pointer-events-none absolute left-2.5 text-zinc-400" />
                      <input
                        id="other-date"
                        type="date"
                        value={otherDate}
                        max={todayLocal()}
                        onChange={e => setOtherDate(e.target.value)}
                        aria-label="Sana"
                        className="w-[9.5rem] rounded-xl border border-zinc-200 bg-zinc-50 py-2 pl-8 pr-2 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-brand-500/40"
                      />
                    </label>
                  </div>
                </div>
              )}

              <div className="mt-3 flex items-center gap-2 rounded-xl bg-zinc-100 px-3">
                <Search size={16} className="text-zinc-400 shrink-0" />
                <input
                  id="item-search"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="Mahsulot qidirish"
                  className="flex-1 min-w-0 bg-transparent py-2.5 text-[15px] font-medium focus:outline-none"
                />
                {search && (
                  <button onClick={() => setSearch('')} aria-label="Tozalash" className="text-zinc-400"><X size={16} /></button>
                )}
                <button
                  onClick={startVoice}
                  aria-label={listening ? "Ovozni to'xtatish" : 'Ovoz bilan kiritish'}
                  className={`-mr-1 w-9 h-9 rounded-lg flex items-center justify-center ${listening ? 'bg-rose-500 text-white animate-pulse' : 'text-brand-600'}`}
                >
                  <Mic size={18} />
                </button>
              </div>
              {voiceMsg && <div className="mt-2 text-xs font-medium text-zinc-600">{voiceMsg}</div>}
            </div>

            <div className="flex-1 overflow-y-auto px-4 py-3 flex flex-col gap-2 overscroll-contain">
              {q ? (
                <>
                  {searchResults.map(renderItemRow)}
                  {searchResults.length === 0 && (
                    <div className="py-10 text-center text-sm text-zinc-400">«{q}» bo'yicha mahsulot topilmadi</div>
                  )}
                </>
              ) : (
                <>
                  {frequentItems.length > 0 && (
                    <>
                      <h3 className="text-[11px] font-extrabold uppercase tracking-widest text-zinc-500">Tez-tez olinadi</h3>
                      {frequentItems.map(renderItemRow)}
                      <h3 className="mt-2 text-[11px] font-extrabold uppercase tracking-widest text-zinc-500">Barcha mahsulotlar · {items.length}</h3>
                    </>
                  )}
                  {items
                    .filter(it => !frequentIds.includes(it.id))
                    .map(renderItemRow)}
                </>
              )}
            </div>

            <div
              className="border-t border-zinc-100 bg-white px-4 pt-3"
              style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 12px)' }}
            >
              {sheetError && <div className="mb-2 rounded-xl bg-rose-50 px-3 py-2 text-xs font-bold text-rose-700">{sheetError}</div>}
              {sheet.target.kind === 'other' && !otherName.trim() && basket.length > 0 && (
                <div className="mb-2 text-xs font-bold text-amber-700">Qaysi ehtiyoj uchun? Tepada nomini tanlang.</div>
              )}
              <div className="flex items-center gap-3">
                <div className="flex-1 min-w-0 tabular-nums">
                  <div className="text-sm font-extrabold">{basket.length ? `${basket.length} mahsulot` : 'Mahsulot tanlang'}</div>
                  {basket.length > 0 && <div className="text-xs font-medium text-zinc-500">{fmtSum(basketSum)}</div>}
                </div>
                <button
                  onClick={save}
                  disabled={!canSave}
                  className={`rounded-2xl px-7 py-3.5 text-[15px] font-extrabold text-white disabled:opacity-40 active:scale-[0.98] transition-transform ${
                    sheet.mode === 'TAKE' ? 'bg-brand-500' : 'bg-emerald-600'
                  }`}
                >
                  {saving ? 'Saqlanmoqda…' : 'Saqlash'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
