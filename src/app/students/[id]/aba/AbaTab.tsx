'use client'

// Таб „АБА“ в досието: ABC картон (поведение) и DTT (дискретни опити — умения).
// Въвеждането е за минута; анализът и графиките се правят сами.
// Вижда се и се пише само от колегите, които работят с детето (+ координатори и ръководство).

import { useCallback, useEffect, useState } from 'react'
import { Loader2, Lock, Activity, Target as TargetIcon } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import type { AbcRecord, Target, DttSession } from '@/lib/aba'
import AbcSection from './AbcSection'
import DttSection from './DttSection'

const SQL_MSG = 'АБА още не е подготвена в базата — пуснете SQL файла 2026-10-18_aba.sql.'

export default function AbaTab({ studentId, firstName, meId, isManager }: { studentId: string; firstName: string; meId: string; isManager: boolean }) {
  const supabase = createClient()
  const [err, setErr] = useState('')
  const [access, setAccess] = useState<boolean | null>(null)
  const [view, setView] = useState<'abc' | 'dtt'>('abc')
  const [records, setRecords] = useState<AbcRecord[] | null>(null)
  const [targets, setTargets] = useState<Target[]>([])
  const [sessions, setSessions] = useState<DttSession[]>([])
  const [names, setNames] = useState<Record<string, string>>({})

  const load = useCallback(async () => {
    const { data: ok, error: e0 } = await supabase.rpc('works_with_student', { p_student: studentId })
    if (e0) { setErr(SQL_MSG); return }
    setAccess(!!ok)
    if (!ok) return
    const [ar, tg, ss] = await Promise.all([
      supabase.from('abc_records').select('*').eq('student_id', studentId).order('occurred_on', { ascending: false }).order('occurred_time', { ascending: false }).limit(1000),
      supabase.from('dtt_targets').select('*').eq('student_id', studentId).order('added_on'),
      supabase.from('dtt_sessions').select('*').eq('student_id', studentId).order('held_on').limit(5000),
    ])
    if (ar.error || tg.error || ss.error) { setErr(SQL_MSG); return }
    setRecords((ar.data || []) as AbcRecord[])
    setTargets((tg.data || []) as Target[])
    setSessions((ss.data || []) as DttSession[])
    const ids = Array.from(new Set([...(ar.data || []).map((r: any) => r.staff_id), ...(ss.data || []).map((s: any) => s.staff_id)].filter(Boolean))) as string[]
    if (ids.length) {
      const { data: st } = await supabase.from('staff_profiles').select('id, first_name, last_name').in('id', ids)
      setNames(Object.fromEntries((st || []).map((s: any) => [s.id, `${s.first_name} ${s.last_name}`])))
    }
  }, [studentId]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { load() }, [load])

  if (err) return <div className="bg-amber-50 border border-amber-200 text-amber-800 text-sm rounded-2xl px-4 py-3">{err}</div>
  if (access === false) return (
    <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center text-sm text-slate-500">
      <Lock size={24} className="mx-auto mb-2 text-slate-300" />
      АБА записите на детето виждат колегите, които работят с него — класен, учители, учител ЦОУД, терапевти и ЕПЛР екипът.
    </div>
  )
  if (access === null || records === null) return <div className="flex justify-center py-10 text-slate-400"><Loader2 className="animate-spin" size={20} /></div>

  const activeTargets = targets.filter(t => t.status === 'active').length
  const opt = (k: 'abc' | 'dtt', Icon: any, label: string, n: number) => (
    <button type="button" onClick={() => setView(k)}
      className={`relative z-10 flex-1 inline-flex items-center justify-center gap-1.5 px-4 py-1.5 rounded-lg text-sm transition-colors ${view === k ? 'text-[#0f2240]' : 'text-slate-500 hover:text-slate-700'}`}>
      <Icon size={15} /> {label} <span className="text-[11px] text-slate-400 tabular-nums">{n}</span>
    </button>
  )

  return (
    <div className="space-y-4">
      {/* превключвател: Поведение (ABC) | Умения (DTT) */}
      <div className="relative flex p-1 bg-slate-100 rounded-xl w-full max-w-md">
        <span className={`absolute top-1 bottom-1 left-1 w-[calc(50%-4px)] rounded-lg bg-white shadow-sm ring-1 ring-slate-200 transition-transform duration-200 ${view === 'dtt' ? 'translate-x-full' : ''}`} />
        {opt('abc', Activity, 'Поведение (ABC)', records.length)}
        {opt('dtt', TargetIcon, 'Умения (DTT)', activeTargets)}
      </div>

      {view === 'abc'
        ? <AbcSection studentId={studentId} firstName={firstName} meId={meId} isManager={isManager} records={records} names={names} reload={load} />
        : <DttSection studentId={studentId} firstName={firstName} meId={meId} isManager={isManager} targets={targets} sessions={sessions} names={names} reload={load} />}
    </div>
  )
}
