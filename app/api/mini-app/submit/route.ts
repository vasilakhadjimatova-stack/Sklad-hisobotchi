import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma';
import { resolveTxDate } from '@/lib/date'

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
      // "Faqat pachkada" belgilangan mahsulotda dona qabul qilinmaydi — eski
      // mini-ilova nusxasi yoki ovozli kiritish 'piece' yuborsa ham pachkaga o'tadi.
      const packOnly = packSize > 1 && item.packOnly
      const unitMode = packOnly || entry.unitMode === 'pack' ? 'pack' : 'piece'
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
