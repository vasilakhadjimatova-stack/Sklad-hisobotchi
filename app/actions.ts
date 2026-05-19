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
  const quantity = Number(formData.get('quantity'))
  const unit = formData.get('unit')?.toString()?.trim() || 'Dona'
  const packUnit = formData.get('packUnit')?.toString()?.trim() || 'pachka'
  const packSize = Math.max(1, Math.floor(Number(formData.get('packSize')) || 1))

  if (!name || isNaN(quantity) || quantity <= 0) return { error: "Ma'lumotlar noto'g'ri (Soni 0 dan katta bo'lishi kerak)" }

  try {
    const existing = await prisma.item.findUnique({ where: { name } })
    if (existing) return { error: "Bunday mahsulot allaqachon mavjud. Kirim bo'limidan qo'shing." }

    const admin = await getAdminUser()

    const item = await prisma.item.create({
      data: { name, quantity, unit, packUnit, packSize }
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

  if (!itemId || isNaN(quantity) || quantity <= 0) return { error: "Ma'lumotlar noto'g'ri" }

  try {
    const item = await prisma.item.findUnique({ where: { id: itemId } })
    if (!item) return { error: "Mahsulot topilmadi" }

    const admin = await getAdminUser()
    const newQuantity = item.quantity + quantity

    await prisma.item.update({
      where: { id: itemId },
      data: { quantity: newQuantity }
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

// Mavjud mahsulotning birlik/pachka sozlamasini belgilash (konvertatsiya uchun).
// Zaxira (quantity) o'zgarmaydi — u doim bazaviy birlikda (dona) qoladi.
export async function setItemUnit(formData: FormData) {
  const itemId = formData.get('itemId')?.toString()
  const unit = formData.get('unit')?.toString()?.trim() || 'Dona'
  const packUnit = formData.get('packUnit')?.toString()?.trim() || 'pachka'
  const packSize = Math.max(1, Math.floor(Number(formData.get('packSize')) || 1))

  if (!itemId) return { error: "Mahsulot tanlanmadi" }

  try {
    const item = await prisma.item.findUnique({ where: { id: itemId } })
    if (!item) return { error: "Mahsulot topilmadi" }

    await prisma.item.update({
      where: { id: itemId },
      data: { unit, packUnit, packSize }
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
