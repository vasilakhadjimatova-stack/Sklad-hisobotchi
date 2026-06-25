import { NextRequest, NextResponse } from 'next/server'
import { GoogleGenerativeAI } from '@google/generative-ai'
import prisma from '@/lib/prisma'

// Ovozli matnni (transcript) Gemini bilan ombor amaliga aylantiradi:
// { action, eventName, items: [{itemName, quantity}] }
export async function POST(req: NextRequest) {
  try {
    const { transcript, events } = await req.json()
    if (!transcript || !String(transcript).trim()) {
      return NextResponse.json({ error: 'Ovoz tushunilmadi' }, { status: 200 })
    }

    const key = process.env.GEMINI_API_KEY
    if (!key || key === 'BU_YERGA_GEMINI_KEY_YOZING') {
      return NextResponse.json(
        { error: 'AI kaliti sozlanmagan', needKey: true }, { status: 200 })
    }

    const dbItems = await prisma.item.findMany({ select: { name: true } })
    const itemNames = dbItems.map(i => i.name).join(', ')
    const eventList = Array.isArray(events) ? events.join(', ') : ''

    const genAI = new GoogleGenerativeAI(key)
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' })

    const prompt = `Sen ombor xodimi yordamchisisan. Quyidagi O'ZBEKCHA gapdan ombor amalini ajrat.
Mavjud mahsulotlar: [${itemNames}]
Mavjud tadbirlar: [${eventList}]

Qoidalar:
- "action": olindi/chiqdi/ketdi/berildi => "TAKE"; qaytdi/qo'shildi/keldi/kirim => "ADD". Aniq bo'lmasa "TAKE".
- "eventName": qaysi tadbir yoki kim uchun (masalan Impulse, Assodiq). Aytilmasa null.
- "items": massiv; har biri {"itemName": "...", "quantity": raqam}. itemName ni yuqoridagi mahsulotlar ro'yxatiga IMKON QADAR moslashtir. quantity faqat butun raqam (so'z bilan aytilsa raqamga aylantir: besh=5, o'n=10).
- Bir nechta mahsulot aytilsa, hammasini items ga qo'sh.

FAQAT JSON qaytar, boshqa hech narsa yozma:
{"action":"TAKE","eventName":"Impulse","items":[{"itemName":"Stakan 25","quantity":5}]}
Agar mazmun tushunarsiz bo'lsa: {"error":"Tushunarsiz"}

Gap: "${String(transcript).slice(0, 500)}"`

    const result = await model.generateContent(prompt)
    let text = result.response.text().replace(/```json/g, '').replace(/```/g, '').trim()
    let parsed: any
    try {
      parsed = JSON.parse(text)
    } catch {
      return NextResponse.json({ error: 'Tushunilmadi', transcript }, { status: 200 })
    }
    return NextResponse.json({ ...parsed, transcript }, { status: 200 })
  } catch (e) {
    console.error('Voice parse error:', e)
    return NextResponse.json({ error: 'AI vaqtincha javob bermadi' }, { status: 200 })
  }
}
