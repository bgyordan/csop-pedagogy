'use client'

// Таб „Развитие“ в досието: зарежда оценките, уменията и целите и записва промените.

import { useCallback, useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Loader2 } from 'lucide-react'
import DevelopmentView from './DevelopmentView'
import AssessmentEditor from './AssessmentEditor'
import type { AssessmentInput } from './AssessmentEditor'
import ProfileCard from './ProfileCard'
import { sortAssessments } from './lib'
import type { Skill, Assessment, Score, Target, AreaKey, Gas, Profile } from './lib'

const MANAGERS = ['admin', 'zdud', 'director']
// Оценяват психолозите и логопедите (и координиращият екип, и управата); останалите само разглеждат
const ASSESSORS = ['psychologist', 'speech_therapist', ...MANAGERS]

export default function DevelopmentTab({ studentId, studentName, className, academicYearId, meId, role, isCoordinator = false }: {
  studentId: string; studentName: string; className: string; academicYearId: string | null; meId: string; role: string; isCoordinator?: boolean
}) {
  const supabase = createClient()
  const [data, setData] = useState<{ skills: Skill[]; assessments: Assessment[]; scores: Score[]; targets: Target[]; gas: Gas[]; profile: Profile | null; years: Record<string, string>; names: Record<string, string> } | null>(null)
  const [err, setErr] = useState('')
  const [editor, setEditor] = useState<{ a: Assessment | null } | null>(null)
  const [exporting, setExporting] = useState(false)
  const isManager = MANAGERS.includes(role)
  const canAssess = ASSESSORS.includes(role) || isCoordinator

  const load = useCallback(async () => {
    const [sk, as, tg, pr, yr] = await Promise.all([
      supabase.from('dev_skills').select('id, area, label, sort, active, level').order('level').order('sort'),
      supabase.from('dev_assessments').select('id, student_id, academic_year_id, assessed_on, kind, assessor_id, notes, created_at').eq('student_id', studentId),
      supabase.from('dev_targets').select('id, skill_id, set_at, achieved_at, expected').eq('student_id', studentId).order('set_at'),
      supabase.from('dev_profiles').select('*').eq('student_id', studentId).maybeSingle(),
      supabase.from('academic_years').select('id, name'),
    ])
    if (sk.error) { setErr('Модулът още не е подготвен в базата — пуснете SQL файловете 2026-10-03_development.sql и 2026-10-03_development_2.sql.'); return }
    const assessments = sortAssessments((as.data || []) as Assessment[])
    const ids = assessments.map(a => a.id)
    const { data: sc } = ids.length ? await supabase.from('dev_scores').select('assessment_id, skill_id, score, note').in('assessment_id', ids) : { data: [] as Score[] }
    const tids = (tg.data || []).map((t: any) => t.id)
    const { data: gs } = tids.length ? await supabase.from('dev_gas').select('target_id, assessment_id, gas').in('target_id', tids) : { data: [] as Gas[] }
    const years: Record<string, string> = {}
    ;(yr.data || []).forEach((y: any) => { years[y.id] = y.name })
    const staffIds = Array.from(new Set(assessments.map(a => a.assessor_id).filter(Boolean))) as string[]
    const { data: st } = staffIds.length ? await supabase.from('staff_profiles').select('id, first_name, last_name').in('id', staffIds) : { data: [] as any[] }
    const names: Record<string, string> = {}
    ;(st || []).forEach((s: any) => { names[s.id] = `${s.first_name} ${s.last_name}` })
    setData({ skills: (sk.data || []) as Skill[], assessments, scores: (sc || []) as Score[], targets: (tg.data || []) as Target[],
      gas: (gs || []) as Gas[], profile: (pr.data as Profile) || null, years, names })
  }, [studentId]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { load() }, [load])

  const canEditAssessment = (a: Assessment) => a.assessor_id === meId || isManager

  async function save(a: Assessment | null, v: AssessmentInput) {
    let id = a?.id
    const notes = Object.fromEntries(Object.entries(v.notes).filter(([, x]) => x.trim()))
    if (!id) {
      const { data: row, error } = await supabase.from('dev_assessments').insert({
        student_id: studentId, academic_year_id: academicYearId, assessed_on: v.assessed_on, kind: v.kind, assessor_id: meId, notes,
      }).select('id').single()
      if (error) throw error
      id = row!.id as string
    } else {
      const { error } = await supabase.from('dev_assessments').update({ assessed_on: v.assessed_on, kind: v.kind, notes }).eq('id', id)
      if (error) throw error
      const { error: e2 } = await supabase.from('dev_scores').delete().eq('assessment_id', id)
      if (e2) throw e2
    }
    const rows = Object.entries(v.scores).map(([skill_id, s]) => ({ assessment_id: id, skill_id, score: s.score, note: s.note.trim() || null }))
    if (rows.length) { const { error } = await supabase.from('dev_scores').insert(rows); if (error) throw error }
    setEditor(null)
    await load()
  }

  async function remove(a: Assessment) {
    await supabase.from('dev_assessments').delete().eq('id', a.id)
    setEditor(null)
    await load()
  }

  async function addSkill(area: AreaKey, label: string): Promise<Skill | null> {
    const sort = Math.max(0, ...(data?.skills || []).filter(s => s.area === area).map(s => s.sort)) + 1
    const { data: row, error } = await supabase.from('dev_skills').insert({ area, label, sort, created_by: meId }).select('id, area, label, sort, active, level').single()
    if (error) { alert(error.message); return null }
    setData(d => d ? { ...d, skills: [...d.skills, row as Skill] } : d)
    return row as Skill
  }

  async function toggleTarget(skillId: string) {
    const t = data?.targets.find(x => x.skill_id === skillId)
    if (t) await supabase.from('dev_targets').delete().eq('id', t.id)
    else await supabase.from('dev_targets').insert({ student_id: studentId, skill_id: skillId, set_by: meId })
    await load()
  }

  async function saveProfile(p: Profile) {
    const { error } = await supabase.from('dev_profiles').upsert({
      student_id: studentId, groups: p.groups, gmfcs: p.gmfcs, macs: p.macs, cfcs: p.cfcs, asd_level: p.asd_level, icf: p.icf,
      note: p.note?.trim() || null, updated_by: meId, updated_at: new Date().toISOString(),
    })
    if (error) { alert(error.message); return }
    await load()
  }

  async function saveExpected(targetId: string, text: string) {
    await supabase.from('dev_targets').update({ expected: text.trim() || null }).eq('id', targetId)
    await load()
  }

  async function rateGas(targetId: string, assessmentId: string, v: number | null) {
    if (v === null) await supabase.from('dev_gas').delete().eq('target_id', targetId).eq('assessment_id', assessmentId)
    else await supabase.from('dev_gas').upsert({ target_id: targetId, assessment_id: assessmentId, gas: v, rated_by: meId })
    await load()
  }

  async function exportWord(fromIdx: number, toIdx: number) {
    if (!data) return
    setExporting(true)
    try {
      const { exportDevelopment } = await import('./exportDevDocx')
      await exportDevelopment({ studentName, className, skills: data.skills, assessments: data.assessments, scores: data.scores, targets: data.targets, gas: data.gas, profile: data.profile, staffNames: data.names, fromIdx, toIdx })
    } finally { setExporting(false) }
  }

  if (err) return <div className="rounded-2xl border border-amber-300 bg-amber-50 p-5 text-sm text-amber-900">{err}</div>
  if (!data) return <div className="flex items-center gap-2 py-12 justify-center text-sm text-slate-500"><Loader2 size={16} className="animate-spin" /> Зареждане…</div>

  return (
    <div className="space-y-4">
      <ProfileCard profile={data.profile} studentId={studentId} canEdit={canAssess} onSave={saveProfile} />
      <DevelopmentView skills={data.skills} assessments={data.assessments} scores={data.scores} targets={data.targets} gas={data.gas} years={data.years} staffNames={data.names}
        onExpected={saveExpected} onRate={rateGas}
        canAssess={canAssess} canEditAssessment={canEditAssessment}
        onNew={() => setEditor({ a: null })} onOpen={a => setEditor({ a })} onToggleTarget={toggleTarget}
        onExport={exportWord} exporting={exporting} />
      {editor && (
        <AssessmentEditor skills={data.skills} assessments={data.assessments} scores={data.scores} assessment={editor.a} role={role}
          profile={data.profile} academicYearId={academicYearId}
          readOnly={!!editor.a && !canEditAssessment(editor.a)} assessorName={editor.a ? data.names[editor.a.assessor_id || ''] : undefined}
          onClose={() => setEditor(null)} onSave={v => save(editor.a, v)}
          onDelete={editor.a && canEditAssessment(editor.a) ? () => remove(editor.a!) : undefined}
          onAddSkill={addSkill} />
      )}
    </div>
  )
}
