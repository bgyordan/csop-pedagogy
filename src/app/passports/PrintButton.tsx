'use client'
import { Printer } from 'lucide-react'
export default function PrintButton() {
  return (
    <button type="button" onClick={() => window.print()}
      className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-white text-sm hover:opacity-90" style={{ backgroundColor: '#0f2240' }}>
      <Printer size={15} /> Печат
    </button>
  )
}
