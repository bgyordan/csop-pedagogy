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
  mode: string              // „Начин на изучаване“ от НЕИСПУО, както е
  kind: StudyKind           // вид на часа, изведен от него
}

export type StudyKind = 'ЗП' | 'ИУЧ' | 'ДПЛР' | 'ЦОУД' | 'ОФПВ' | ''
/**
 * Вид на часа по „Начин на изучаване“ (НЕИСПУО):
 * ООП → ЗП (раздел А) · РП/УП-А → ИУЧ (раздел Б) · ДПЛР/… → ДПЛР · ДЦО → ЦОУД · ОФПВ.
 * „(ИЧ)“ в края не променя вида — ИЧ се пази отделно.
 * Без колона (стар внос) — ИУЧ се познава и по името на предмета („МАТ/МАТ-ИУЧ“).
 */
export function studyKind(mode: string | null | undefined, subject = ''): StudyKind {
  const m = String(mode || '').replace(/\(\s*ИЧ\s*\)/gi, '').trim().toUpperCase()
  if (/ДПЛР/.test(m)) return 'ДПЛР'
  if (/ДЦО/.test(m)) return 'ЦОУД'
  if (/РП\s*\/?\s*УП|РПУПА|ИУЧ|УИЧ/.test(m)) return 'ИУЧ'
  if (/ОФПВ/.test(m)) return 'ОФПВ'
  if (/ООП/.test(m)) return 'ЗП'
  if (!m && /ИУЧ|УИЧ/i.test(subject)) return 'ИУЧ'   // напр. „БЕЛ/БЕЛ-УИЧ“ (печатна грешка в НЕИСПУО)
  return ''
}

/** Норматив на седмица по длъжност (учители); за останалите — няма над норматива */
export const TEACHER_NORM: Record<string, number> = { class_teacher: 21, teacher: 21 }

/** by.all — целият план за годината (за справки) */
export async function loadCurriculum(supabase: any, yearId: string | undefined, by: { staffId?: string; classId?: string; all?: boolean }) {
  if (!yearId || (!by.staffId && !by.classId && !by.all)) return { lines: [] as CurLine[], importedAt: null as string | null }
  const cols = (withMode: boolean) => `id, holder_label, class_id, subject, hours_t1, hours_t2, weeks_t1, weeks_t2, total_hours, teacher_name, staff_id, individual, subject_norm, students, imported_at,${withMode ? ' study_mode,' : ''} class:classes(name), coud:coud_groups(name), staff:staff_profiles!curriculum_lines_staff_id_fkey(first_name, last_name)`
  const run = (withMode: boolean) => {
    const q = supabase.from('curriculum_lines').select(cols(withMode)).eq('academic_year_id', yearId)
    return (by.all ? q : by.staffId ? q.eq('staff_id', by.staffId) : q.eq('class_id', by.classId)).range(0, 4999)
  }
  // study_mode идва с миграцията 2026-10-05; без нея — четем без колоната
  let { data, error } = await run(true)
  if (error && /study_mode/.test(error.message || '')) ({ data, error } = await run(false))
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
    mode: l.study_mode || '',
    kind: studyKind(l.study_mode, l.subject),
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

/** Справка „Лекторски по учебен план“: админ, директор, ЗДУД и деловодството (технически секретар), без ЗАС */
export const canSeeLecturerReport = (p: { role?: string | null; position?: string | null } | null | undefined) =>
  ['admin', 'zdud', 'director'].includes(p?.role || '') ||
  (p?.role === 'secretary' && /секретар|деловод/i.test(p?.position || '') && !/ЗАС|завеждащ/i.test(p?.position || ''))

/**
 * Над норматива с ИЧ (годишно правило, еднакво за двата срока):
 *  • ИЧ допълват норматива автоматично — ако часовете по плана (без ИЧ, терапиите по 0,7) са под нормата,
 *    ИЧ запълват разликата до нея;
 *  • останалите ИЧ са по отделна заповед; от тях за лекторски се брои само числото от заповедта (ichLect).
 */
export function overWithIch(n: number, ichN: number, norm: number, ichLect = 0) {
  const r = (x: number) => Math.round(x * 10) / 10
  const fill = Math.min(Math.max(0, ichN), Math.max(0, norm - n))
  const rest = Math.max(0, ichN - fill)
  const lect = Math.min(Math.max(0, ichLect || 0), rest)
  return { fill: r(fill), rest: r(rest), lect: r(lect), over: r(Math.max(0, n + fill - norm) + lect) }
}

/**
 * Норма на седмица по длъжност — за списъка с лекторските на всички от учебния план.
 * Учител / логопед / рехабилитатор — 21; психолог, възпитател — 30.
 * Длъжности без преподавателска норма (админ, директор, ЗДУД, ЗДАСД…) — 0: всичките им часове са лекторски.
 */
export const STAFF_NORM: Record<string, number> = {
  class_teacher: 21, teacher: 21, speech_therapist: 21, rehabilitator: 21, psychologist: 30, educator: 30,
}

/**
 * Лекторски на седмица по две правила (Наредба № 4/2017):
 *  • simple — всички часове се приравняват към нормата на лицето (терапии по 0,7 при норма 21) и се вади нормата;
 *  • mixed  — приравняват се само часовете, които ДОПЪЛВАТ нормата (чл. 8): първо часовете със същата норма
 *             като на лицето (по 1), после другите по коефициента; часовете над нормата се броят по 1 (чл. 10, ал. 2; чл. 20).
 * ИЧ само допълват нормата (последни); над нея се броят само тези по заповед (ichLect).
 */
export function overBoth(lines: { h: number; norm: number; individual: boolean }[], personNorm: number, ichLect = 0) {
  const r = (x: number) => Math.round(x * 100) / 100
  const base = personNorm || 21                                   // мярка за приравняване при норма 0
  const k = (n: number) => base / (n || 21)
  const main = lines.filter(l => !l.individual && l.h > 0), ich = lines.filter(l => l.individual && l.h > 0)
  const ichN = ich.reduce((a, l) => a + l.h * k(l.norm), 0)
  // simple
  const n = main.reduce((a, l) => a + l.h * k(l.norm), 0)
  const fillS = Math.min(ichN, Math.max(0, personNorm - n))
  const lectS = Math.min(Math.max(0, ichLect), Math.max(0, ichN - fillS))
  const simple = Math.max(0, n + fillS - personNorm) + lectS
  // mixed
  let deficit = personNorm, over = 0
  const native = main.filter(l => k(l.norm) === 1), other = main.filter(l => k(l.norm) !== 1)
  for (const l of [...native, ...other]) {
    const kk = k(l.norm)
    const used = Math.min(l.h, deficit / kk)       // реални часове, нужни за допълване
    deficit -= used * kk
    over += l.h - used                              // остатъкът — по 1
  }
  const fillM = Math.min(ichN, Math.max(0, deficit))
  const lectM = Math.min(Math.max(0, ichLect), Math.max(0, ichN - fillM))
  return { simple: r(simple), mixed: r(over + lectM) }
}
