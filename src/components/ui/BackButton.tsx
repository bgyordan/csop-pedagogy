'use client'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'

export function BackButton({ label = 'Назад', href = '/dashboard' }: { label?: string; href?: string }) {
  return (
    <Link
      href={href}
      className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800 mb-6"
    >
      <ArrowLeft size={15} />
      {label}
    </Link>
  )
}
