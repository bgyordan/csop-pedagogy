'use client'

import Link from 'next/link'
import { Download, Check } from 'lucide-react'
import { DOCUMENT_TYPE_LABELS, DocumentType, DocumentStatus } from '@/types'
import { generateAndDownloadDocument } from '@/lib/docx-generator'
import { getFullName } from '@/lib/utils'

const ALL_DOC_TYPES: DocumentType[] = [
  'protocol_1', 'protocol_2', 'protocol_3',
  'iup', 'iu_program', 'support_plan', 'parent_program'
]

const getModernBadge = (status: DocumentStatus) => {
  if (status === 'completed') return <span className="flex items-center justify-center w-5 h-5 rounded-full bg-emerald-50 border border-emerald-100 text-emerald-500 flex-shrink-0"><Check size={12} strokeWidth={3} /></span>
  if (status === 'in_progress') return <span className="flex items-center justify-center w-5 h-5 rounded-full bg-amber-50 border border-amber-100 text-amber-500 flex-shrink-0"><span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse"></span></span>
  return <span className="flex items-center justify-center w-5 h-5 rounded-full bg-slate-50 border border-slate-200 flex-shrink-0"><span className="w-1 h-1 rounded-full bg-slate-300"></span></span>
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

  return (
    <div className="space-y-2">
      {ALL_DOC_TYPES.map(docType => {
        const doc = docMap[docType]
        const status = doc?.status || 'empty'
        return (
          <div key={docType}
            className="flex items-center justify-between p-3 rounded-xl border border-slate-100 hover:bg-slate-50/50 transition-colors gap-2">
            <div className="flex items-center gap-3 min-w-0">
              {getModernBadge(status as DocumentStatus)}
              <span className="text-sm font-medium text-slate-700 truncate">{DOCUMENT_TYPE_LABELS[docType]}</span>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <Link
                href={`/documents/${studentId}/${docType}`}
                className="text-xs font-semibold px-3 py-1.5 rounded-xl bg-slate-50 border border-slate-200 hover:bg-slate-100 text-slate-700 transition-colors whitespace-nowrap"
              >
                {doc ? 'Редактирай' : 'Попълни'}
              </Link>
              {doc && status === 'completed' && (
                <button
                  onClick={() => handleDownload(docType)}
                  className="text-xs font-semibold px-2.5 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 transition-colors flex items-center gap-1 text-slate-600">
                  <Download size={13} />
                  <span className="hidden sm:inline">Word</span>
                </button>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
