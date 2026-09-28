// ERP (impulse-erp) kalendaridan tadbirlarni olish.
//
// Sklad mini-ilovasi ochilganda kunning tadbirlari kartochka bo'lib chiqadi va
// chiqim to'g'ridan-to'g'ri tadbirga yoziladi — ilgari xodim tadbir nomini
// qo'lda yozardi va chiqim ko'pincha kechikardi yoki umuman qilinmasdi.
//
// Sozlama (Railway env):
//   ERP_URL      — ERP manzili, masalan https://impulse-erp.up.railway.app
//   ERP_API_KEY  — ERP'dagi SKLAD_API_KEY bilan bir xil qiymat
// Ikkalasi bo'lmasa — funksiya jim "off" qaytaradi va mini-ilova avvalgidek
// qo'lda tadbir kiritish bilan ishlaydi. ERP javob bermasa ham shunday:
// tadbirlar yuklanmasligi chiqimni to'xtatib qo'ymasligi kerak.

export type ErpEvent = {
  id: number
  name: string        // ERP kalendaridagi nom (mijoz nomi)
  type?: string       // tadbir turi, masalan «Seminar» (eski ERP'da yo'q)
  date: string        // YYYY-MM-DD (Toshkent kuni)
  start_time: string  // HH:MM
  end_time: string
  hall: string
  guests: number
  status: string
}

export type ErpEventsResult =
  | { status: 'ok'; events: ErpEvent[] }
  | { status: 'off'; events: [] }      // sozlanmagan
  | { status: 'error'; events: [] }    // sozlangan, lekin javob bermadi

const TIMEOUT_MS = 4000

export async function fetchErpEvents(from: string, to: string): Promise<ErpEventsResult> {
  const base = (process.env.ERP_URL || '').trim().replace(/\/+$/, '')
  const key = (process.env.ERP_API_KEY || '').trim()
  if (!base || !key) return { status: 'off', events: [] }

  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS)
  try {
    const url = `${base}/api/sklad/events?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`
    const res = await fetch(url, {
      headers: { 'X-Api-Key': key, Accept: 'application/json' },
      cache: 'no-store',
      signal: ctrl.signal,
    })
    if (!res.ok) {
      console.error(`[erp] tadbirlar yuklanmadi: HTTP ${res.status}`)
      return { status: 'error', events: [] }
    }
    const data = await res.json()
    if (!data?.ok || !Array.isArray(data.events)) {
      console.error('[erp] kutilmagan javob:', JSON.stringify(data).slice(0, 200))
      return { status: 'error', events: [] }
    }
    return { status: 'ok', events: data.events as ErpEvent[] }
  } catch (err) {
    console.error('[erp] ulanib bo\'lmadi:', err instanceof Error ? err.message : err)
    return { status: 'error', events: [] }
  } finally {
    clearTimeout(timer)
  }
}
