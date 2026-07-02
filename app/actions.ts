'use server'

import prisma from '@/lib/prisma';
import { revalidatePath } from 'next/cache'

async function getAdminUser() {
  const telegramId = "admin_dashboard_user"
  let user = await prisma.user.findUnique({ where: { telegramId } })
  if (!user) {
    user = await prisma.user.create({
      data: { telegramId, name: "Admin (Sayt)", role: "ADMIN" }
    })
  }
  return user
}

export async function createNewItem(formData: FormData) {
  const name = formData.get('name')?.toString()
  const unit = formData.get('unit')?.toString()?.trim() || 'Dona'
  const packUnit = formData.get('packUnit')?.toString()?.trim() || 'pachka'
  const packSize = Math.max(1, Math.floor(Number(formData.get('packSize')) || 1))
  const price = Math.max(0, Number(formData.get('price')) || 0) // 1 bazaviy birlik (dona) narxi

  // Boshlang'ich miqdor pachka va/yoki donada kiritiladi — bazaviy donaga aylantiriladi
  const qtyPack = Math.max(0, Math.floor(Number(formData.get('qtyPack')) || 0))
  const qtyPiece = Math.max(0, Math.floor(Number(formData.get('qtyPiece')) || 0))
  const quantity = qtyPack * packSize + qtyPiece

  if (!name || quantity <= 0) return { error: "Ma'lumotlar noto'g'ri (Soni 0 dan katta bo'lishi kerak)" }

  try {
    const existing = await prisma.item.findUnique({ where: { name } })
    if (existing) return { error: "Bunday mahsulot allaqachon mavjud. Kirim bo'limidan qo'shing." }

    const admin = await getAdminUser()

    const item = await prisma.item.create({
      data: { name, quantity, unit, packUnit, packSize, price }
    })

    await prisma.transaction.create({
      data: {
        userId: admin.id,
        itemId: item.id,
        quantity: quantity,
        type: 'ADD',
        status: 'APPROVED'
      }
    })

    revalidatePath('/')
    return { success: true }
  } catch (err) {
    console.error(err)
    return { error: "Xatolik yuz berdi" }
  }
}

export async function addStock(formData: FormData) {
  const itemId = formData.get('itemId')?.toString()
  const quantity = Number(formData.get('quantity'))

  // Kelgan narx (1 bazaviy dona uchun) — ixtiyoriy
  const priceRaw = formData.get('price')
  const hasPrice = priceRaw !== null && priceRaw.toString().trim() !== '' && !isNaN(Number(priceRaw))
  const incomingPrice = hasPrice ? Math.max(0, Number(priceRaw)) : null

  if (!itemId || isNaN(quantity) || quantity <= 0) return { error: "Ma'lumotlar noto'g'ri" }

  try {
    const item = await prisma.item.findUnique({ where: { id: itemId } })
    if (!item) return { error: "Mahsulot topilmadi" }

    const admin = await getAdminUser()
    const newQuantity = item.quantity + quantity

    // Tortilgan o'rtacha narx: narx kiritilsa yangilanadi, aks holda eski narx qoladi
    let newPrice = item.price
    if (incomingPrice !== null) {
      const oldQty = Math.max(0, item.quantity)
      newPrice = oldQty > 0
        ? Math.round(((oldQty * item.price + quantity * incomingPrice) / (oldQty + quantity)) * 100) / 100
        : incomingPrice
    }

    await prisma.item.update({
      where: { id: itemId },
      data: { quantity: newQuantity, price: newPrice }
    })

    await prisma.transaction.create({
      data: {
        userId: admin.id,
        itemId: item.id,
        quantity: quantity,
        type: 'ADD',
        status: 'APPROVED',
        // Xarid narxi tarixi (kelgan narx × miqdor)
        totalPrice: incomingPrice !== null ? quantity * incomingPrice : null,
      }
    })

    revalidatePath('/')
    return { success: true }
  } catch (err) {
    console.error(err)
    return { error: "Xatolik yuz berdi" }
  }
}

// Mavjud mahsulotni tahrirlash: nom + narx + birlik/pachka sozlamasi.
// Zaxira (quantity) o'zgarmaydi — u doim bazaviy birlikda (dona) qoladi.
// Narx 1 bazaviy birlik (dona) uchun; o'zgarsa keyingi chiqimlar yangi narxda hisoblanadi.
// Nom o'zgarsa tarix buzilmaydi (tranzaksiyalar itemId orqali bog'langan).
export async function setItemUnit(formData: FormData) {
  const itemId = formData.get('itemId')?.toString()
  const name = formData.get('name')?.toString()?.trim()
  const unit = formData.get('unit')?.toString()?.trim() || 'Dona'
  const packUnit = formData.get('packUnit')?.toString()?.trim() || 'pachka'
  const packSize = Math.max(1, Math.floor(Number(formData.get('packSize')) || 1))

  if (!itemId) return { error: "Mahsulot tanlanmadi" }
  if (!name) return { error: "Nom bo'sh bo'lishi mumkin emas" }

  try {
    const item = await prisma.item.findUnique({ where: { id: itemId } })
    if (!item) return { error: "Mahsulot topilmadi" }

    // Nom o'zgarsa — boshqa mahsulotda shu nom yo'qligini tekshirish (nom unique)
    if (name !== item.name) {
      const clash = await prisma.item.findUnique({ where: { name } })
      if (clash && clash.id !== itemId) {
        return { error: "Bunday nomli mahsulot allaqachon bor" }
      }
    }

    const data: any = { name, unit, packUnit, packSize }

    // Narx — faqat to'g'ri qiymat (bo'sh emas, son) kelganda yangilanadi
    const priceRaw = formData.get('price')
    if (priceRaw !== null && priceRaw.toString().trim() !== '' && !isNaN(Number(priceRaw))) {
      data.price = Math.max(0, Number(priceRaw))
    }

    await prisma.item.update({
      where: { id: itemId },
      data
    })

    revalidatePath('/')
    revalidatePath('/history')
    return { success: true }
  } catch (err) {
    console.error(err)
    return { error: "Xatolik yuz berdi" }
  }
}

export async function adjustStock(formData: FormData) {
  const itemId = formData.get('itemId')?.toString()
  const newQuantity = Number(formData.get('quantity'))
  const reason = formData.get('reason')?.toString() || "Inventarizatsiya"

  if (!itemId || isNaN(newQuantity) || newQuantity < 0) return { error: "Ma'lumotlar noto'g'ri" }

  try {
    const item = await prisma.item.findUnique({ where: { id: itemId } })
    if (!item) return { error: "Mahsulot topilmadi" }

    const admin = await getAdminUser()
    const difference = newQuantity - item.quantity

    await prisma.item.update({
      where: { id: itemId },
      data: { quantity: newQuantity }
    })

    await prisma.transaction.create({
      data: {
        userId: admin.id,
        itemId: item.id,
        quantity: difference,
        type: 'ADJUST',
        status: 'APPROVED',
        eventName: reason
      }
    })

    revalidatePath('/')
    return { success: true }
  } catch (err) {
    console.error(err)
    return { error: "Xatolik yuz berdi" }
  }
}
