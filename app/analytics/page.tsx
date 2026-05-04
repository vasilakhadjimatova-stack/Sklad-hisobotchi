import { PrismaClient } from '@prisma/client'
import AnalyticsDashboard from '@/components/AnalyticsDashboard'

const prisma = new PrismaClient()

export const revalidate = 0

export default async function AnalyticsPage() {
  const items = await prisma.item.findMany()
  const transactions = await prisma.transaction.findMany({
    where: { type: 'TAKE' },
    include: { item: true },
    orderBy: { createdAt: 'desc' }
  })

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
    eventsMap: Record<string, any> 
  }> = {}

  last3MonthKeys.forEach(m => {
    monthDataMap[m] = { monthName: m, totalCost: 0, impulseCost: 0, externalEventCount: 0, eventsMap: {} }
  })

  // Global events map for the "Tadbirlar Ketma-ketligi" section
  const globalEventsMap: Record<string, { key: string, name: string, date: string, totalCost: number, items: any[] }> = {}

  transactions.forEach(t => {
    const monthKey = t.createdAt.toLocaleString('uz-UZ', { month: 'long', year: 'numeric' })
    const eventName = t.eventName || 'Noma\'lum Tadbir'
    const dateStr = t.createdAt.toLocaleDateString('uz-UZ')
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
    }
  })

  const monthsArray = last3MonthKeys.map(key => ({
    monthName: monthDataMap[key].monthName,
    totalCost: monthDataMap[key].totalCost,
    impulseCost: monthDataMap[key].impulseCost,
    externalEventCount: monthDataMap[key].externalEventCount,
    events: Object.values(monthDataMap[key].eventsMap)
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
