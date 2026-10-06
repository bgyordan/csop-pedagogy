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
    // ЦОУД (ДЦО — целодневна организация) е с норма 30, както терапиите; във вноса стои 21
    norm: (l.coud || /ДЦО/i.test(l.study_mode || '') || /цоуд/i.test(l.holder_label || '')) ? 30 : (Number(l.subject_norm) || 21),
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
/** Годишна норма (часове за годината) — ЗДУД и ЗДАСД (роля admin) 144, директор 72; смята се върху годишните часове */
export const STAFF_NORM_YEAR: Record<string, number> = { zdud: 144, admin: 144, director: 72 }

/**
 * Лекторски на седмица по две правила (Наредба № 4/2017):
 *  • simple — всички часове се приравняват към нормата на лицето (терапии по 0,7 при норма 21) и се вади нормата;
 *  • mixed  — приравняват се само часовете, които ДОПЪЛВАТ нормата (чл. 8): първо часовете със същата норма
 *             като на лицето (по 1), после другите по коефициента; часовете над нормата се броят по 1 (чл. 10, ал. 2; чл. 20).
 * ИЧ само допълват нормата (последни); над нея се броят само тези по заповед (ichLect).
 */
export function overBoth(lines: { h: number; norm: number; individual: boolean }[], personNorm: number, ichLect = 0, unit?: number) {
  const r = (x: number) => Math.round(x * 100) / 100
  // мярка за приравняване: нормата на лицето (21/30); при норма 0 или годишна норма — 21
  const base = unit || personNorm || 21
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
  // колко реални часа ИЧ отиват за допълване на нормата (еднакво и при двата метода)
  const ichH = ich.reduce((a, l) => a + l.h, 0)
  const fillH = ichN > 0 ? fillS * ichH / ichN : 0
  return { simple: r(simple), mixed: r(over + lectM), ichFill: r(fillH) }
}

/**
 * Лекторските на един човек по учебния план — едно и също число в „Кратко“ (Справки) и в „Разпредели“ (Лекторски).
 *  • норма по длъжност (STAFF_NORM) или годишна (STAFF_NORM_YEAR); специалист — по роля, двойна роля, длъжност или по редовете на негово име;
 *  • терапиите на учител — по 0,7; на специалиста (своите, норма 30 във вноса) — по 1 към неговата норма;
 *  • ИЧ се броят изцяло (реални часове), показват се и отделно; ichFillYear — колко от тях допълват нормата;
 *  • седмиците на сроковете — от всички редове на човека.
 * Връща годишните лекторски по двата метода и седмичните по срокове (при годишна норма — годишните / всички седмици).
 */
