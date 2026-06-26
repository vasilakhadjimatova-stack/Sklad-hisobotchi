import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import prisma from '@/lib/prisma'

export const maxDuration = 60

// 1) Ovoz (audio) -> matn: OpenAI gpt-4o-transcribe
// 2) Matn -> ombor amali: Claude (claude-opus-4-8)
//    => { transcript, action, eventName, items: [{itemName, quantity}] }

async function transcribeOpenAI(audioB64: string, mimeType: string, key: string): Promise<string> {
  const buf = Buffer.from(audioB64, 'base64')
  const ext = mimeType.includes('mp4') || mimeType.includes('m4a') ? 'mp4'
    : mimeType.includes('ogg') ? 'ogg'
    : mimeType.includes('wav') ? 'wav'
    : mimeType.includes('mpeg') || mimeType.includes('mp3') ? 'mp3'
    : 'webm'
  const form = new FormData()
  form.append('file', new Blob([buf], { type: mimeType || 'audio/webm' }), `audio.${ext}`)
  form.append('model', 'gpt-4o-transcribe')
  // DIQQAT: OpenAI 'uz' til kodini qabul qilmaydi. Avto-aniqlash + qisqa prompt
  // bilan o'zbekchaga yo'naltiramiz. Aniq misol (mahsulot/miqdor) YOZMAYMIZ —
  // aks holda jim/shovqinli audioda prompt takrorlanib soxta amal chiqadi.
  form.append('prompt', "Bu o'zbek tilidagi ombor amali — chiqim, kirim yoki qaytarish.")
  const r = await fetch('https://api.openai.com/v1/audio/transcriptions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}` },
    body: form,
  })
  if (!r.ok) {
    const t = await r.text().catch(() => '')
    throw new Error(`OpenAI ${r.status}: ${t.slice(0, 300)}`)
  }
  const d: any = await r.json()
  return String(d.text || '')
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { audio, mimeType, events } = body
    let transcript: string = body.transcript || ''

    // 1) Audio bo'lsa — OpenAI bilan matnga aylantiramiz
    if (!transcript && audio) {
      const okey = process.env.OPENAI_API_KEY
      if (!okey) {
        return NextResponse.json({ error: 'Ovoz kaliti sozlanmagan', needKey: 'openai' }, { status: 200 })
      }
      try {
        transcript = await transcribeOpenAI(audio, mimeType || 'audio/webm', okey)
      } catch (e) {
        console.error('Transcribe error:', e)
        return NextResponse.json({ error: "Ovozni eshitib bo'lmadi, qaytadan urinib ko'ring" }, { status: 200 })
      }
    }

    if (!transcript || !transcript.trim()) {
      return NextResponse.json({ error: 'Ovoz tushunilmadi' }, { status: 200 })
    }

    // 2) Matnni Claude bilan tahlil qilamiz
    const akey = process.env.ANTHROPIC_API_KEY
    if (!akey) {
      return NextResponse.json({ error: 'AI kaliti sozlanmagan', needKey: 'anthropic', transcript }, { status: 200 })
    }

    const dbItems = await prisma.item.findMany({ select: { name: true } })
    const itemNames = dbItems.map(i => i.name).join(', ')
    const eventList = Array.isArray(events) ? events.join(', ') : ''

    const todayTashkent = new Date(Date.now() + 5 * 60 * 60 * 1000).toISOString().slice(0, 10)
    const system = `Sen ombor xodimi yordamchisisan. O'zbekcha gapdan ombor amalini ajratasan.
Bugungi sana (Toshkent): ${todayTashkent}.
Mavjud mahsulotlar: [${itemNames}]
Mavjud tadbirlar: [${eventList}]

Qoidalar:
- "action": olindi/chiqdi/ketdi/berildi => "TAKE"; qaytdi/qo'shildi/keldi/kirim/qaytarib ber => "ADD". Aniq bo'lmasa "TAKE".
- BEKOR QILISH: "bekor qil"/"bekor qilindi"/"xato olindi"/"noto'g'ri olindi"/"ortga qaytar"/"qaytarib qo'y" — bu olingan narsani QAYTARISH, ya'ni action "ADD" (qoldiqни tiklaydi). Faqat aniq "kirimni/qo'shilganni bekor qil" desa => "TAKE".
- "eventName": qaysi tadbir yoki kim uchun (masalan Impulse, Assodiq). Aytilmasa null.
- "date": agar gapda sana aytilsa "YYYY-MM-DD" formatda qaytar, bugungi sanaga nisbatan hisobla: "kecha"=1 kun oldin, "ikki kun oldin"=2 kun oldin, "25-iyun"/"25 iyun"=shu yilning shu kuni, "1-iyul"=1-iyul. Sana aytilmasa null (bugun ishlatiladi).
- "items": massiv; har biri {"itemName": "...", "quantity": raqam}. itemName ni yuqoridagi mahsulotlar ro'yxatiga IMKON QADAR moslashtir. quantity butun raqam (so'z bilan aytilsa raqamga: besh=5, o'n=10).
- Bir nechta mahsulot aytilsa, hammasini items ga qo'sh.

FAQAT JSON qaytar, boshqa hech qanday matn yozma:
{"action":"TAKE","eventName":"Impulse","date":null,"items":[{"itemName":"Stakan 25","quantity":5}]}
Agar mazmun tushunarsiz bo'lsa: {"error":"Tushunarsiz"}`

    const client = new Anthropic({ apiKey: akey })
    const msg = await client.messages.create({
      model: 'claude-opus-4-8',
      max_tokens: 1024,
      system,
      output_config: { effort: 'low' },
      messages: [{ role: 'user', content: `Gap: "${transcript.slice(0, 500)}"` }],
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
    console.error('Voice error:', err)
    return NextResponse.json({ error: 'AI vaqtincha javob bermadi' }, { status: 200 })
  }
}
