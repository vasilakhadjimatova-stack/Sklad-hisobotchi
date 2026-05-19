// Birlik/pachka ko'rsatish yordamchisi.
// Zaxira va tranzaksiya quantity'si HAR DOIM bazaviy birlikda (dona) saqlanadi.
// packSize > 1 bo'lsa mahsulot pachkali; unitMode chiqim qaysi birlikda
// kiritilganini bildiradi ("pack" | "piece" | null).

type ItemLike = {
  unit?: string | null
  packUnit?: string | null
  packSize?: number | null
}

// Tranzaksiya/chiqim miqdorini o'qiladigan matnga aylantirish.
// Masalan: 55 dona, packSize 25 → "55 dona (2 pachka 5 dona)";
//          50 dona, unitMode "pack" → "2 pachka".
export function formatQty(
  quantity: number,
  item: ItemLike,
  unitMode?: string | null,
): string {
  const abs = Math.abs(quantity || 0)
  const unit = (item.unit || 'dona').toLowerCase()
  const packSize = Math.max(1, item.packSize || 1)
  const packUnit = (item.packUnit || 'pachka').toLowerCase()

  if (packSize <= 1) return `${abs} ${unit}`

  if (unitMode === 'pack' && abs % packSize === 0) {
    return `${abs / packSize} ${packUnit}`
  }

  if (abs >= packSize) {
    const packs = Math.floor(abs / packSize)
    const rem = abs % packSize
    const breakdown = rem === 0
      ? `${packs} ${packUnit}`
      : `${packs} ${packUnit} ${rem} ${unit}`
    return `${abs} ${unit} (${breakdown})`
  }

  return `${abs} ${unit}`
}

// Zaxira qoldig'i uchun qisqa pachka eslatmasi (masalan "· 4 pachka").
export function packHint(quantity: number, item: ItemLike): string {
  const packSize = Math.max(1, item.packSize || 1)
  if (packSize <= 1) return ''
  const packs = Math.floor(Math.abs(quantity || 0) / packSize)
  if (packs <= 0) return ''
  return `${packs} ${(item.packUnit || 'pachka').toLowerCase()}`
}
