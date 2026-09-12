'use client'
import { useState } from 'react'
import { FileSpreadsheet, Loader2, ShieldAlert } from 'lucide-react'
import { getFullReport } from './actions'
import { generateStudentReportExcel } from '@/lib/excel-generator'

export default function FullReportClient() {
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState('')
  const [count, setCount] = useState<number | null>(null)

  async function download() {
    setLoading(true); setErr('')
    const res: any = await getFullReport()
    if (res.error) { setErr(res.error); setLoading(false); return }
    setCount(res.rows.length)
    generateStudentReportExcel(res.headers, res.rows)
    setLoading(false)
  }

  return (
    <div className="p-4 md:p-8 max-w-2xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <div className="p-2.5 rounded-xl" style={{ backgroundColor: '#0f2240' }}><FileSpreadsheet size={20} className="text-white" /></div>
        <div>
          <h1 className="text-xl md:text-2xl font-semibold text-slate-800">Пълна справка за учениците</h1>
          <p className="text-slate-500 text-sm mt-0.5">Всички данни в един Excel — филтрирайте и подреждайте в таблицата.</p>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 space-y-4">
        <p className="text-sm text-slate-600">
          Един файл с по един ред на ученик: лични данни, паралелка и училище, класен и ЕПЛР екип, родители и телефони,
          и документите (РЦПППО, ТЕЛК, алергии) с номер, дати, срок, вид подкрепа и диагноза. Горният ред е замразен и
          с включен автофилтър.
        </p>
        <div className="flex items-start gap-2 px-3 py-2.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-xs">
          <ShieldAlert size={15} className="shrink-0 mt-0.5" />
          Съдържа лични данни (телефони, диагнози). Сваляйте и съхранявайте отговорно.
        </div>
        <button onClick={download} disabled={loading}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-medium text-white disabled:opacity-60 hover:opacity-90" style={{ backgroundColor: '#0f2240' }}>
          {loading ? <Loader2 size={16} className="animate-spin" /> : <FileSpreadsheet size={16} />} Изтегли пълната справка (Excel)
        </button>
        {count !== null && !err && <p className="text-xs text-slate-500">Готово — {count} ученика в справката.</p>}
        {err && <p className="text-xs text-rose-600">{err}</p>}
      </div>
    </div>
  )
}
