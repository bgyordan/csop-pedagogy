'use client'
import { useState } from 'react'
import { FileText, Loader2 } from 'lucide-react'
import { generateDistributionPDF } from '@/lib/pdf-generator'
import { notify } from '@/components/ui/Toast'

interface Props {
  rows: any[]
  yearName: string
}

export default function DistributionPdfButton({ rows, yearName }: Props) {
  const [loading, setLoading] = useState(false)
  async function handleClick() {
    setLoading(true)
    try {
      await generateDistributionPDF(rows, yearName)
    } catch (e) {
      console.error(e)
      notify('Грешка при генериране на PDF')
    }
    setLoading(false)
  }
  return (
    <button onClick={handleClick} disabled={loading || rows.length === 0}
      className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-semibold text-white disabled:opacity-50 transition-opacity"
      style={{ backgroundColor: '#0f2240' }}
      title="Изтегли като PDF">
      {loading ? <Loader2 size={15} className="animate-spin" /> : <FileText size={15} />}
      PDF
    </button>
  )
}
