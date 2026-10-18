'use client'
import { useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { FileText, ChevronDown, ChevronRight } from 'lucide-react'
import { useReportNewFiles, isFreshFile } from './ClassTeacherSide'

type FileRow = { id: string; name: string; path: string; created_at: string }
type Group = { name: string; kids: string[]; files: FileRow[] }

// Началото на учебната година (15 септември) — по-старите файлове са зад „по-стари“
function yearStart() {
  const d = new Date(), y = d.getMonth() >= 8 ? d.getFullYear() : d.getFullYear() - 1
  return `${y}-09-15`
}

// Учебните планове от изпращащите училища на децата: един тънък ред на училище, клик — файловете
export default function SchoolFilesCardClient({ groups, bare = false }: { groups: Group[]; bare?: boolean }) {
  const supabase = createClient()
  const [openIdx, setOpenIdx] = useState<number | null>(null)
  const [showOld, setShowOld] = useState<Record<number, boolean>>({})
  const from = yearStart()
  const freshCount = useMemo(() => groups.reduce((s, g) => s + g.files.filter(f => isFreshFile(f.created_at)).length, 0), [groups])
  useReportNewFiles('school-plans', freshCount)

  // Отваряне в нов таб с временна връзка (5 мин.): работи на всеки браузър, вкл. телефон/Safari,
  // където тегленето „на заден план“ (blob) тихо се блокира. PDF и снимки се показват, останалото се тегли.
  async function download(path: string, name: string) {
    const tab = window.open('', '_blank')   // отваря се веднага при щракването — иначе браузърът го спира
    const view = /\.(pdf|png|jpe?g|gif|webp)$/i.test(name)
    const { data, error } = await supabase.storage.from('school-files')
      .createSignedUrl(path, 300, view ? undefined : { download: name })
    if (error || !data?.signedUrl) {
      tab?.close()
      alert('Файлът не се отвори: ' + (error?.message || 'няма връзка с хранилището') + '\nОпитайте пак или кажете на администратора.')
      return
    }
    if (tab) tab.location.href = data.signedUrl
    else window.location.href = data.signedUrl   // блокиран нов таб — отваря в същия
  }

  return (
    <div className={bare ? '' : 'bg-white rounded-2xl border border-slate-200/70 p-4 shadow-sm'}>
      <div className="flex items-center gap-2 px-1 mb-1">
        <h3 className="text-[11px] text-slate-400 uppercase tracking-widest flex-1">Учебни планове от училищата</h3>
      </div>
      <div>
        {groups.map((g, i) => {
          const open = openIdx === i
          const cur = g.files.filter(f => f.created_at >= from)
          const old = g.files.filter(f => f.created_at < from)
          const fresh = g.files.filter(f => isFreshFile(f.created_at)).length
          const list = showOld[i] ? g.files : cur
          return (
            <div key={i}>
              <button type="button" onClick={() => setOpenIdx(open ? null : i)}
                className="w-full flex items-center gap-2 px-1 py-1.5 rounded-lg text-left hover:bg-slate-50 transition-colors">
                {open ? <ChevronDown size={14} className="text-slate-400 shrink-0" /> : <ChevronRight size={14} className="text-slate-300 shrink-0" />}
                <span className="flex-1 min-w-0">
                  <span className="block text-[13px] text-slate-700 truncate">{g.name}</span>
                  {g.kids.length > 0 && <span className="block text-[11px] text-slate-400 truncate">{g.kids.join(', ')}</span>}
                </span>
                {fresh > 0 && <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 shrink-0">ново</span>}
                <span className="text-[11px] text-slate-400 tabular-nums shrink-0">{cur.length || (old.length ? `0 · ${old.length} стари` : 0)}</span>
              </button>
              {open && (
                <div className="ml-5 mb-1 border-l border-slate-100 pl-2">
                  {list.length === 0 && <p className="px-1 py-1 text-[12px] text-slate-400">Няма файлове от тази учебна година.</p>}
                  {list.map(f => (
                    <button key={f.id} type="button" onClick={() => download(f.path, f.name)} title="Отвори"
                      className="w-full flex items-center gap-1.5 px-1.5 py-1 rounded-md text-left hover:bg-slate-50 group">
                      <FileText size={13} className="text-sky-500 shrink-0" />
                      <span className={`text-[12.5px] flex-1 min-w-0 truncate group-hover:text-[#0f2240] ${f.created_at < from ? 'text-slate-400' : 'text-slate-700'}`}>{f.name}</span>
                      {isFreshFile(f.created_at) && <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 shrink-0">ново</span>}
                    </button>
                  ))}
                  {old.length > 0 && (
                    <button type="button" onClick={() => setShowOld(s => ({ ...s, [i]: !s[i] }))}
                      className="px-1.5 py-1 text-[11px] text-slate-400 hover:text-slate-700">
                      {showOld[i] ? 'Само тази година' : `По-стари (${old.length})`}
                    </button>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
