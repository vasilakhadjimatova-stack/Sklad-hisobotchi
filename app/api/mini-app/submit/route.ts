import { NextRequest, NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { eventName, telegramId, telegramName, items } = body

    if (!eventName || !items || items.length === 0) {
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
    const now = new Date()
    for (const entry of items) {
      const item = await prisma.item.findUnique({ where: { id: entry.itemId } })
      if (!item) continue

      const newQty = item.quantity - entry.quantity
      if (newQty < 0) continue // Skip if not enough stock

      await prisma.item.update({
        where: { id: entry.itemId },
        data: { quantity: newQty }
      })

      await prisma.transaction.create({
        data: {
          userId: user.id,
          itemId: entry.itemId,
          quantity: -entry.quantity,
          type: 'TAKE',
          status: 'APPROVED',
          eventName: eventName,
          totalPrice: entry.totalPrice,
          createdAt: now
        }
      })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Mini App submit error:', error)
    return NextResponse.json({ error: 'Server xatosi' }, { status: 500 })
  }
}
