import { NextRequest, NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

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
    const txDate = date ? new Date(date) : new Date()
    for (const entry of items) {
      const item = await prisma.item.findUnique({ where: { id: entry.itemId } })
      if (!item) continue

      const isTake = actionType === 'TAKE'
      const newQty = isTake ? item.quantity - entry.quantity : item.quantity + entry.quantity
      if (isTake && newQty < 0) continue // Skip if not enough stock for TAKE

      const updateData: any = { quantity: newQty }
      if (!isTake && entry.totalPrice > 0 && entry.quantity > 0) {
        updateData.price = Math.round(entry.totalPrice / entry.quantity)
      }

      await prisma.item.update({
        where: { id: entry.itemId },
        data: updateData
      })

      await prisma.transaction.create({
        data: {
          userId: user.id,
          itemId: entry.itemId,
          quantity: isTake ? -entry.quantity : entry.quantity,
          type: actionType,
          status: 'APPROVED',
          eventName: eventName,
          totalPrice: entry.totalPrice,
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
