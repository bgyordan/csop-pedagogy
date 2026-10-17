'use client'
// Каталогът на РЕМЕЛКА — областите и уменията в реда на изграждане. Координаторите и ръководството
// го приспособяват към наръчниците: преименуват, добавят, подреждат, скриват (без да се губят данните).

import { useEffect, useMemo, useState } from 'react'
import { X, Loader2, Plus, EyeOff, Eye, ArrowUp, ArrowDown, Check } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useToast } from '@/components/ui/Toast'
import { PARTS } from '@/lib/remelka'
import type { Part, Skill } from '@/lib/remelka'

export default function CatalogEditor({ onClose }: { onClose: () => void }) {
  const supabase = createClient()
  const { toast } = useToast()
  const [skills, setSkills] = useState<Skill[] | null>(null)
  const [part, setPart] = useState<Part>('math')
  const [edit, setEdit] = useState<Record<string, { title: string; hint: string; area: string }>>({})
  const [newArea, setNewArea] = useState('')
  const [busy, setBusy] = useState(false)

  async function load() {
    const { data, error } = await supabase.from('remelka_skills').select('*').order('sort')
    if (error) { toast('Пуснете SQL файла 2026-10-17_remelka.sql', 'error'); return }
    setSkills((data || []) as Skill[])
  }
  useEffect(() => { load() }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const areas = useMemo(() => {
    const m = new Map<string, Skill[]>()
    ;(skills || []).filter(s => s.part === part).sort((a, b) => a.sort - b.sort).forEach(s => { (m.get(s.area) || m.set(s.area, []).get(s.area)!).push(s) })
    return Array.from(m.entries())
  }, [skills, part])

  async function patch(s: Skill, p: Partial<Skill>) {
    const { error } = await supabase.from('remelka_skills').update(p).eq('id', s.id)
    if (error) { toast(error.message, 'error'); return false }
    setSkills(x => (x || []).map(i => i.id === s.id ? { ...i, ...p } : i))
    return true
  }
  async function saveEdit(s: Skill) {
    const e = edit[s.id]; if (!e) return
    if (await patch(s, { title: e.title.trim() || s.title, hint: e.hint.trim() || null, area: e.area.trim() || s.area })) {
      setEdit(x => { const n = { ...x }; delete n[s.id]; return n })
    }
  }
  async function move(list: Skill[], i: number, d: -1 | 1) {
    const a = list[i], b = list[i + d]; if (!a || !b) return
    await patch(a, { sort: b.sort }); await patch(b, { sort: a.sort })
  }
  async function add(area: string, list: Skill[]) {
    setBusy(true)
    const prefix = part === 'math' ? 'С' : 'Г'
    // кодът: номерът на областта + следващ номер („С3.6“); за нова област — следващата
    const all = (skills || []).filter(s => s.part === part)
    const areaNo = list.length ? list[0].code.replace(/^\D+/, '').split('.')[0] : String(new Set(all.map(s => s.area)).size + 1)
    let k = list.length + 1, code = `${prefix}${areaNo}.${k}`
    while ((skills || []).some(s => s.code === code)) code = `${prefix}${areaNo}.${++k}`
    const sort = list.length ? Math.max(...list.map(s => s.sort)) + 1 : Math.max(0, ...all.map(s => s.sort)) + 100
    const { data, error } = await supabase.from('remelka_skills').insert({ part, area, code, title: 'Ново умение', sort }).select('*').single()
    setBusy(false)
    if (error || !data) { toast(error?.message || 'Грешка', 'error'); return }
    setSkills(x => [...(x || []), data as Skill])
    setEdit(x => ({ ...x, [data.id]: { title: '', hint: '', area } }))
  }

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm overflow-y-auto" onClick={onClose}>
      <div className="max-w-3xl mx-auto my-0 md:my-8 bg-white md:rounded-3xl shadow-2xl overflow-hidden" onClick={e => e.stopPropagation()}>
        <div className="sticky top-0 z-10 bg-white flex items-center gap-3 px-5 py-4 border-b border-slate-200">
          <div className="flex-1">
            <h2 className="text-base text-[#0f2240]">Каталог на уменията</h2>
            <p className="text-[12px] text-slate-500">Приспособете областите и уменията към наръчниците на РЕМЕЛКА. Скритите остават в историята на децата.</p>
          </div>
          <button type="button" onClick={onClose} className="p-2 rounded-xl text-slate-500 hover:bg-slate-100"><X size={18} /></button>
        </div>
        <div className="px-5 py-4 space-y-3">
          <div className="flex gap-1.5">
            {(Object.keys(PARTS) as Part[]).map(p => (
              <button key={p} type="button" onClick={() => setPart(p)} className="px-3 py-1.5 rounded-xl text-sm border"
                style={part === p ? { background: PARTS[p].bg, color: PARTS[p].color, borderColor: PARTS[p].color } : { borderColor: '#e2e8f0', color: '#64748b' }}>{PARTS[p].label}</button>
            ))}
          </div>
          {skills === null ? <div className="flex justify-center py-8 text-slate-400"><Loader2 className="animate-spin" size={18} /></div> : (
            <>
              {areas.map(([area, list]) => (
                <section key={area} className="rounded-2xl border border-slate-200 overflow-hidden">
                  <div className="px-4 py-2 bg-slate-50 flex items-center gap-2">
                    <span className="text-sm font-medium text-slate-800 flex-1">{area}</span>
                    <button type="button" disabled={busy} onClick={() => add(area, list)} className="inline-flex items-center gap-1 text-[12px] text-indigo-700 hover:underline"><Plus size={13} /> умение</button>
                  </div>
                  <div className="divide-y divide-slate-100">
                    {list.map((s, i) => {
                      const e = edit[s.id]
                      return (
                        <div key={s.id} className={`px-4 py-2 flex items-start gap-2 ${s.archived ? 'opacity-50' : ''}`}>
                          <span className="text-[11px] text-slate-400 w-10 pt-1.5">{s.code}</span>
                          {e ? (
                            <div className="flex-1 space-y-1.5">
                              <input value={e.title} autoFocus onChange={x => setEdit(m => ({ ...m, [s.id]: { ...e, title: x.target.value } }))} placeholder="Умение"
                                className="w-full px-2 py-1 rounded-lg border border-slate-200 text-[13px]" />
                              <input value={e.hint} onChange={x => setEdit(m => ({ ...m, [s.id]: { ...e, hint: x.target.value } }))} placeholder="Какво се проверява / как изглежда „овладяно“"
                                className="w-full px-2 py-1 rounded-lg border border-slate-200 text-[12px]" />
                              <input value={e.area} onChange={x => setEdit(m => ({ ...m, [s.id]: { ...e, area: x.target.value } }))} placeholder="Област"
                                className="w-full px-2 py-1 rounded-lg border border-slate-200 text-[12px]" />
                            </div>
                          ) : (
                            <button type="button" onClick={() => setEdit(m => ({ ...m, [s.id]: { title: s.title, hint: s.hint || '', area: s.area } }))} className="flex-1 text-left">
                              <div className="text-[13.5px] text-slate-800">{s.title}</div>
                              {s.hint && <div className="text-[11.5px] text-slate-500">{s.hint}</div>}
                            </button>
                          )}
                          {e ? (
                            <button type="button" onClick={() => saveEdit(s)} className="p-1.5 rounded-lg text-emerald-600 hover:bg-emerald-50"><Check size={15} /></button>
                          ) : (
                            <>
                              <button type="button" onClick={() => move(list, i, -1)} disabled={i === 0} className="p-1 rounded text-slate-400 hover:text-slate-700 disabled:opacity-30"><ArrowUp size={14} /></button>
                              <button type="button" onClick={() => move(list, i, 1)} disabled={i === list.length - 1} className="p-1 rounded text-slate-400 hover:text-slate-700 disabled:opacity-30"><ArrowDown size={14} /></button>
                              <button type="button" onClick={() => patch(s, { archived: !s.archived })} title={s.archived ? 'Покажи' : 'Скрий'} className="p-1 rounded text-slate-400 hover:text-slate-700">
                                {s.archived ? <Eye size={14} /> : <EyeOff size={14} />}</button>
                            </>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </section>
              ))}
              <div className="flex gap-2">
                <input value={newArea} onChange={e => setNewArea(e.target.value)} placeholder="Нова област…" className="flex-1 px-3 py-2 rounded-xl border border-slate-200 text-sm" />
                <button type="button" disabled={!newArea.trim() || busy} onClick={async () => { await add(newArea.trim(), []); setNewArea('') }}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm text-white disabled:opacity-50" style={{ backgroundColor: '#0f2240' }}><Plus size={14} /> Добави</button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
