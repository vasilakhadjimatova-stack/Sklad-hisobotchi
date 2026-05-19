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
  const transactions = await prisma.transaction.findMany({
    where: { type: 'TAKE' },
    include: { item: true },
    orderBy: { createdAt: 'desc' }
  })

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

  const monthDataMap: Record<string, { 
    monthName: string, 
    totalCost: number, 
    impulseCost: number,
    externalEventCount: number,
    eventsMap: Record<string, any>,
    productsMap: Record<string, any>
  }> = {}

  last3MonthKeys.forEach(m => {
    monthDataMap[m] = { monthName: m, totalCost: 0, impulseCost: 0, externalEventCount: 0, eventsMap: {}, productsMap: {} }
  })

  // Global events map for the "Tadbirlar Ketma-ketligi" section
  const globalEventsMap: Record<string, { key: string, name: string, date: string, totalCost: number, items: any[] }> = {}

  transactions.forEach(t => {
    const monthKey = t.createdAt.toLocaleString('uz-UZ', { month: 'long', year: 'numeric' })
    const dateStr = t.createdAt.toLocaleDateString('uz-UZ')
    const rawName = t.eventName || 'Noma\'lum Tadbir'
    const eventName = canonicalByDate[dateStr]?.[rawName] || rawName
    const eventKey = `${dateStr}_${eventName}`
    const itemCost = t.totalPrice || (Math.abs(t.quantity) * t.item.price)

    // Global aggregation
    if (!globalEventsMap[eventKey]) {
      globalEventsMap[eventKey] = { key: eventKey, name: eventName, date: dateStr, totalCost: 0, items: [] }
    }
    const gEvent = globalEventsMap[eventKey]
    gEvent.totalCost += itemCost
    gEvent.items.push({
      name: t.item.name,
      quantity: Math.abs(t.quantity),
      cost: itemCost,
      unit: t.item.unit
    })

    // Monthly aggregation
    if (monthDataMap[monthKey]) {
      monthDataMap[monthKey].totalCost += itemCost
      if (eventName.toLowerCase().includes('impulse')) {
        monthDataMap[monthKey].impulseCost += itemCost
      }

      if (!monthDataMap[monthKey].eventsMap[eventKey]) {
        monthDataMap[monthKey].eventsMap[eventKey] = {
          name: eventName,
          date: dateStr,
          totalCost: 0,
          items: []
        }
        // Count as external event if not Impulse
        if (!eventName.toLowerCase().includes('impulse')) {
          monthDataMap[monthKey].externalEventCount++
        }
      }
      const mEvent = monthDataMap[monthKey].eventsMap[eventKey]
      mEvent.totalCost += itemCost
      mEvent.items.push({
        name: t.item.name,
        quantity: Math.abs(t.quantity),
        cost: itemCost,
        unit: t.item.unit
      })

      // Product aggregation per month
      if (!monthDataMap[monthKey].productsMap[t.item.name]) {
        monthDataMap[monthKey].productsMap[t.item.name] = {
          name: t.item.name,
          quantity: 0,
          cost: 0,
          unit: t.item.unit
        }
      }
      const mProd = monthDataMap[monthKey].productsMap[t.item.name]
      mProd.quantity += Math.abs(t.quantity)
      mProd.cost += itemCost
    }
  })

  const monthsArray = last3MonthKeys.map(key => ({
    monthName: monthDataMap[key].monthName,
    totalCost: monthDataMap[key].totalCost,
    impulseCost: monthDataMap[key].impulseCost,
    externalEventCount: monthDataMap[key].externalEventCount,
    events: Object.values(monthDataMap[key].eventsMap),
    products: Object.values(monthDataMap[key].productsMap).sort((a: any, b: any) => b.cost - a.cost)
  }))

  const allEventsArray = Object.values(globalEventsMap).sort((a, b) => {
    // Sort by date (we can use the first item's createdAt if we had it, but globalEventsMap keys are date-prefixed)
    return 0 
  })

  const recentTransactions = transactions.slice(0, 15).map(t => ({
    id: t.id,
    itemName: t.item.name,
    quantity: t.quantity,
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
