'use server'

import { PrismaClient } from '@prisma/client'
import { revalidatePath } from 'next/cache'

const prisma = new PrismaClient()

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

  if (!name || isNaN(quantity) || quantity <= 0) return { error: "Ma'lumotlar noto'g'ri (Soni 0 dan katta bo'lishi kerak)" }

  try {
    const existing = await prisma.item.findUnique({ where: { name } })
    if (existing) return { error: "Bunday mahsulot allaqachon mavjud. Kirim bo'limidan qo'shing." }

    const admin = await getAdminUser()

    const item = await prisma.item.create({
      data: { name, quantity }
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
