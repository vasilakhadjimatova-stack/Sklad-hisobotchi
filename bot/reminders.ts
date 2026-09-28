// Tadbir tugaganda eslatma.
//
// Har daqiqada ERP kalendaridagi kechagi va bugungi tadbirlar tekshiriladi.
// Tadbir tugashi bilan botni ishlatgan HAMMA xodimga shaxsiy xabar boradi:
// shu tadbirga nima chiqim qilingani (yoki hali hech narsa yo'qligi) va
// mini-ilovada aynan shu tadbirni ochadigan tugma.
//
// Sozlama (Railway env):
//   ERP_URL, ERP_API_KEY  — mini-ilova bilan bir xil (lib/erp.ts)
//   EVENT_REMINDERS=off   — eslatmalarni o'chirish

import type { PrismaClient } from '@prisma/client'
import type { Telegraf } from 'telegraf'
import { fetchErpEvents, type ErpEvent } from '../lib/erp'
import { formatQty } from '../lib/units'

const TASHKENT_MS = 5 * 60 * 60 * 1000
const TICK_MS = 60 * 1000
// Tugaganiga shundan ko'p vaqt o'tgan tadbirga eslatma yuborilmaydi —
// bot uzoq o'chib yongandan keyin eski tadbirlar to'lqini kelmasin.
const LATE_WINDOW_MS = 2 * 60 * 60 * 1000
// Tugash vaqti yozilmagan tadbir boshlanishidan shuncha keyin tugagan hisoblanadi
const DEFAULT_LENGTH_MIN = 3 * 60

const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/
const minutes = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5))

// Tadbir tugaydigan payt (UTC ms). Vaqt yozilmagan bo'lsa — null.
export function eventEndMs(ev: Pick<ErpEvent, 'date' | 'start_time' | 'end_time'>): number | null {
  const start = HHMM.test(ev.start_time || '') ? minutes(ev.start_time) : null
  const end = HHMM.test(ev.end_time || '') ? minutes(ev.end_time) : null
  if (start === null && end === null) return null
  const dayStart = Date.parse(`${ev.date}T00:00:00+05:00`)
  if (Number.isNaN(dayStart)) return null
  let endMin = end ?? (start as number) + DEFAULT_LENGTH_MIN
  // 20:00–01:00 kabi yarim tundan o'tadigan tadbir ertasi kuni tugaydi
  if (start !== null && end !== null && end <= start) endMin += 24 * 60
  return dayStart + endMin * 60 * 1000
}

export function isDue(ev: ErpEvent, now: number): boolean {
  const end = eventEndMs(ev)
  return end !== null && now >= end && now - end <= LATE_WINDOW_MS
}

function eventUrl(miniAppUrl: string, eventId: number): string {
  try {
    const u = new URL(miniAppUrl)
    u.searchParams.set('event', String(eventId))
    return u.toString()
  } catch {
    return miniAppUrl
  }
}

async function buildText(prisma: PrismaClient, ev: ErpEvent): Promise<string> {
  const time = `${ev.start_time}${ev.end_time ? `–${ev.end_time}` : ''}`
  const head = [
    '🔔 Tadbir tugadi',
    ev.name,
    [time && `🕑 ${time}`, ev.hall && `📍 ${ev.hall}`].filter(Boolean).join(' · '),
  ].filter(Boolean).join('\n')

  const txs = await prisma.transaction.findMany({
    where: { erpEventId: ev.id, type: { in: ['TAKE', 'ADD'] } },
    include: { item: true },
  })
  if (txs.length === 0) {
    return `${head}\n\n⚠️ Bu tadbirga hali chiqim qilinmagan.\nOlingan narsalarni hozir kiriting 👇`
  }

  const byItem = new Map<string, { item: typeof txs[number]['item']; taken: number; returned: number }>()
  for (const t of txs) {
    const row = byItem.get(t.itemId) ?? { item: t.item, taken: 0, returned: 0 }
    if (t.type === 'TAKE') row.taken += Math.abs(t.quantity)
    else row.returned += Math.abs(t.quantity)
    byItem.set(t.itemId, row)
  }
  const rows = Array.from(byItem.values()).sort((a, b) => a.item.name.localeCompare(b.item.name))
  const mode = (it: { packOnly: boolean }) => (it.packOnly ? 'pack' : null)
  const lines = rows.map(r => {
    const parts: string[] = []
    if (r.taken > 0) parts.push(formatQty(r.taken, r.item, mode(r.item)))
    if (r.returned > 0) parts.push(`${formatQty(r.returned, r.item, mode(r.item))} qaytdi`)
    return `• ${r.item.name} — ${parts.join(', ')}`
  })
  const kinds = rows.filter(r => r.taken > 0).length
  return `${head}\n\n📦 Chiqim qilingan (${kinds} xil):\n${lines.join('\n')}\n\n` +
    "Qolib ketgan bo'lsa qo'shing, ortganini qaytaring 👇"
}