export function lecturerOf(ls: CurLine[], s: { role?: string | null; therapy_role?: string | null; position?: string | null }) {
  const role = s.role || '', tr = s.therapy_role || '', pos = s.position || ''
  const SPEC = ['speech_therapist', 'rehabilitator', 'psychologist']
  const ownLine = (l: CurLine) => !l.classId && !/цоуд/i.test(l.holder) && !l.individual && l.norm === 30
  const posPsy = /психолог/i.test(pos), posSpec = /логопед|рехабилит|психолог/i.test(pos)
  const isSpec = SPEC.includes(role) || SPEC.includes(tr) || posSpec || ls.some(ownLine)
  const specNorm = role === 'psychologist' || tr === 'psychologist' || posPsy ? 30 : 21
  const normAll = STAFF_NORM[role] ?? (isSpec && !STAFF_NORM_YEAR[role] ? specNorm : 0)
  const normYear = STAFF_NORM_YEAR[role] ?? 0
  // седмици: от редовете без ИЧ, иначе от всички, иначе 18
  const mx = (a: number[], d: number) => a.length ? Math.max(...a) : d
  const W1 = mx(ls.filter(l => !l.individual && l.h1).map(l => l.w1), 18), W2 = mx(ls.filter(l => !l.individual && l.h2).map(l => l.w2), 18)
  const AW1 = mx(ls.filter(l => l.h1).map(l => l.w1), W1), AW2 = mx(ls.filter(l => l.h2).map(l => l.w2), W2)
  const nOf = (l: CurLine, own: number) => isSpec && l.norm === 30 && !/цоуд/i.test(l.holder) ? own : l.norm
  const r2 = (x: number) => Math.round(x * 100) / 100
  let yearSimple: number, yearMixed: number, s1: number, s2: number, m1: number, m2: number
  // без ИЧ — за заповедта за лекторски (ИЧ са по отделна заповед на директора): ИЧ само допълват нормата
  let noIchSimple: number, noIchMixed: number
  // ИЧ, които допълват нормата — за годината
  let ichFillYear = 0
  if (normYear) {
    const yl = ls.map(l => ({ h: l.h1 * (l.w1 || AW1) + l.h2 * (l.w2 || AW2), norm: nOf(l, 21), individual: l.individual }))
    const b = overBoth(yl.map(l => ({ ...l, individual: false })), normYear, 0, 21)
    yearSimple = Math.round(b.simple); yearMixed = Math.round(b.mixed)
    const n = overBoth(yl, normYear, 0, 21)
    noIchSimple = Math.round(n.simple); noIchMixed = Math.round(n.mixed)
    ichFillYear = n.ichFill
    const w = (AW1 + AW2) || 36
    s1 = s2 = r2(yearSimple / w); m1 = m2 = r2(yearMixed / w)
  } else {
    const t1 = ls.map(l => ({ h: l.h1, norm: nOf(l, normAll || 21), individual: l.individual }))
    const t2 = ls.map(l => ({ h: l.h2, norm: nOf(l, normAll || 21), individual: l.individual }))
    const b1 = overBoth(t1.map(l => ({ ...l, individual: false })), normAll, 0)
    const b2 = overBoth(t2.map(l => ({ ...l, individual: false })), normAll, 0)
    s1 = b1.simple; s2 = b2.simple; m1 = b1.mixed; m2 = b2.mixed
    yearSimple = Math.round(s1 * AW1 + s2 * AW2); yearMixed = Math.round(m1 * AW1 + m2 * AW2)
    const n1 = overBoth(t1, normAll, 0), n2 = overBoth(t2, normAll, 0)
    noIchSimple = Math.round(n1.simple * AW1 + n2.simple * AW2); noIchMixed = Math.round(n1.mixed * AW1 + n2.mixed * AW2)
    ichFillYear = n1.ichFill * AW1 + n2.ichFill * AW2
  }
  // под / над нормата — без ИЧ (те са в отделна колона)
  const noIch = ls.filter(l => !l.individual)
  const loadW = (t: 1 | 2) => noIch.reduce((a, l) => a + (t === 1 ? l.h1 : l.h2) * (normAll || 21) / nOf(l, normAll || 21), 0)
  const loadY = noIch.reduce((a, l) => a + (l.h1 * (l.w1 || AW1) + l.h2 * (l.w2 || AW2)) * 21 / nOf(l, 21), 0)
  const d1 = (x: number) => Math.round(x * 10) / 10
  const ich = ls.filter(l => l.individual)
  return {
    isSpec, normAll, normYear, W1, W2, AW1, AW2,
    yearSimple, yearMixed, s1, s2, m1, m2, noIchSimple, noIchMixed,
    diff1: normYear ? null : normAll ? d1(loadW(1) - normAll) : null,
    diff2: normYear ? null : normAll ? d1(loadW(2) - normAll) : null,
    diffY: normYear ? Math.round(loadY - normYear) : null,
    hasMain: noIch.some(l => l.h1 || l.h2),
    load1: d1(loadW(1)), load2: d1(loadW(2)),
    ichW1: d1(ich.reduce((a, l) => a + l.h1, 0)), ichW2: d1(ich.reduce((a, l) => a + l.h2, 0)),
    ichYearAll: Math.round(ich.reduce((a, l) => a + l.h1 * (l.w1 || AW1) + l.h2 * (l.w2 || AW2), 0)),
    /** ИЧ за годината, които допълват нормата (влизат в нея) */
    ichFillYear: Math.round(ichFillYear),
  }
}
