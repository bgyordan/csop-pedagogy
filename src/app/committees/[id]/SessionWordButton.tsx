'use client'

import { Download } from 'lucide-react'
import { generateCommitteeProtocol } from '@/lib/docx-generator'
import { getFullName } from '@/lib/utils'

interface Props {
  session: {
    session_date: string
    agenda?: string | null
    protocol?: string | null
    decisions?: string | null
    deadline?: string | null
  }
  committee: { name: string }
  members: { staff: any; role?: string | null }[]
  sessionNumber: number
}

export function SessionWordButton({ session, committee, members, sessionNumber }: Props) {
  async function handleDownload() {
    await generateCommitteeProtocol(
      committee,
      session,
      members,
      sessionNumber,
      new Date().getFullYear().toString()
    )
  }

  return (
    <button
      onClick={handleDownload}
      className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-slate-200 text-xs font-medium text-slate-600 hover:bg-slate-50 transition-colors flex-shrink-0"
    >
      <Download size={12} />
      Word
    </button>
  )
}
