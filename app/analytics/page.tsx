import prisma from '@/lib/prisma';
import AnalyticsDashboard from '@/components/AnalyticsDashboard'

export const revalidate = 0

// --- Bir kundagi o'xshash nomli tadbirlarni bitta qilib birlashtirish ---
function normalizeEventName(s: string): string {
  return s
    .toLowerCase()
    .replace(/['’`]/g, '')
    .replace(/[^a-z0-9Ѐ-ӿ]+/gi, ' ') // harf/raqam bo'lmaganini probelga
    .trim()
    .replace(/\s+/g, ' ')
}
// raqamlarni olib tashlab "asos"ni olish ("toy 1" -> "toy")
function baseWithoutDigits(norm: string): string {
  return norm.replace(/[0-9]+/g, ' ').replace(/\s+/g, ' ').trim()
}
function levenshtein(a: string, b: string): number {
  const m = a.length, n = b.length
  if (!m) return n
  if (!n) return m
  const dp = Array.from({ length: m + 1 }, (_, i) => i)
  for (let j = 1; j <= n; j++) {
    let prev = dp[0]
    dp[0] = j
    for (let i = 1; i <= m; i++) {
      const tmp = dp[i]
      dp[i] = Math.min(dp[i] + 1, dp[i - 1] + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1))
      prev = tmp
    }
  }
  return dp[m]
}
// Ikki nom "bir xil tadbir"mi? Typo'ga bardosh, lekin faqat raqam
// farqi bo'lsa ALOHIDA qoladi ("Toy 1" ≠ "Toy 2").
function sameEvent(aNorm: string, bNorm: string): boolean {
  if (aNorm === bNorm) return true
  if (baseWithoutDigits(aNorm) === baseWithoutDigits(bNorm)) return false
  const maxLen = Math.max(aNorm.length, bNorm.length)
  if (maxLen < 4) return false
  const dist = levenshtein(aNorm, bNorm)
  return dist <= 2 && dist <= Math.floor(maxLen * 0.25)
}

export default async function AnalyticsPage() {
  const items = await prisma.item.findMany()

  // TAKE (chiqim) + qaytarish (ADD/RETURN). Qaytgan mahsulot chiqimdan ayiriladi,
  // shunda har tadbirda SOF ishlatilgan miqdor ko'rinadi. Admin "Kirim qilish"
  // (eventName yo'q) tadbirga aloqasiz — uni hisobga olmaymiz.
  const allTx = await prisma.transaction.findMany({
    where: { type: { in: ['TAKE', 'ADD', 'RETURN'] } },
    include: { item: true },
    orderBy: { createdAt: 'desc' }
  })
  const transactions = allTx.filter(
    t => t.type === 'TAKE' || (t.eventName != null && t.eventName.trim() !== '')
  )

  // Har sana uchun: xom nom -> kanonik (birlashtirilgan) nom.
  // Vakil sifatida eng ko'p uchragan / uzunroq variant tanlanadi.
  const namesByDate: Record<string, Map<string, number>> = {}
  for (const t of transactions) {
    const dateStr = t.createdAt.toLocaleDateString('uz-UZ')
    const nm = t.eventName || 'Noma\'lum Tadbir'
    if (!namesByDate[dateStr]) namesByDate[dateStr] = new Map()
    namesByDate[dateStr].set(nm, (namesByDate[dateStr].get(nm) || 0) + 1)
  }
  const canonicalByDate: Record<string, Record<string, string>> = {}
  for (const dateStr of Object.keys(namesByDate)) {
    const names = Array.from(namesByDate[dateStr].entries())
      .sort((a, b) => b[1] - a[1] || b[0].length - a[0].length)
      .map(e => e[0])
    const clusters: { rep: string, repNorm: string }[] = []
    const map: Record<string, string> = {}
    for (const nm of names) {
      const norm = normalizeEventName(nm)
      const hit = clusters.find(c => sameEvent(norm, c.repNorm))
      if (hit) {
        map[nm] = hit.rep
      } else {
        clusters.push({ rep: nm, repNorm: norm })
        map[nm] = nm
      }
    }
    canonicalByDate[dateStr] = map
  }

  const totalInventoryValue = items.reduce((acc, item) => acc + (item.quantity * item.price), 0)

  const now = new Date()
  const last3MonthKeys = Array.from({ length: 3 }).map((_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    return d.toLocaleString('uz-UZ', { month: 'long', year: 'numeric' })
  })

  // --- Tadbir/mahsulot bo'yicha yig'ish ---
  // Har mahsulot uchun: olingan (taken) va qaytgan (returned) alohida; sof = taken - returned.
  // Xarajat ham sof: chiqim summasidan qaytarish summasi ayiriladi.
  type AggItem = { name: string, unit: string, taken: number, returned: number, cost: number }
  type AggEvent = { key: string, name: string, date: string, itemsMap: Record<string, AggItem> }

  const getAggItem = (map: Record<string, AggItem>, name: string, unit: string): AggItem => {
    if (!map[name]) map[name] = { name, unit, taken: 0, returned: 0, cost: 0 }
    return map[name]
  }
  const applyTx = (it: AggItem, isReturn: boolean, qtyBase: number, lineCost: number) => {
    if (isReturn) {
      it.returned += qtyBase
      it.cost -= lineCost
    } else {
      it.taken += qtyBase
      it.cost += lineCost
    }
  }

  const globalEventsMap: Record<string, AggEvent> = {}
  const monthDataMap: Record<string, {
    monthName: string,
    eventsMap: Record<string, AggEvent>,
    productsMap: Record<string, AggItem>
  }> = {}
  last3MonthKeys.forEach(m => {
    monthDataMap[m] = { monthName: m, eventsMap: {}, productsMap: {} }
  })

  transactions.forEach(t => {
    const monthKey = t.createdAt.toLocaleString('uz-UZ', { month: 'long', year: 'numeric' })
    const dateStr = t.createdAt.toLocaleDateString('uz-UZ')
    const rawName = t.eventName || 'Noma\'lum Tadbir'
    const eventName = canonicalByDate[dateStr]?.[rawName] || rawName
    const eventKey = `${dateStr}_${eventName}`
    const isReturn = t.type !== 'TAKE'
    const qtyBase = Math.abs(t.quantity)
    const lineCost = t.totalPrice || (qtyBase * t.item.price)

    // Global (Tadbirlar Ketma-ketligi)
    if (!globalEventsMap[eventKey]) {
      globalEventsMap[eventKey] = { key: eventKey, name: eventName, date: dateStr, itemsMap: {} }
    }
    applyTx(getAggItem(globalEventsMap[eventKey].itemsMap, t.item.name, t.item.unit), isReturn, qtyBase, lineCost)

    // Oylik
    const md = monthDataMap[monthKey]
    if (md) {
      if (!md.eventsMap[eventKey]) {
        md.eventsMap[eventKey] = { key: eventKey, name: eventName, date: dateStr, itemsMap: {} }
      }
      applyTx(getAggItem(md.eventsMap[eventKey].itemsMap, t.item.name, t.item.unit), isReturn, qtyBase, lineCost)
      applyTx(getAggItem(md.productsMap, t.item.name, t.item.unit), isReturn, qtyBase, lineCost)
    }
  })

  // AggItem -> komponent uchun ko'rsatiladigan item (sof miqdor + olingan/qaytgan)
  const toDisplayItems = (m: Record<string, AggItem>) =>
    Object.values(m).map(x => ({
      name: x.name,
      unit: x.unit,
      taken: x.taken,
      returned: x.returned,
      quantity: x.taken - x.returned, // sof ishlatilgan (bazaviy birlik)
      cost: x.cost                    // sof xarajat
    }))

  const eventToDisplay = (e: AggEvent) => {
    const its = toDisplayItems(e.itemsMap)
    return {
      key: e.key,
      name: e.name,
      date: e.date,
      totalCost: its.reduce((s, i) => s + i.cost, 0),
      items: its
    }
  }

  const monthsArray = last3MonthKeys.map(key => {
    const md = monthDataMap[key]
    const events = Object.values(md.eventsMap).map(eventToDisplay)
    const totalCost = events.reduce((s, e) => s + e.totalCost, 0)
    const impulseCost = events
      .filter(e => e.name.toLowerCase().includes('impulse'))
      .reduce((s, e) => s + e.totalCost, 0)
    const externalEventCount = events.filter(e => !e.name.toLowerCase().includes('impulse')).length
    const products = toDisplayItems(md.productsMap).sort((a, b) => b.cost - a.cost)
    return { monthName: md.monthName, totalCost, impulseCost, externalEventCount, events, products }
  })

  const allEventsArray = Object.values(globalEventsMap).map(eventToDisplay)

  const recentTransactions = transactions.slice(0, 15).map(t => ({
    id: t.id,
    itemName: t.item.name,
    quantity: t.quantity, // ishorali: chiqim manfiy, qaytarish musbat
    type: t.type,
    totalPrice: t.totalPrice || (Math.abs(t.quantity) * t.item.price),
    eventName: t.eventName,
    createdAt: t.createdAt.toLocaleDateString('uz-UZ'),
    unit: t.item.unit
  }))

  return (
    <AnalyticsDashboard
      months={monthsArray}
      totalInventoryValue={totalInventoryValue}
      totalEvents={allEventsArray.length}
      recentTransactions={recentTransactions}
      allEvents={allEventsArray}
    />
  )
}
