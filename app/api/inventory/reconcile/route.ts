import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

// Inventarizatsiya: kiritilgan haqiqiy sanoqqa qarab qoldiqni to'g'rilaydi.
// Har o'zgargan mahsulotga ADJUST yozuvi qo'shiladi (audit).
export async function POST(req: NextRequest) {
  try {
    const { counts } = await req.json()
    if (!Array.isArray(counts) || counts.length === 0) {
      return NextResponse.json({ error: "Sanoq kiritilmagan" }, { status: 200 })
    }

    const actor = (await prisma.user.findFirst({ where: { role: 'ADMIN' } }))
      || (await prisma.user.findFirst())
    const actorId = actor?.id || null

    const now = new Date()
    let changed = 0
    const details: any[] = []

    for (const c of counts) {
      const physical = Math.round(Number(c.physical))
      if (!c.itemId || !Number.isFinite(physical) || physical < 0) continue
      const item = await prisma.item.findUnique({ where: { id: c.itemId } })
      if (!item) continue
      const delta = physical - item.quantity
      if (delta === 0) continue

      await prisma.item.update({ where: { id: item.id }, data: { quantity: physical } })
      if (actorId) {
        await prisma.transaction.create({
          data: {
            userId: actorId,
            itemId: item.id,
            quantity: delta,
            type: 'ADJUST',
            status: 'APPROVED',
            eventName: 'Inventarizatsiya',
            unitMode: null,
            createdAt: now,
          },
        })
      }
      details.push({ name: item.name, old: item.quantity, new: physical, delta })
      changed++
    }

    return NextResponse.json({ success: true, changed, details })
  } catch (e) {
    console.error('Reconcile error:', e)
    return NextResponse.json({ error: 'Server xatosi' }, { status: 200 })
  }
}
