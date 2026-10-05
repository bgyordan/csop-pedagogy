// Учебен план от НЕИСПУО — справочен изглед за учител и за паралелка.
// Чете директно curriculum_lines: при нов внос от НЕИСПУО данните се обновяват сами.

export type CurLine = {
  id: string
  holder: string            // паралелка (името в EIS) / група ЦОУД / както е в НЕИСПУО
  classId: string | null
  subject: string
  h1: number; h2: number    // часове седмично по срокове
  w1: number; w2: number    // учебни седмици по срокове
  total: number             // за годината
  teacher: string           // служителят в EIS или името от НЕИСПУО
  staffId: string | null
  individual: boolean       // ИЧ
  norm: number              // 21 или 30 (терапии → 0,7 към норматив 21)
  students: number | null
}

/** Норматив на седмица по длъжност (учители); за останалите — няма над норматива */
export const TEACHER_NORM: Record<string, number> = { class_teacher: 21, teacher: 21 }

export async function loadCurriculum(supabase: any, yearId: string | undefined, by: { staffId?: string; classId?: string }) {
  if (!yearId || (!by.staffId && !by.classId)) return { lines: [] as CurLine[], importedAt: null as string | null }
  let q = supabase.from('curriculum_lines')
    .select('id, holder_label, class_id, subject, hours_t1, hours_t2, weeks_t1, weeks_t2, total_hours, teacher_name, staff_id, individual, subject_norm, students, imported_at, class:classes(name), coud:coud_groups(name), staff:staff_profiles!curriculum_lines_staff_id_fkey(first_name, last_name)')
    .eq('academic_year_id', yearId)
  q = by.staffId ? q.eq('staff_id', by.staffId) : q.eq('class_id', by.classId)
  const { data, error } = await q.range(0, 1999)
  if (error) return { lines: [] as CurLine[], importedAt: null as string | null }
  const n = (v: any) => Number(v || 0)
  const lines: CurLine[] = (data || []).map((l: any) => ({
    id: l.id,
    holder: l.class?.name || l.coud?.name || l.holder_label,
    classId: l.class_id,
    subject: l.subject,
    h1: n(l.hours_t1), h2: n(l.hours_t2), w1: n(l.weeks_t1), w2: n(l.weeks_t2), total: n(l.total_hours),
    teacher: l.staff ? `${l.staff.first_name} ${l.staff.last_name}` : (l.teacher_name || ''),
    staffId: l.staff_id,
    individual: !!l.individual,
    norm: Number(l.subject_norm) || 21,
    students: l.students === null || l.students === undefined ? null : n(l.students),
  }))
  const importedAt = (data || []).reduce((a: string | null, l: any) => (!a || l.imported_at > a ? l.imported_at : a), null)
  return { lines, importedAt }
}

/** Часовете на учителя по паралелки в седмичното разписание на EIS (без ИФО) — за сравнение с плана */
export async function scheduleHoursByClass(supabase: any, yearId: string | undefined, staffId: string) {
  const out: Record<string, { t1: number; t2: number; name?: string }> = {}
  if (!yearId) return out
  const { data: scheds } = await supabase.from('class_schedules').select('id, class_id, term, class:classes(name)').eq('academic_year_id', yearId)
  const info: Record<string, { cls: string; term: number; name: string }> = {}
  ;(scheds || []).forEach((s: any) => { info[s.id] = { cls: s.class_id, term: s.term === 2 ? 2 : 1, name: s.class?.name || '' } })
  const ids = Object.keys(info)
  for (let i = 0; i < ids.length; i += 100) {
    const { data: sl } = await supabase.from('schedule_slots').select('schedule_id, day, period')
      .in('schedule_id', ids.slice(i, i + 100)).eq('staff_id', staffId)
    const seen = new Set<string>()
    ;(sl || []).forEach((r: any) => {
      const s = info[r.schedule_id]; if (!s?.cls) return
      const k = `${r.schedule_id}-${r.day}-${r.period}`; if (seen.has(k)) return; seen.add(k)
      const o = (out[s.cls] ||= { t1: 0, t2: 0, name: s.name })
      if (s.term === 2) o.t2++; else o.t1++
    })
  }
  return out
}

const r1 = (x: number) => Math.round(x * 10) / 10
/** Сбор по плана: часове седмично (без ИЧ), с терапиите по 0,7, и ИЧ */
export function planTotals(lines: CurLine[]) {
  const t = { h1: 0, h2: 0, n1: 0, n2: 0, ich1: 0, ich2: 0, year: 0, therapy1: 0 }
  lines.forEach(l => {
    if (l.individual) { t.ich1 += l.h1; t.ich2 += l.h2; return }
    const k = 21 / l.norm
    t.h1 += l.h1; t.h2 += l.h2; t.n1 += l.h1 * k; t.n2 += l.h2 * k; t.year += l.total
    if (k < 1) t.therapy1 += l.h1
  })
  return Object.fromEntries(Object.entries(t).map(([k, v]) => [k, r1(v)])) as typeof t
}
