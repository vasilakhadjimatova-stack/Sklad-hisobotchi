// Eski chiqimlarni yangi narxga o'tkazish uchun guruhlash.
//
// Chiqim (TAKE) summasi yozilgan paytdagi narxda saqlanadi (totalPrice).
// Narx keyin to'g'rilansa, eski chiqimlar o'zgarmaydi. Hammasini avtomatik
// qayta hisoblab bo'lmaydi: kirimda narx o'rtacha narxga o'zgaradi va
// o'sha paytdagi chiqimlar to'g'ri narxda bo'lgan. Shuning uchun chiqimlar
// 1 dona narxi bo'yicha guruhlanadi va qaysilarini tuzatishni odam tanlaydi.

export type TakeRow = {
  quantity: number
  totalPrice: number | null
  createdAt: Date
  eventName: string | null
}

export type PriceGroup = {
  unitPrice: number      // chiqim yozilgan 1 dona narxi (so'm, yaxlitlangan)
  count: number
  from: string           // YYYY-MM-DD (Toshkent)
  to: string
  oldTotal: number
  newTotal: number       // hozirgi narxda bo'lsa
  events: string[]       // tadbir nomlari (takrorsiz, eng ko'p uchraganlari oldin)
}

const TASHKENT_MS = 5 * 60 * 60 * 1000
const dayOf = (d: Date) => new Date(d.getTime() + TASHKENT_MS).toISOString().slice(0, 10)

export const unitPriceOf = (t: Pick<TakeRow, 'quantity' | 'totalPrice'>) =>
  Math.round((t.totalPrice || 0) / Math.abs(t.quantity))

// Summasi yozilmagan (null/0) chiqimlar hisobotlarda baribir hozirgi narxda
// hisoblanadi — ular tuzatishga muhtoj emas.
export const isPriced = (t: Pick<TakeRow, 'quantity' | 'totalPrice'>) =>
  (t.totalPrice || 0) > 0 && t.quantity !== 0

export function groupTakesByPrice(rows: TakeRow[], currentPrice: number): PriceGroup[] {
  const cur = Math.round(currentPrice)
  const map = new Map<number, PriceGroup & { ev: Map<string, number> }>()
  for (const t of rows) {
    if (!isPriced(t)) continue
    const up = unitPriceOf(t)
    if (up === cur) continue
    const day = dayOf(t.createdAt)
    const g = map.get(up) ?? {
      unitPrice: up, count: 0, from: day, to: day, oldTotal: 0, newTotal: 0, events: [], ev: new Map(),
    }
    g.count++
    if (day < g.from) g.from = day
    if (day > g.to) g.to = day
    g.oldTotal += t.totalPrice || 0
    g.newTotal += Math.abs(t.quantity) * currentPrice
    const e = (t.eventName || '').trim()
    if (e) g.ev.set(e, (g.ev.get(e) || 0) + 1)
    map.set(up, g)
  }
  return Array.from(map.values())
    .map(({ ev, ...g }) => ({
      ...g,
      oldTotal: Math.round(g.oldTotal),
      newTotal: Math.round(g.newTotal),
      events: Array.from(ev.entries()).sort((a, b) => b[1] - a[1]).map(([n]) => n),
    }))
    .sort((a, b) => (a.to < b.to ? 1 : a.to > b.to ? -1 : 0))   // eng yangisi tepada
}
