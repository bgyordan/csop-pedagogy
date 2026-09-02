'use client'
import { createClient } from '@/lib/supabase/client'
import { School, FileText, Download } from 'lucide-react'

type Group = { name: string; files: { id: string; name: string; path: string }[] }

export default function SchoolFilesCardClient({ groups }: { groups: Group[] }) {
  const supabase = createClient()
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
      <div className="grid grid-cols-1 gap-3">
        {groups.map((g, i) => (
          <div key={i} className="rounded-xl border border-slate-200 bg-slate-50/50 p-3 transition-all hover:border-slate-300 hover:shadow-[0_2px_8px_rgba(15,34,64,0.08)] hover:-translate-y-0.5">
            <div className="text-xs font-medium text-slate-700 mb-2 truncate">{g.name}</div>
            <div className="space-y-1">
              {g.files.map(f => (
                <button key={f.id} onClick={() => download(f.path, f.name)}
                  className="w-full flex items-center gap-1.5 px-2 py-1 rounded-lg bg-white border border-slate-100 hover:border-blue-200 hover:bg-blue-50/40 text-left group transition-colors">
                  <FileText size={13} className="text-blue-500 shrink-0" />
                  <span className="text-[12px] text-slate-700 truncate flex-1 group-hover:text-[#0f2240]">{f.name}</span>
                  <Download size={12} className="text-slate-300 group-hover:text-[#0f2240] shrink-0" />
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
