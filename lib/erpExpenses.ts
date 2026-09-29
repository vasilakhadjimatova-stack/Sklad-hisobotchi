// Tadbirga qilingan suv/kofe chiqimini ERP rentabelligiga yuborish.
//
// Mahsulotda "ERP moddasi" (Item.erpCategory) — "water" yoki "coffee" —
// belgilangan bo'lsa, shu mahsulotning tadbir kartochkasidan qilingan
// chiqimi (qaytgani ayirilib) ERP'da o'sha tadbirning xarajati bo'ladi.
//
// Sinxronlash ikki yo'l bilan ishga tushadi:
//  • chiqim saqlanganda / bekor qilinganda — shu tadbir uchun darhol;
//  • botda har 5 daqiqada — hammasi (narx tuzatildi, modda o'zgardi va h.k.).
// Oxirgi yuborilgan summa ErpExpenseSync'da turadi: o'zgarmagan tadbir
// qayta yuborilmaydi.

import type { PrismaClient } from '@prisma/client'
import { formatQty } from './units'
import { pushErpExpenses, type ErpExpenseCategory, type ErpExpenseLine } from './erp'

export const ERP_CATEGORIES: { key: ErpExpenseCategory; label: string }[] = [
  { key: 'water', label: 'Suv' },
  { key: 'coffee', label: 'Kofe' },
]
export const isErpCategory = (v: unknown): v is ErpExpenseCategory =>
  v === 'water' || v === 'coffee'

// Shuncha kun ichida chiqimi bo'lgan tadbirlar davriy tekshiriladi
const LOOKBACK_DAYS = 120

export type EventCost = {
  erpEventId: number
  eventName: string
  eventDate: Date          // eng birinchi chiqim sanasi (ro'yxat uchun)
  water: number
  coffee: number
  lines: ErpExpenseLine[]
}

type Tx = {
  erpEventId: number | null
  eventName: string | null
  type: string
  quantity: number
  totalPrice: number | null
  createdAt: Date
  item: { name: string; price: number; unit: string; packSize: number; packUnit: string; packOnly: boolean; erpCategory: string | null }
}

// Tranzaksiyalardan tadbir bo'yicha suv/kofe summasi. Chiqim yozilgan
// narxda (totalPrice), qaytgani hozirgi narxda ayiriladi — mini-ilovadagi
// "sarflandi" bilan bir xil hisob.
export function computeCosts(txs: Tx[]): Map<number, EventCost> {
  type Acc = { value: number; items: Map<string, { item: Tx['item']; net: number }> }
  const byEvent = new Map<number, { name: string; date: Date; cats: Record<ErpExpenseCategory, Acc> }>()
  for (const t of txs) {
    if (!t.erpEventId || !isErpCategory(t.item.erpCategory)) continue
    if (t.type !== 'TAKE' && t.type !== 'ADD') continue
    const ev = byEvent.get(t.erpEventId) ?? {
      name: t.eventName || '',
      date: t.createdAt,
      cats: { water: { value: 0, items: new Map() }, coffee: { value: 0, items: new Map() } },
    }
    if (t.createdAt < ev.date) ev.date = t.createdAt
    const acc = ev.cats[t.item.erpCategory]
    const abs = Math.abs(t.quantity)
    const row = acc.items.get(t.item.name) ?? { item: t.item, net: 0 }
    if (t.type === 'TAKE') {
      acc.value += t.totalPrice && t.totalPrice > 0 ? t.totalPrice : t.item.price * abs
      row.net += abs
    } else {
      acc.value -= t.item.price * abs
      row.net -= abs
    }
    acc.items.set(t.item.name, row)
    byEvent.set(t.erpEventId, ev)
  }

  const out = new Map<number, EventCost>()
  for (const [id, ev] of Array.from(byEvent.entries())) {
    const cost: EventCost = { erpEventId: id, eventName: ev.name, eventDate: ev.date, water: 0, coffee: 0, lines: [] }
    for (const { key } of ERP_CATEGORIES) {
      const acc = ev.cats[key]
      const amount = Math.max(0, Math.round(acc.value))
      cost[key] = amount
      if (amount <= 0) continue
      const note = Array.from(acc.items.values())
        .filter(r => r.net > 0)
        .sort((a, b) => a.item.name.localeCompare(b.item.name))
        .map(r => `${r.item.name} — ${formatQty(r.net, r.item, r.item.packOnly ? 'pack' : null)}`)
        .join('; ')
      cost.lines.push({ category: key, amount, note: `Sklad: ${note}`.slice(0, 200) })
    }
    out.set(id, cost)
  }
  return out
}