async function remind(bot: Telegraf, prisma: PrismaClient, miniAppUrl: string, ev: ErpEvent) {
  // Avval "band qilamiz": yozuv yaratilsa — bu tadbirga eslatmani biz yuboramiz.
  // Yozuv allaqachon bor bo'lsa (P2002) — oldin yuborilgan, jim o'tamiz.
  // Jadval hali yaratilmagan bo'lsa ham shu yerda to'xtaydi — aks holda
  // har daqiqada qayta yuborib yuborardi.
  try {
    await prisma.eventReminder.create({ data: { erpEventId: ev.id } })
  } catch (err: any) {
    if (err?.code !== 'P2002') console.error('[eslatma] band qilib bo\'lmadi:', err?.message || err)
    return
  }

  const text = await buildText(prisma, ev)
  const users = await prisma.user.findMany({
    where: { telegramId: { not: null } },
    select: { telegramId: true },
  })
  // Faqat haqiqiy Telegram foydalanuvchilari (sayt admini, web_ ismlar emas)
  const chatIds = users.map(u => u.telegramId as string).filter(id => /^\d+$/.test(id))

  const button = { text: "📦 Chiqim qilish", web_app: { url: eventUrl(miniAppUrl, ev.id) } }
  let sent = 0
  for (const chatId of chatIds) {
    try {
      await bot.telegram.sendMessage(chatId, text, {
        reply_markup: { inline_keyboard: [[button]] },
      })
      sent++
    } catch (err: any) {
      // Botni bloklagan yoki hech yozmagan xodim — boshqalarga yuborishda davom etamiz
      console.warn(`[eslatma] ${chatId} ga yetmadi:`, err?.description || err?.message || err)
    }
    await new Promise(r => setTimeout(r, 60))   // Telegram limiti: ~30 xabar/soniya
  }
  console.log(`[eslatma] "${ev.name}" (#${ev.id}) — ${sent}/${chatIds.length} xodimga yuborildi`)
  await prisma.eventReminder.update({ where: { erpEventId: ev.id }, data: { sentTo: sent } }).catch(() => {})
}

export function startEventReminders(bot: Telegraf, prisma: PrismaClient, miniAppUrl: string) {
  if ((process.env.EVENT_REMINDERS || '').trim().toLowerCase() === 'off') {
    console.log('[eslatma] EVENT_REMINDERS=off — eslatmalar o\'chirilgan')
    return
  }

  let running = false
  let warnedOff = false
  const tick = async () => {
    if (running) return
    running = true
    try {
      const now = Date.now()
      const today = new Date(now + TASHKENT_MS).toISOString().slice(0, 10)
      const yesterday = new Date(now + TASHKENT_MS - 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
      const erp = await fetchErpEvents(yesterday, today)
      if (erp.status === 'off') {
        if (!warnedOff) console.log('[eslatma] ERP_URL/ERP_API_KEY yo\'q — eslatmalar ishlamaydi')
        warnedOff = true
        return
      }
      for (const ev of erp.events) {
        if (isDue(ev, now)) await remind(bot, prisma, miniAppUrl, ev)
      }
    } catch (err) {
      console.error('[eslatma] xato:', err)
    } finally {
      running = false
    }
  }

  setTimeout(tick, 15 * 1000)   // ishga tushganda baza sxemasi moslashib olsin
  setInterval(tick, TICK_MS)
  console.log('⏰ Tadbir eslatmalari yoqildi')
}
