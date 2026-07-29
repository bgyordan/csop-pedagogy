'use client'
import Link from 'next/link'
import { Download, Check } from 'lucide-react'
import { DOCUMENT_TYPE_LABELS, DocumentType, DocumentStatus } from '@/types'
import { generateAndDownloadDocument } from '@/lib/docx-generator'

const ALL_DOC_TYPES: DocumentType[] = [
  'protocol_1', 'protocol_2', 'protocol_3',
  'iup', 'iu_program', 'support_plan', 'parent_program'
]

// Кратки имена за компактните плочки
const DOC_SHORT: Record<DocumentType, string> = {
  protocol_1: 'Протокол 1', protocol_2: 'Протокол 2', protocol_3: 'Протокол 3',
  iup: 'ИУП', iu_program: 'ИУ програма', support_plan: 'План подкрепа', parent_program: 'Програма родители',
}

interface Props {
  docMap: Record<string, any>
  studentId: string
  student: any
  eplr: any
  yearName: string
  className: string
}

export default function DocumentsList({ docMap, studentId, student, eplr, yearName, className }: Props) {
  async function handleDownload(docType: DocumentType) {
    const doc = docMap[docType]
    if (!doc) return
    await generateAndDownloadDocument(
      docType,
      student,
      eplr || {},
      { ...doc.data, class_name: className },
      yearName
    )
  }

  const completed = ALL_DOC_TYPES.filter(dt => docMap[dt]?.status === 'completed').length
  const inProgress = ALL_DOC_TYPES.filter(dt => docMap[dt]?.status === 'in_progress').length

  const dot = (status: string) =>
    status === 'completed' ? 'bg-emerald-400'
    : status === 'in_progress' ? 'bg-amber-400'
    : 'bg-slate-300'

  return (
    <div>
      {/* Компактни броячи */}
      <div className="flex items-center gap-3 mb-3 text-xs">
        <span className="flex items-center gap-1.5 text-slate-600"><span className="w-2 h-2 rounded-full bg-emerald-400"></span>{completed} завършени</span>
        <span className="flex items-center gap-1.5 text-slate-600"><span className="w-2 h-2 rounded-full bg-amber-400"></span>{inProgress} в процес</span>
        <span className="flex items-center gap-1.5 text-slate-400"><span className="w-2 h-2 rounded-full bg-slate-300"></span>{ALL_DOC_TYPES.length - completed - inProgress} непопълнени</span>
      </div>

      {/* Плочки в решетка */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
        {ALL_DOC_TYPES.map(docType => {
          const doc = docMap[docType]
          const status = doc?.status || 'empty'
          return (
            <div key={docType}
              className="flex flex-col gap-2 p-3 rounded-xl border border-slate-100 hover:border-slate-200 hover:bg-slate-50/50 transition-colors">
              <div className="flex items-center gap-2 min-w-0">
                <span className={`w-2 h-2 rounded-full flex-shrink-0 ${dot(status)}`}></span>
                <span className="text-xs font-semibold text-slate-700 truncate">{DOC_SHORT[docType]}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Link
                  href={`/documents/${studentId}/${docType}`}
                  className="flex-1 text-center text-[11px] font-semibold px-2 py-1 rounded-lg bg-slate-50 border border-slate-200 hover:bg-slate-100 text-slate-700 transition-colors">
                  {doc ? 'Редактирай' : 'Попълни'}
                </Link>
                {doc && status === 'completed' && (
                  <button
                    onClick={() => handleDownload(docType)}
                    title="Изтегли Word"
                    className="px-2 py-1 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 transition-colors text-slate-500 flex-shrink-0">
                    <Download size={12} />
                  </button>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
