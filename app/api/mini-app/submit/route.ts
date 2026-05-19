import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma';

// Asia/Tashkent doimiy UTC+5 (yozgi vaqt yo'q).
const TASHKENT_OFFSET_MS = 5 * 60 * 60 * 1000

// Mini-app faqat sana yuboradi ("YYYY-MM-DD"). Uni joriy soat-daqiqa bilan
// birlashtiramiz, aks holda vaqt 00:00 bo'lib qoladi.
function resolveTxDate(dateStr?: string): Date {
  const now = new Date()
  if (!dateStr || !/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return now
  const tNow = new Date(now.getTime() + TASHKENT_OFFSET_MS) // Toshkent devor-soati
  if (dateStr === tNow.toISOString().slice(0, 10)) return now // bugun → aniq instant
  const [y, m, d] = dateStr.split('-').map(Number)
  const wallMs = Date.UTC(
    y, m - 1, d,
    tNow.getUTCHours(), tNow.getUTCMinutes(), tNow.getUTCSeconds(),
  )
  return new Date(wallMs - TASHKENT_OFFSET_MS) // haqiqiy UTC instant
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { actionType, eventName, telegramId, telegramName, items, date } = body

    if (!eventName || !items || items.length === 0 || !actionType) {
      return NextResponse.json({ error: "Ma'lumotlar to'liq emas" }, { status: 400 })
    }

    // Find or create user by telegramId
    let user = await prisma.user.findUnique({ where: { telegramId } })
    if (!user) {
      // Auto-create user from Mini App
      user = await prisma.user.create({
        data: { telegramId, name: telegramName || `Xodim (${telegramId})`, role: 'USER' }
      })
    }

    // Create all transactions
    const txDate = resolveTxDate(date)
    for (const entry of items) {
      const item = await prisma.item.findUnique({ where: { id: entry.itemId } })
      if (!item) continue

      // Birlik konvertatsiyasi: zaxira HAR DOIM bazaviy birlikda (dona).
      // Foydalanuvchi pachka tanlasa, packSize ga ko'paytiramiz.
      const packSize = Math.max(1, item.packSize || 1)
      const unitMode = entry.unitMode === 'pack' ? 'pack' : 'piece'
      const baseQty = unitMode === 'pack'
        ? Math.round((entry.quantity || 0) * packSize)
        : Math.round(entry.quantity || 0)
      if (baseQty <= 0) continue

      const isTake = actionType === 'TAKE'
      const newQty = isTake ? item.quantity - baseQty : item.quantity + baseQty
      if (isTake && newQty < 0) continue // Skip if not enough stock for TAKE

      const updateData: any = { quantity: newQty }
      if (!isTake && entry.totalPrice > 0 && baseQty > 0) {
        updateData.price = Math.round(entry.totalPrice / baseQty)
      }

      await prisma.item.update({
        where: { id: entry.itemId },
        data: updateData
      })

      await prisma.transaction.create({
        data: {
          userId: user.id,
          itemId: entry.itemId,
          quantity: isTake ? -baseQty : baseQty,
          type: actionType,
          status: 'APPROVED',
          eventName: eventName,
          totalPrice: entry.totalPrice,
          unitMode: unitMode,
          createdAt: txDate
        }
      })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Mini App submit error:', error)
    return NextResponse.json({ error: 'Server xatosi' }, { status: 500 })
  }
}
