'use client'

import React, { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'

// Modal oynani DOM'ning eng tepasiga (document.body) chiqaradi.
//
// NEGA KERAK: `.glass-card` da `backdrop-filter` bor. CSS bo'yicha
// backdrop-filter (xuddi transform kabi) o'z ichidagi `position: fixed`
// elementlar uchun yangi "containing block" yaratadi. Ya'ni karta ichida
// turgan modal ekranga emas, kartaga nisbatan joylashadi va kartaning
// `overflow-hidden` i uni kesib tashlaydi. Uzun jadvalda modal ko'rinadigan
// joydan tashqarida ochilib, "tugma ishlamayapti" degan taassurot qoldiradi.
// Portal modalni body'ga ko'chiradi — fixed yana ekranga nisbatan ishlaydi.
export default function Modal({
  onClose,
  children,
}: {
  onClose?: () => void
  children: React.ReactNode
}) {
  const [mounted, setMounted] = useState(false)

  useEffect(() => setMounted(true), [])

  // Modal ochiq turganda orqa fon skroll qilinmasin + Escape yopsin
  useEffect(() => {
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose?.()
    }
    document.addEventListener('keydown', onKeyDown)

    return () => {
      document.body.style.overflow = prevOverflow
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [onClose])

  if (!mounted) return null

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 overflow-y-auto">
      {children}
    </div>,
    document.body
  )
}
