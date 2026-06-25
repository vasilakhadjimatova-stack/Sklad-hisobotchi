import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import prisma from '@/lib/prisma'

// Ovozli matnni (transcript) Claude (Anthropic) bilan ombor amaliga aylantiradi:
// { action, eventName, items: [{itemName, quantity}] }
export async function POST(req: NextRequest) {
  try {
    const { transcript, events } = await req.json()
    if (!transcript || !String(transcript).trim()) {
      return NextResponse.json({ error: 'Ovoz tushunilmadi' }, { status: 200 })
    }

    const key = process.env.ANTHROPIC_API_KEY
    if (!key) {
      return NextResponse.json(
        { error: 'AI kaliti sozlanmagan', needKey: true }, { status: 200 })
    }

    const dbItems = await prisma.item.findMany({ select: { name: true } })
    const itemNames = dbItems.map(i => i.name).join(', ')
    const eventList = Array.isArray(events) ? events.join(', ') : ''

    const system = `Sen ombor xodimi yordamchisisan. O'zbekcha gapdan ombor amalini ajratasan.
Mavjud mahsulotlar: [${itemNames}]
Mavjud tadbirlar: [${eventList}]

Qoidalar:
- "action": olindi/chiqdi/ketdi/berildi => "TAKE"; qaytdi/qo'shildi/keldi/kirim => "ADD". Aniq bo'lmasa "TAKE".
- "eventName": qaysi tadbir yoki kim uchun (masalan Impulse, Assodiq). Aytilmasa null.
- "items": massiv; har biri {"itemName": "...", "quantity": raqam}. itemName ni yuqoridagi mahsulotlar ro'yxatiga IMKON QADAR moslashtir. quantity butun raqam (so'z bilan aytilsa raqamga: besh=5, o'n=10).
- Bir nechta mahsulot aytilsa, hammasini items ga qo'sh.

FAQAT JSON qaytar, boshqa hech qanday matn yozma:
{"action":"TAKE","eventName":"Impulse","items":[{"itemName":"Stakan 25","quantity":5}]}
Agar mazmun tushunarsiz bo'lsa: {"error":"Tushunarsiz"}`

    const client = new Anthropic({ apiKey: key })
    const msg = await client.messages.create({
      model: 'claude-opus-4-8',
      max_tokens: 1024,
      system,
      // Tezroq javob (oddiy ajratish vazifasi)
      output_config: { effort: 'low' },
      messages: [{ role: 'user', content: `Gap: "${String(transcript).slice(0, 500)}"` }],
    } as any)

    let text = ''
    for (const block of (msg as any).content || []) {
      if (block.type === 'text') text += block.text
    }
    text = text.replace(/```json/g, '').replace(/```/g, '').trim()
    const s = text.indexOf('{'), e = text.lastIndexOf('}')
    if (s >= 0 && e > s) text = text.slice(s, e + 1)

    let parsed: any
    try {
      parsed = JSON.parse(text)
    } catch {
      return NextResponse.json({ error: 'Tushunilmadi', transcript }, { status: 200 })
    }
    return NextResponse.json({ ...parsed, transcript }, { status: 200 })
  } catch (err) {
    console.error('Voice parse error:', err)
    return NextResponse.json({ error: 'AI vaqtincha javob bermadi' }, { status: 200 })
  }
}
