'use client'
// Връзка „Оценяване ↔ Професионално портфолио“: при самооценката лицето избира записи от портфолиото
// като доказателства (общо или към критерий); комисията ги вижда в „Доказателства и портфолио“.
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { BookUser, Loader2, Paperclip, ExternalLink, X } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useToast } from '@/components/ui/Toast'
import { items as critItems, type EvalGroup } from '@/lib/evaluation'
import { sectionMeta, inPeriod, dateRange, fmtNum, type PPItem, type PPLink, type PPFile } from '@/lib/pro-portfolio'

async function openFile(f: PPFile, toast: (m: string, t?: any) => void) {
  const { data, error } = await createClient().storage.from('pro-portfolio').createSignedUrl(f.path, 600)
  if (error || !data) { toast(error?.message || 'Файлът не може да се отвори', 'error'); return }
  window.open(data.signedUrl, '_blank')
}

const critLabel = (crit: EvalGroup[], k: string) => {
  if (!k) return 'Общо'
  const it = critItems(crit).find(x => x.k === k)
  return it ? `${k} ${it.t}` : k
}

function LinkedList({ list, crit, toast }: { list: { link: PPLink; item: PPItem }[]; crit: EvalGroup[]; toast: (m: string, t?: any) => void }) {
  const groups = Array.from(new Set(list.map(x => x.link.criterion))).sort((a, b) => (a || '0').localeCompare(b || '0', undefined, { numeric: true }))
  return (
    <div className="space-y-2">
      {groups.map(g => (
        <div key={g || 'general'}>
          <div className="text-[12px] text-slate-500 mb-0.5">{critLabel(crit, g)}</div>
          <ul className="space-y-1">
            {list.filter(x => x.link.criterion === g).map(({ item: i }) => {
              const m = sectionMeta(i.section)
              return (
                <li key={i.id + g} className="text-[13px]">
                  <span className={`text-[11px] px-1.5 py-0.5 rounded border mr-1.5 ${m.tone}`}>{m.label}</span>
                  <span className="text-slate-800">{i.title}</span>
                  <span className="text-slate-400"> · {dateRange(i.date_from, i.date_to)}{i.hours != null ? ` · ${fmtNum(i.hours)} ч.` : ''}</span>
                  {(i.files || []).map(f => <button key={f.id} type="button" onClick={() => openFile(f, toast)} className="ml-2 inline-flex items-center gap-0.5 text-indigo-700 hover:underline"><Paperclip size={11} />{f.name}</button>)}
                  {i.url && <a href={i.url} target="_blank" rel="noreferrer" className="ml-2 inline-flex items-center gap-0.5 text-indigo-700 hover:underline"><ExternalLink size={11} />линк</a>}
                  {i.body && <div className="text-[12.5px] text-slate-600 line-clamp-2">{i.body}</div>}
                </li>
              )
            })}
          </ul>
        </div>
      ))}
    </div>
  )
}

