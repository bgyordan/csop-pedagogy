'use client'

import { useRouter } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'

export function BackButton({ label = 'Назад' }: { label?: string }) {
  const router = useRouter()
  return (
    <button
      onClick={() => router.back()}
      className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800 mb-6"
    >
      <ArrowLeft size={15} />
      {label}
    </button>
  )
}
