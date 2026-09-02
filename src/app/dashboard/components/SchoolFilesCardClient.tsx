'use client'
import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { School, FileText, Download, ChevronDown, ChevronUp, Paperclip } from 'lucide-react'

type Group = { name: string; files: { id: string; name: string; path: string }[] }

export default function SchoolFilesCardClient({ groups }: { groups: Group[] }) {
  const supabase = createClient()
  const [openIdx, setOpenIdx] = useState<number | null>(null)

  async function download(path: string, name: string) {
    const { data, error } = await supabase.storage.from('school-files').download(path)
    if (error || !data) return
    const url = URL.createObjectURL(data)
    const a = document.createElement('a'); a.href = url; a.download = name
    document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url)
  }

  return (
    <div className="bg-white rounded-2xl border border-slate-200/70 p-5 shadow-sm">
      <div className="flex items-center gap-2 mb-4 pb-3 border-b border-slate-100">
        <School size={18} className="text-blue-500" />
        <h2 className="font-semibold text-slate-800 text-sm">Училищни учебни планове</h2>
      </div>
      <div className="space-y-1.5">
        {groups.map((g, i) => {
          const open = openIdx === i
          return (
            <div key={i} className="rounded-xl border border-slate-200 overflow-hidden">
              <button onClick={() => setOpenIdx(open ? null : i)}
                className="w-full flex items-center gap-2 px-3 py-2.5 text-left hover:bg-slate-50 transition-colors">
                <School size={14} className="text-slate-400 shrink-0" />
                <span className="text-[13px] text-slate-700 truncate flex-1">{g.name}</span>
                <span className="inline-flex items-center gap-1 text-[11px] text-blue-600 bg-blue-50 border border-blue-100 px-1.5 py-0.5 rounded-full shrink-0"><Paperclip size={10} />{g.files.length}</span>
                {open ? <ChevronUp size={14} className="text-slate-400 shrink-0" /> : <ChevronDown size={14} className="text-slate-300 shrink-0" />}
              </button>
              {open && (
                <div className="px-2 pb-2 space-y-1 bg-slate-50/50 border-t border-slate-100 pt-2">
                  {g.files.map(f => (
                    <button key={f.id} onClick={() => download(f.path, f.name)}
                      className="w-full flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-white border border-slate-100 hover:border-blue-200 hover:bg-blue-50/40 text-left group transition-colors">
                      <FileText size={13} className="text-blue-500 shrink-0" />
                      <span className="text-[12px] text-slate-700 flex-1 group-hover:text-[#0f2240] break-words">{f.name}</span>
                      <Download size={12} className="text-slate-300 group-hover:text-[#0f2240] shrink-0" />
                    </button>
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