export type SyncSummary = { status: 'off' } | { status: 'done'; sent: number; failed: number; checked: number }

// Sinxronlashlar navbat bilan yuradi — bir tadbir ikki marta yuborilmasin
let queue: Promise<unknown> = Promise.resolve()

// eventIds berilsa — faqat o'shalar; aks holda hamma yaqindagi tadbirlar.
export function syncErpExpenses(prisma: PrismaClient, opts: { eventIds?: number[] } = {}): Promise<SyncSummary> {
  if (!process.env.ERP_URL || !process.env.ERP_API_KEY) return Promise.resolve({ status: 'off' })
  const run = queue.then(() => doSync(prisma, opts))
  queue = run.catch(() => undefined)
  return run
}

async function doSync(prisma: PrismaClient, opts: { eventIds?: number[] }): Promise<SyncSummary> {
  const since = new Date(Date.now() - LOOKBACK_DAYS * 24 * 60 * 60 * 1000)
  const synced = await prisma.erpExpenseSync.findMany()
  const prev = new Map(synced.map(s => [s.erpEventId, s]))

  let ids: number[]
  if (opts.eventIds && opts.eventIds.length > 0) {
    ids = Array.from(new Set(opts.eventIds.filter(n => Number.isInteger(n) && n > 0)))
  } else {
    const recent = await prisma.transaction.findMany({
      where: { erpEventId: { not: null }, createdAt: { gte: since } },
      select: { erpEventId: true },
      distinct: ['erpEventId'],
    })
    // Oldin summa yuborilgan tadbirlar ham — modda olib tashlansa 0 ga tushsin
    const withAmount = synced.filter(s => s.water > 0 || s.coffee > 0).map(s => s.erpEventId)
    ids = Array.from(new Set([...recent.map(r => r.erpEventId as number), ...withAmount]))
  }
  if (ids.length === 0) return { status: 'done', sent: 0, failed: 0, checked: 0 }

  const txs = await prisma.transaction.findMany({
    where: { erpEventId: { in: ids }, type: { in: ['TAKE', 'ADD'] } },
    select: {
      erpEventId: true, eventName: true, type: true, quantity: true, totalPrice: true, createdAt: true,
      item: { select: { name: true, price: true, unit: true, packSize: true, packUnit: true, packOnly: true, erpCategory: true } },
    },
  })
  const costs = computeCosts(txs)

  let sent = 0
  let failed = 0
  for (const id of ids) {
    const cost = costs.get(id)
    const water = cost?.water ?? 0
    const coffee = cost?.coffee ?? 0
    const p = prev.get(id)
    // Hech qachon yuborilmagan va hozir ham 0 — ERP'ni bezovta qilmaymiz
    if (!p && water === 0 && coffee === 0) continue
    // O'zgarmagan: muvaffaqiyatli yoki oy yopiq (qayta urinish befoyda)
    if (p && p.water === water && p.coffee === coffee && (p.status === 'ok' || p.status === 'locked' || p.status === 'notfound')) continue

    const res = await pushErpExpenses(id, cost?.lines ?? [])
    if (res.status === 'off') return { status: 'off' }
    const status = res.status
    const error = 'error' in res ? res.error : null
    if (status === 'ok') sent++
    else failed++
    if (status === 'error') console.error(`[erp-xarajat] #${id}: ${error}`)
    await prisma.erpExpenseSync.upsert({
      where: { erpEventId: id },
      create: { erpEventId: id, eventName: cost?.eventName || p?.eventName || '', water, coffee, status, error },
      // Xato bo'lsa summani eski holicha qoldiramiz — keyingi safar qayta uriniladi
      update: status === 'error'
        ? { status, error }
        : { eventName: cost?.eventName || p?.eventName || '', water, coffee, status, error },
    })
  }
  return { status: 'done', sent, failed, checked: ids.length }
}