/** Самооценка: избор на записи от портфолиото като доказателства. */
export function PortfolioPicker({ participantId, crit, items, links, editable, from, to }: {
  participantId: string; crit: EvalGroup[]; items: PPItem[]; links: PPLink[]; editable: boolean; from: string | null; to: string | null
}) {
  const router = useRouter()
  const { toast } = useToast()
  const [open, setOpen] = useState(false)
  const [all, setAll] = useState(false)
  const [sel, setSel] = useState<Record<string, string[]>>({})
  const [busy, setBusy] = useState(false)
  const byId = Object.fromEntries(items.map(i => [i.id, i]))
  const linked = links.map(l => ({ link: l, item: byId[l.item_id] })).filter(x => x.item)
  const options = critItems(crit)
  function start() {
    const m: Record<string, string[]> = {}
    for (const l of links) (m[l.item_id] ||= []).push(l.criterion)
    setSel(m); setOpen(true)
  }
  const toggle = (id: string) => setSel(s => { const n = { ...s }; if (n[id]) delete n[id]; else n[id] = ['']; return n })
  const setCrit = (id: string, v: string) => setSel(s => ({ ...s, [id]: [v] }))
  async function save() {
    setBusy(true)
    const supabase = createClient()
    const { error } = await supabase.from('pp_eval_links').delete().eq('participant_id', participantId)
    if (error) { setBusy(false); toast(error.message, 'error'); return }
    const rows = Object.entries(sel).flatMap(([item_id, cs]) => cs.map(criterion => ({ participant_id: participantId, item_id, criterion })))
    if (rows.length) {
      const { error: e2 } = await supabase.from('pp_eval_links').insert(rows)
      if (e2) { setBusy(false); toast(e2.message, 'error'); return }
    }
    setBusy(false); setOpen(false); toast('Доказателствата са записани'); router.refresh()
  }
  const shown = items.filter(i => all || inPeriod(i, from, to))
  return (
    <div className="rounded-xl border border-indigo-100 bg-indigo-50/30 p-3 space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <BookUser size={15} className="text-indigo-700" />
        <span className="text-[13.5px] font-medium text-slate-800 flex-1">От професионалното портфолио · {linked.length}</span>
        <Link href="/pro-portfolio" className="text-[12.5px] text-indigo-700">Отвори портфолиото</Link>
        {editable && <button type="button" onClick={start} className="px-3 py-1.5 rounded-lg text-[13px] border border-indigo-200 bg-white text-indigo-700 hover:bg-indigo-50">Избери доказателства</button>}
      </div>
      {linked.length ? <LinkedList list={linked} crit={crit} toast={toast} /> : <p className="text-[12.5px] text-slate-500">Още не сте избрали записи. {items.length ? 'Изберете от портфолиото си — комисията ще ги вижда до точките.' : 'Първо добавете материали в „Професионално портфолио“.'}</p>}
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true">
          <div className="absolute inset-0 bg-black/40" onClick={() => setOpen(false)} />
          <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col">
            <div className="flex items-center gap-2 px-5 py-3.5 border-b border-slate-100">
              <h2 className="text-base font-semibold text-slate-800 flex-1">Доказателства от портфолиото</h2>
              <button type="button" aria-label="Затвори" onClick={() => setOpen(false)} className="p-1.5 rounded-lg hover:bg-slate-100"><X size={16} className="text-slate-500" /></button>
            </div>
            <div className="px-5 py-3 overflow-y-auto flex-1 space-y-1 text-[13px]">
              <label className="flex items-center gap-2 text-[12.5px] text-slate-600 mb-2"><input type="checkbox" checked={all} onChange={e => setAll(e.target.checked)} /> Покажи и записите извън атестационния период</label>
              {!shown.length && <p className="text-slate-400 py-4 text-center">Няма записи за периода.</p>}
              {shown.map(i => {
                const on = !!sel[i.id]
                return (
                  <div key={i.id} className={`rounded-xl border px-3 py-2 ${on ? 'border-indigo-300 bg-indigo-50/50' : 'border-slate-200'}`}>
                    <label className="flex items-start gap-2 cursor-pointer">
                      <input type="checkbox" checked={on} onChange={() => toggle(i.id)} className="mt-1" />
                      <span className="flex-1"><span className="text-slate-800">{i.title}</span><span className="block text-[12px] text-slate-500">{sectionMeta(i.section).label} · {dateRange(i.date_from, i.date_to)}</span></span>
                    </label>
                    {on && options.length > 0 && (
                      <select value={sel[i.id][0]} onChange={e => setCrit(i.id, e.target.value)} className="input mt-1.5 text-[12.5px] py-1.5">
                        <option value="">Общо доказателство (без критерий)</option>
                        {options.map(o => <option key={o.k} value={o.k}>{o.k} {o.t.length > 90 ? o.t.slice(0, 90) + '…' : o.t}</option>)}
                      </select>
                    )}
                  </div>
                )
              })}
            </div>
            <div className="px-5 py-3 border-t border-slate-100 flex justify-end gap-2">
              <button type="button" onClick={() => setOpen(false)} className="btn-secondary">Отказ</button>
              <button type="button" disabled={busy} onClick={save} className="btn-primary inline-flex items-center gap-1.5">{busy && <Loader2 size={14} className="animate-spin" />} Запази ({Object.keys(sel).length})</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

/** Комисията: доказателствата от портфолиото на атестирания. */
export function PortfolioLinked({ participantId, staffId, crit }: { participantId: string; staffId: string; crit: EvalGroup[] }) {
  const { toast } = useToast()
  const [list, setList] = useState<{ link: PPLink; item: PPItem }[] | null>(null)
  const [err, setErr] = useState('')
  useEffect(() => {
    createClient().from('pp_eval_links').select('participant_id, item_id, criterion, note, item:pp_items(*, files:pp_files(*))').eq('participant_id', participantId)
      .then(({ data, error }) => {
        if (error) { setErr(error.message); return }
        setList(((data || []) as any[]).filter(r => r.item).map(r => ({ link: r as PPLink, item: r.item as PPItem })))
      })
  }, [participantId])
  if (err) return null   // таблиците още ги няма
  return (
    <div>
      <div className="flex items-center gap-2 mb-1.5">
        <div className="text-[12px] uppercase tracking-wide text-slate-400 flex-1">Доказателства от професионалното портфолио{list ? ` (${list.length})` : ''}</div>
        <Link href={`/pro-portfolio?staff=${staffId}`} className="text-[12.5px] text-indigo-700">Цялото портфолио →</Link>
      </div>
      {!list ? <p className="text-slate-400"><Loader2 size={13} className="inline animate-spin mr-1" />Зареждане…</p>
        : list.length ? <LinkedList list={list} crit={crit} toast={toast} />
          : <p className="text-slate-400">Лицето не е посочило записи от портфолиото.</p>}
    </div>
  )
}
