// Asia/Tashkent doimiy UTC+5 (yozgi vaqt yo'q).
const TASHKENT_OFFSET_MS = 5 * 60 * 60 * 1000

// Forma faqat sanani yuboradi ("YYYY-MM-DD"). Uni joriy soat-daqiqa bilan
// birlashtiramiz, aks holda vaqt 00:00 bo'lib qoladi va o'sha kundagi
// yozuvlar tartibi buziladi.
//
// Bugungi sana tanlansa — aniq hozirgi vaqt ishlatiladi.
// O'tgan sana tanlansa — o'sha kun, hozirgi soat-daqiqa (Toshkent vaqtida).
export function resolveTxDate(dateStr?: string | null): Date {
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
