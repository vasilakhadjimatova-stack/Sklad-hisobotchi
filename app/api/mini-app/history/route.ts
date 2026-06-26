import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

export const dynamic = 'force-dynamic'

// GET — oxirgi amallar ro'yxati (filtr: type=TAKE|ADD, q=qidiruv)
export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url)
    const type = url.searchParams.get('type')
    const q = (url.searchParams.get('q') || '').trim().toLowerCase()
    const limit = Math.min(120, Math.max(10, parseInt(url.searchParams.get('limit') || '60')))

    const where: any = {}
    if (type === 'TAKE' || type === 'ADD') where.type = type

    const txs = await prisma.transaction.findMany({
      where,
      take: q ? 300 : limit,
      orderBy: { createdAt: 'desc' },
      include: { item: true, user: true },
    })

    let rows = txs.map(t => ({
      id: t.id,
      itemName: t.item?.name || '—',
      type: t.type,
      quantity: t.quantity,
      unitMode: t.unitMode,
      unit: t.item?.unit || 'dona',
      packSize: t.item?.packSize || 1,
      packUnit: t.item?.packUnit || 'pachka',
      eventName: t.eventName || '',
      createdAt: t.createdAt,
      userName: t.user?.name || '',
    }))

    if (q) {
      rows = rows.filter(r =>
        r.itemName.toLowerCase().includes(q) ||
        r.eventName.toLowerCase().includes(q) ||
        r.userName.toLowerCase().includes(q)
      ).slice(0, limit)
    }

    return NextResponse.json({ rows })
  } catch (e) {
    console.error('History error:', e)
    return NextResponse.json({ error: 'Server xatosi', rows: [] }, { status: 200 })
  }
}

// POST — amalni bekor qilish: qoldiqni tiklaydi, yozuvni o'chiradi
export async function POST(req: NextRequest) {
  try {
    const { txId } = await req.json()
    if (!txId) return NextResponse.json({ error: "Amal ko'rsatilmagan" }, { status: 200 })

    const tx = await prisma.transaction.findUnique({
      where: { id: txId },
      include: { item: true },
    })
    if (!tx) return NextResponse.json({ error: 'Amal topilmadi' }, { status: 200 })

    // quantity belgili: TAKE manfiy, ADD musbat. Teskarisi = quantity - tx.quantity.
    if (tx.item) {
      await prisma.item.update({
        where: { id: tx.itemId },
        data: { quantity: tx.item.quantity - tx.quantity },
      })
    }
    await prisma.transaction.delete({ where: { id: txId } })

    return NextResponse.json({ success: true })
  } catch (e) {
    console.error('Cancel error:', e)
    return NextResponse.json({ error: 'Bekor qilishda xato' }, { status: 200 })
  }
}
