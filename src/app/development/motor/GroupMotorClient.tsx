'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { Activity, Loader2, Save, FileDown, Check, X } from 'lucide-react'
import { DOMAINS, ITEMS, BASIC, MSCALE, CODES, SUPPORT, STAGES, DETAIL, UNIT, itemOf, resultText, isEmptyResult } from '@/lib/motor'
import type { MotorResult } from '@/lib/motor'
import { NumInput } from '@/app/students/[id]/development/MotorEditor'

type Kid = { id: string; name: string }
type Cell = Pick<MotorResult, 'score' | 'code' | 't1' | 't2' | 'l' | 'r' | 'pref' | 'support'>
const EMPTY: Cell = { score: null, code: null, t1: null, t2: null, l: null, r: null, pref: null, support: [] }
const today = () => new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Sofia' })
const chunk = <T,>(a: T[], n = 200) => Array.from({ length: Math.ceil(a.length / n) }, (_, i) => a.slice(i * n, i * n + n))

export default function GroupMotorClient({ classes, meId, meName, yearId, yearName }: {
  classes: { id: string; name: string; kids: Kid[] }[]; meId: string; meName: string; yearId: string | null; yearName: string
}) {
  const supabase = createClient()
  const [classIds, setClassIds] = useState<string[]>([])
  const [off, setOff] = useState<Set<string>>(new Set())        // изключени деца
  const [detail, setDetail] = useState<'basic' | 'advanced'>('basic')
  const [items, setItems] = useState<number[]>(BASIC)
  const [pickItems, setPickItems] = useState(false)
  const [stage, setStage] = useState('entry')
  const [date, setDate] = useState(today())
  const [cells, setCells] = useState<Record<string, Record<number, Cell>>>({})
  const [prev, setPrev] = useState<Record<string, Record<number, MotorResult>>>({})
  const [existing, setExisting] = useState<Record<string, string>>({}) // дете → оценка от същия ден (моя)
  const [loading, setLoading] = useState(false)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)

  const allKids = useMemo(() => classes.filter(c => classIds.includes(c.id)).flatMap(c => c.kids), [classes, classIds])
  const kids = allKids.filter(k => !off.has(k.id))
  const kidKey = kids.map(k => k.id).join(',')

  // Предишни резултати (за подсказка) и вече записана оценка от същия ден → продължава се
  useEffect(() => {
    if (!kids.length) { setPrev({}); setExisting({}); return }
    let stop = false
    ;(async () => {
      setLoading(true)
      const sess: any[] = []
      for (const part of chunk(kids.map(k => k.id))) {
        const { data } = await supabase.from('motor_sessions').select('id, student_id, assessed_on, created_at, assessor_id, stage, detail').in('student_id', part)
        sess.push(...(data || []))
      }
      const res: MotorResult[] = []
      for (const part of chunk(sess.map(s => s.id))) {
        const { data } = await supabase.from('motor_results').select('*').in('session_id', part)
        res.push(...((data || []) as MotorResult[]))
      }
      if (stop) return
      sess.sort((a, b) => a.assessed_on.localeCompare(b.assessed_on) || a.created_at.localeCompare(b.created_at))
      const sOf: Record<string, any> = Object.fromEntries(sess.map(s => [s.id, s]))
      const ex: Record<string, string> = {}
      sess.forEach(s => { if (s.assessed_on === date && s.assessor_id === meId) ex[s.student_id] = s.id })
      const pv: Record<string, Record<number, MotorResult>> = {}
      const own: Record<string, Record<number, Cell>> = {}
      const order: Record<string, number> = Object.fromEntries(sess.map((s, i) => [s.id, i]))
      res.sort((a, b) => order[a.session_id] - order[b.session_id]).forEach(r => {
        const s = sOf[r.session_id]
        if (ex[s.student_id] === s.id) {
          (own[s.student_id] ||= {})[r.item] = { score: r.score, code: r.code, t1: r.t1, t2: r.t2, l: r.l, r: r.r, pref: r.pref, support: r.support || [] }
        } else if (s.assessed_on <= date) (pv[s.student_id] ||= {})[r.item] = r
      })
      setPrev(pv); setExisting(ex)
      setCells(c => {
        const n = { ...c }
        Object.entries(own).forEach(([k, v]) => { n[k] = { ...v, ...(c[k] || {}) } })
        return n
      })
      // ако продължаваме вчерашна групова оценка — вземи пробите ѝ
      const usedItems = Array.from(new Set(Object.values(own).flatMap(v => Object.keys(v).map(Number))))
      if (usedItems.length) setItems(it => Array.from(new Set([...it, ...usedItems])).sort((a, b) => a - b))
      setLoading(false)
    })()
    return () => { stop = true }
  }, [kidKey, date]) // eslint-disable-line react-hooks/exhaustive-deps

  const setCell = (kid: string, no: number, p: Partial<Cell>) => setCells(c => ({ ...c, [kid]: { ...c[kid], [no]: { ...EMPTY, ...c[kid]?.[no], ...p } } }))
  function chooseDetail(d: 'basic' | 'advanced') {
    setDetail(d)
    if (d === 'basic') setItems(BASIC)
  }

  async function save() {
    setMsg(null)
    const todo = kids.filter(k => Object.values(cells[k.id] || {}).some(c => !isEmptyResult(c)) || existing[k.id])
    if (!todo.length) { setMsg({ ok: false, text: 'Няма попълнени клетки.' }); return }
    setBusy(true)
    try {
      for (const k of todo) {
        let sid = existing[k.id]
        if (sid) {
          const { error } = await supabase.from('motor_sessions').update({ stage, detail }).eq('id', sid)
          if (error) throw error
        } else {
          const { data, error } = await supabase.from('motor_sessions').insert({
            student_id: k.id, academic_year_id: yearId, assessed_on: date, stage, detail, assessor_id: meId,
            conditions: { setup: 'Групова оценка' },
          }).select('id').single()
          if (error) throw error
          sid = data!.id as string
        }
        const filled = items.filter(no => !isEmptyResult(cells[k.id]?.[no]))
        const empty = items.filter(no => isEmptyResult(cells[k.id]?.[no]))
        if (filled.length) {
          const { error } = await supabase.from('motor_results').upsert(
            filled.map(no => ({ session_id: sid, item: no, ...EMPTY, ...cells[k.id][no] })), { onConflict: 'session_id,item' })
          if (error) throw error
        }
        if (empty.length && existing[k.id]) await supabase.from('motor_results').delete().eq('session_id', sid).in('item', empty)
        setExisting(e => ({ ...e, [k.id]: sid! }))
      }
      setMsg({ ok: true, text: `Записано за ${todo.length} ${todo.length === 1 ? 'дете' : 'деца'} — вижда се в досието → Развитие → Двигателна оценка.` })
    } catch (e: any) {
      setMsg({ ok: false, text: e?.message?.includes('motor_') ? 'Пуснете SQL файла 2026-10-08_motor.sql.' : (e?.message || 'Грешка при запис.') })
    } finally { setBusy(false) }
  }

  async function exportWord(blank: boolean) {
    const { exportGroupCard } = await import('@/lib/motor-docx')
    const txt: Record<string, Record<number, string>> = {}
    if (!blank) kids.forEach(k => items.forEach(no => {
      const c = cells[k.id]?.[no]; const it = itemOf(no)!
      if (c && !isEmptyResult(c)) (txt[k.id] ||= {})[no] = resultText(it, c)
    }))
    const title = classes.filter(c => classIds.includes(c.id)).map(c => c.name).join(', ') || 'Група'
    await exportGroupCard({ title, date: blank ? '' : date, assessor: blank ? '' : meName, items, kids: blank && !kids.length ? Array.from({ length: 6 }, (_, i) => ({ id: String(i), name: `Дете ${i + 1}` })) : kids, cells: txt })
  }

  const sel = 'px-1 py-1 rounded-md border border-slate-300 text-[12px] bg-white focus:outline-none focus:border-[#0f2240]'
  const num = 'w-12 px-1 py-1 rounded-md border border-slate-300 text-[12px] focus:outline-none focus:border-[#0f2240]'

  return (
    <div className="p-4 md:p-8 max-w-[1400px] mx-auto">
      <div className="mb-5 flex items-center gap-3">
        <div className="p-2.5 rounded-xl" style={{ backgroundColor: '#0f2240' }}><Activity size={20} className="text-white" /></div>
        <div>
          <h1 className="text-xl md:text-2xl font-semibold text-slate-800">Двигателна оценка — групова карта</h1>
          <p className="text-slate-500 text-sm mt-0.5">{yearName} · едни и същи проби и условия за няколко деца; записва се в досието на всяко дете</p>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 space-y-3 mb-4">
        <div>
          <div className="text-[12px] text-slate-500 mb-1.5">Паралелки</div>
          <div className="flex flex-wrap gap-1.5">
            {classes.map(c => {
              const on = classIds.includes(c.id)
              return <button key={c.id} type="button" onClick={() => setClassIds(ids => on ? ids.filter(x => x !== c.id) : [...ids, c.id])}
                className={`px-2.5 py-1 rounded-lg text-[13px] border ${on ? 'bg-[#0f2240] text-white border-[#0f2240]' : 'border-slate-300 text-slate-600 hover:border-slate-500'}`}>{c.name}</button>
            })}
          </div>
        </div>
        {allKids.length > 0 && (
          <div>
            <div className="text-[12px] text-slate-500 mb-1.5">Деца (кликни, за да изключиш)</div>
            <div className="flex flex-wrap gap-1.5">
              {allKids.map(k => {
                const on = !off.has(k.id)
                return <button key={k.id} type="button" onClick={() => setOff(s => { const n = new Set(s); if (n.has(k.id)) n.delete(k.id); else n.add(k.id); return n })}
                  className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[12.5px] border ${on ? 'border-emerald-300 bg-emerald-50 text-emerald-800' : 'border-slate-200 text-slate-400 line-through'}`}>
                  {on ? <Check size={12} /> : <X size={12} />}{k.name}</button>
              })}
            </div>
          </div>
        )}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex rounded-xl bg-slate-100 p-0.5 text-[13px]">
            {(['basic', 'advanced'] as const).map(k => (
              <button key={k} type="button" onClick={() => chooseDetail(k)} className={`px-3 py-1.5 rounded-lg ${detail === k ? 'bg-white shadow-sm text-slate-900 font-medium' : 'text-slate-500'}`}>{DETAIL[k]}</button>
            ))}
          </div>
          <div className="flex rounded-xl bg-slate-100 p-0.5 text-[13px]">
            {Object.entries(STAGES).filter(([k]) => k !== 'current').map(([k, l]) => (
              <button key={k} type="button" onClick={() => setStage(k)} className={`px-3 py-1.5 rounded-lg ${stage === k ? 'bg-white shadow-sm text-slate-900 font-medium' : 'text-slate-500'}`}>{l}</button>
            ))}
          </div>
          <input type="date" value={date} onChange={e => setDate(e.target.value)} className="px-3 py-1.5 rounded-xl border border-slate-300 text-[13px]" />
          <button type="button" onClick={() => setPickItems(v => !v)} className="px-3 py-1.5 rounded-xl border border-slate-300 text-[13px] hover:border-[#0f2240]">Проби: {items.length} {pickItems ? '▴' : '▾'}</button>
          <div className="ml-auto flex gap-2">
            <button type="button" onClick={() => exportWord(true)} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-300 text-[13px] hover:border-[#0f2240]" title="За попълване на ръка в залата"><FileDown size={14} /> Празна карта</button>
            {kids.length > 0 && <button type="button" onClick={() => exportWord(false)} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-300 text-[13px] hover:border-[#0f2240]"><FileDown size={14} /> Word</button>}
            {kids.length > 0 && <button type="button" onClick={save} disabled={busy} className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-xl text-[13px] font-medium bg-[#0f2240] text-white hover:bg-[#1a3560] disabled:opacity-60">
              {busy ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} Запиши</button>}
          </div>
        </div>
        {pickItems && (
          <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-3 pt-2 border-t border-slate-100">
            {DOMAINS.map(d => (
              <div key={d.key}>
                <div className="text-[12px] font-semibold mb-1" style={{ color: d.color }}>{d.label}</div>
                {ITEMS.filter(i => i.domain === d.key).map(i => (
                  <label key={i.no} className="flex items-center gap-1.5 text-[12.5px] text-slate-700">
                    <input type="checkbox" checked={items.includes(i.no)} onChange={() => setItems(it => it.includes(i.no) ? it.filter(x => x !== i.no) : [...it, i.no].sort((a, b) => a - b))} />
                    {i.no}. {i.name}{i.basic && <span className="text-[10.5px] text-slate-400">основна</span>}
                  </label>
                ))}
              </div>
            ))}
          </div>
        )}
        {msg && <div className={`px-3 py-2 rounded-xl text-[13px] ${msg.ok ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'bg-rose-50 text-rose-800 border border-rose-200'}`}>{msg.text}</div>}
        <p className="text-[11.5px] text-slate-500">
          {MSCALE.map(s => `${s.v} – ${s.label}`).join('; ')}. Кодове (не са 0): {Object.entries(CODES).map(([k, l]) => `${k} – ${l}`).join(', ')}. Подкрепа: {SUPPORT.map(s => `${s.k} – ${s.label}`).join(', ')}.
          {' '}Сивото под клетката е предишният резултат. Подробностите (качество на движението, бележки, профил) — от досието на детето.
        </p>
      </div>

      {kids.length === 0 ? (
        <div className="bg-white rounded-2xl border border-dashed border-slate-300 p-10 text-center text-slate-400 text-sm">Изберете паралелка.</div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-auto max-h-[75vh] relative">
          {loading && <div className="absolute right-3 top-3 text-slate-400"><Loader2 size={16} className="animate-spin" /></div>}
          <table className="text-[12.5px] border-separate border-spacing-0">
            <thead>
              <tr>
                <th className="sticky top-0 left-0 z-20 bg-white border-b border-r border-slate-200 text-left px-3 py-2 font-medium text-slate-500 min-w-[220px]">Проба</th>
                {kids.map(k => (
                  <th key={k.id} className="sticky top-0 z-10 bg-white border-b border-slate-200 text-left px-2 py-2 font-medium text-slate-700 min-w-[170px]">
                    <Link href={`/students/${k.id}?tab=dev`} className="hover:underline">{k.name}</Link>
                    {existing[k.id] && <div className="text-[10.5px] font-normal text-emerald-700">записана {date.split('-').reverse().join('.')}</div>}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {DOMAINS.map(d => {
                const its = items.filter(no => itemOf(no)?.domain === d.key)
                if (!its.length) return null
                return [
                  <tr key={d.key}><td colSpan={kids.length + 1} className="sticky left-0 bg-slate-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-wider border-b border-slate-200" style={{ color: d.color }}>{d.label}</td></tr>,
                  ...its.map(no => {
                    const it = itemOf(no)!
                    const u = UNIT[it.measure]
                    return (
                      <tr key={no}>
                        <td className="sticky left-0 z-[5] bg-white border-b border-r border-slate-100 px-3 py-1.5 text-slate-800 align-top" title={`${it.how} Записва се: ${it.record}`}>
                          <span className="text-slate-400 mr-1">{no}.</span>{it.name}
                          {it.measure !== 'none' && it.measure !== 'pref' && <div className="text-[10.5px] text-slate-400">{it.sides ? 'Л / Д ' : ''}{it.measure === 'hits' && it.of ? `успехи от ${it.of}` : u}</div>}
                        </td>
                        {kids.map(k => {
                          const c = cells[k.id]?.[no] || EMPTY
                          const pv = prev[k.id]?.[no]
                          const scoreVal = c.code ? c.code : c.score !== null && c.score !== undefined ? String(c.score) : ''
                          return (
                            <td key={k.id} className="border-b border-slate-100 px-2 py-1.5 align-top">
                              <div className="flex flex-wrap items-center gap-1">
                                <select value={scoreVal} className={sel} title="Оценка 0–4 или код"
                                  onChange={e => { const v = e.target.value; setCell(k.id, no, v === '' ? { score: null, code: null } : CODES[v] ? { code: v, score: null } : { score: Number(v), code: null }) }}>
                                  <option value="">—</option>
                                  {MSCALE.map(s => <option key={s.v} value={s.v}>{s.v}</option>)}
                                  {Object.keys(CODES).map(k2 => <option key={k2} value={k2}>{k2}</option>)}
                                </select>
                                {it.measure === 'pref' ? (
                                  <input value={c.pref || ''} onChange={e => setCell(k.id, no, { pref: e.target.value || null })} className={num + ' w-16'} placeholder="Д/Л" />
                                ) : it.sides ? (<>
                                  <NumInput value={c.l} onChange={x => setCell(k.id, no, { l: x })} className={num} placeholder="Л" />
                                  <NumInput value={c.r} onChange={x => setCell(k.id, no, { r: x })} className={num} placeholder="Д" />
                                </>) : it.measure !== 'none' ? (<>
                                  <NumInput value={c.t1} onChange={x => setCell(k.id, no, { t1: x })} className={num} placeholder={detail === 'advanced' && it.trials ? 'оп.1' : u || 'бр'} />
                                  {detail === 'advanced' && it.trials && <NumInput value={c.t2} onChange={x => setCell(k.id, no, { t2: x })} className={num} placeholder="оп.2" />}
                                </>) : null}
                                <select value={c.support[0] || ''} className={sel} title="Подкрепа за инструкцията"
                                  onChange={e => setCell(k.id, no, { support: e.target.value ? [e.target.value] : [] })}>
                                  <option value="">подкр.</option>
                                  {SUPPORT.map(s => <option key={s.k} value={s.k}>{s.k}</option>)}
                                </select>
                              </div>
                              {pv && <div className="mt-0.5 text-[10.5px] text-slate-400 truncate max-w-[200px]" title="Предишен резултат">преди: {resultText(it, pv)}</div>}
                            </td>
                          )
                        })}
                      </tr>
                    )
                  }),
                ]
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
