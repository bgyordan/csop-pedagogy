// Професионално портфолио (Наредба № 15/2019): раздели, типове и изчисления — часове и кредити за периода,
// стаж, попълване на раздел А на атестационната карта от портфолиото.
import type { SectionA } from './evaluation'
import type { NeispuoSnapshot } from './neispuo-staff'

export type Visibility = 'private' | 'managers' | 'colleagues'
export type SectionKey =
  | 'practice' | 'results' | 'achievements' | 'qualification' | 'aids' | 'events'
  | 'creative' | 'interaction' | 'mtb' | 'policy' | 'feedback' | 'other'

/** qualification — придобита професионална квалификация по дипломата (напр. „учител“), идва от НЕИСПУО */
export type Edu = { level: string; school?: string; specialty?: string; qualification?: string; year?: number | null }
export type PPProfile = {
  staff_id: string; philosophy: string | null; about: string | null; education: Edu[]
  specialty: string | null; teacher_q: boolean | null; other_q: string | null; pks: string | null; pks_year: number | null
  work_since: string | null; teacher_since: string | null; years_extra: { total?: number; teacher?: number } | null
  strengths: string | null; growth: string | null; visibility: Visibility; updated_at?: string
  /** последен импорт от НЕИСПУО (справка) — src/lib/neispuo-staff.ts */
  neispuo?: NeispuoSnapshot | null
}
export type PPFile = { id: string; item_id: string; staff_id: string; name: string; path: string; mime: string | null; size: number | null; created_at: string }
export type PPItem = {
  id: string; staff_id: string; section: SectionKey; title: string; body: string | null; reflection: string | null
  date_from: string | null; date_to: string | null; kind: string | null; level: string | null; part_role: string | null
  provider: string | null; doc_no: string | null; hours: number | null; credits: number | null; url: string | null
  post_id: string | null; visibility: Visibility; featured: boolean; created_by: string | null
  created_at: string; updated_at: string; files?: PPFile[]
}
export type GoalStatus = 'planned' | 'in_progress' | 'done' | 'dropped'
export type PPGoal = {
  id: string; staff_id: string; academic_year_id: string | null; area: string | null; goal: string; actions: string | null
  indicator: string | null; due: string | null; status: GoalStatus; reflection: string | null; sort: number
}
export type PPLink = { participant_id: string; item_id: string; criterion: string; note: string | null }
export type PPEvidence = {
  from: string; to: string
  checks: { id: string; date: string; book_no: number | null; subject: string; inspector: string | null; strengths: string | null; conclusions: string | null }[]
  counts: { k: string; l: string; n: number | null }[]
  evals: { name: string; kind: string; total: number | null; result: number | null; grade: string | null; at: string | null }[]
}

/** Раздели на портфолиото — по съдържанието, определено в Наредба № 15, допълнени за ЦСОП (терапевти). */
export const SECTIONS: { key: SectionKey; label: string; hint: string; tone: string }[] = [
  { key: 'practice', label: 'Добри практики, програми и проекти', hint: 'Документи, които показват практическото прилагане на знанията и уменията: добри практики, програми, проекти, изследвания, открити уроци/занимания', tone: 'bg-teal-50 text-teal-800 border-teal-200' },
  { key: 'results', label: 'Резултати и напредък на децата', hint: 'Резултати от обучението и индивидуалния напредък на децата/учениците, с които работя (без лични данни — обобщено или със съгласие)', tone: 'bg-emerald-50 text-emerald-800 border-emerald-200' },
  { key: 'achievements', label: 'Постижения и отличия', hint: 'Лични постижения и постижения на децата: награди, грамоти, класирания, благодарствени писма', tone: 'bg-amber-50 text-amber-800 border-amber-200' },
  { key: 'qualification', label: 'Квалификация и професионално израстване', hint: 'Обучения (вътрешноинституционални и от обучаващи организации), ПКС, специализации, нова специалност — с часове, кредити и удостоверение', tone: 'bg-indigo-50 text-indigo-800 border-indigo-200' },
  { key: 'aids', label: 'Методики, помагала и инструменти', hint: 'Обосновка за избора на учебни помагала, методики, програми за терапия, диагностични инструменти', tone: 'bg-sky-50 text-sky-800 border-sky-200' },
  { key: 'events', label: 'Конференции, семинари, конкурси', hint: 'Участие с доклад, статия, презентация, методическа разработка; участие в конкурси и форуми', tone: 'bg-violet-50 text-violet-800 border-violet-200' },
  { key: 'creative', label: 'Публикации и лично творчество', hint: 'Списък на личното творчество: статии, книги, авторски материали, игри, видео, сайтове', tone: 'bg-fuchsia-50 text-fuchsia-800 border-fuchsia-200' },
  { key: 'interaction', label: 'Взаимодействие с родители и институции', hint: 'Работа с родителите, екипите, други институции и заинтересовани страни (ДСП, РЦПППО, общини, НПО)', tone: 'bg-rose-50 text-rose-800 border-rose-200' },
  { key: 'policy', label: 'Участие в политиките на ЦСОП', hint: 'Комисии, екипи, работни групи, ПС, разработване на вътрешни документи, наставничество, представителство', tone: 'bg-slate-100 text-slate-800 border-slate-300' },
  { key: 'mtb', label: 'Принос за материалната база', hint: 'Подобряване на кабинета, оборудване, дарения, проекти за материалната база', tone: 'bg-lime-50 text-lime-800 border-lime-200' },
  { key: 'feedback', label: 'Отзиви и обратна връзка', hint: 'Мнения на родители, колеги, ръководство, партньори; благодарности', tone: 'bg-orange-50 text-orange-800 border-orange-200' },
  { key: 'other', label: 'Други материали', hint: 'Всичко друго, което показва професионалното ми развитие', tone: 'bg-zinc-50 text-zinc-700 border-zinc-200' },
]
export const sectionMeta = (k: string) => SECTIONS.find(s => s.key === k) || SECTIONS[SECTIONS.length - 1]

/** Видове квалификация (за раздел А на атестационната карта) */
export const Q_KINDS: { key: string; label: string; hint: string }[] = [
  { key: 'internal', label: 'Вътрешноинституционална', hint: 'в ЦСОП — поне 16 академични часа годишно' },
  { key: 'external', label: 'От обучаваща организация (с кредити)', hint: 'поне 48 академични часа (3 кредита) за атестационния период' },
  { key: 'pks', label: 'Професионално-квалификационна степен', hint: 'V–I ПКС' },
  { key: 'degree', label: 'Специализация / нова специалност / степен', hint: 'висше училище' },
  { key: 'self', label: 'Самообучение / друго', hint: 'уебинари, курсове без кредити' },
]
export const qKindLabel = (k: string | null | undefined) => Q_KINDS.find(x => x.key === k)?.label || ''

export const LEVELS: { key: string; label: string }[] = [
  { key: 'institution', label: 'В ЦСОП' }, { key: 'municipal', label: 'Общинско' }, { key: 'regional', label: 'Регионално' },
  { key: 'national', label: 'Национално' }, { key: 'international', label: 'Международно' },
]
export const levelLabel = (k: string | null | undefined) => LEVELS.find(x => x.key === k)?.label || ''
export const PART_ROLES = ['Участник', 'Автор', 'Съавтор', 'Лектор / водещ', 'Организатор', 'Ръководител', 'Член на екип', 'Наставник']

export const VIS: Record<Visibility, { label: string; hint: string }> = {
  private: { label: 'Само аз', hint: 'вижда го само авторът (и комисията, ако го посочите като доказателство)' },
  managers: { label: 'Ръководството', hint: 'директорът, ЗДУД и атестационната комисия' },
  colleagues: { label: 'Колегите', hint: 'всички служители в ЕИС' },
}

export const GOAL_STATUS: Record<GoalStatus, { label: string; cls: string }> = {
  planned: { label: 'Планирана', cls: 'bg-slate-100 text-slate-700' },
  in_progress: { label: 'В процес', cls: 'bg-amber-100 text-amber-800' },
  done: { label: 'Постигната', cls: 'bg-emerald-100 text-emerald-800' },
  dropped: { label: 'Отпаднала', cls: 'bg-zinc-100 text-zinc-500' },
}

/** Норми за квалификацията (Наредба № 15): 1 кредит = 16 академични часа */
export const HOURS_PER_CREDIT = 16
export const INTERNAL_MIN_YEAR = 16
export const EXTERNAL_MIN_PERIOD = 48

export const PP_MANAGERS = ['admin', 'zdud', 'director']
export const PP_ROLES = ['class_teacher', 'teacher', 'educator', 'speech_therapist', 'psychologist', 'rehabilitator', 'coordinator', 'zdud', 'director', 'admin']

const itemDate = (i: Pick<PPItem, 'date_from' | 'date_to' | 'created_at'>) => i.date_to || i.date_from || i.created_at.slice(0, 10)
export const inPeriod = (i: Pick<PPItem, 'date_from' | 'date_to' | 'created_at'>, from?: string | null, to?: string | null) => {
  const d = itemDate(i)
  return (!from || d >= from) && (!to || d <= to)
}

/** Часове и кредити от квалификацията за периода */
export function qualificationTotals(items: PPItem[], from?: string | null, to?: string | null) {
  const q = items.filter(i => i.section === 'qualification' && inPeriod(i, from, to))
  const sum = (k: string, f: 'hours' | 'credits') => q.filter(i => i.kind === k).reduce((s, i) => s + Number(i[f] || 0), 0)
  const internal = sum('internal', 'hours')
  const extHours = sum('external', 'hours')
  const credits = q.reduce((s, i) => s + Number(i.credits || 0), 0)
  return { internal, extHours, credits, count: q.length }
}

/** Години стаж към дата (от начална дата + добавени години) */
export function yearsSince(since: string | null | undefined, at: string, extra = 0): number | null {
  if (!since && !extra) return null
  let y = extra
  if (since) {
    const ms = Date.parse(at + 'T00:00:00Z') - Date.parse(since + 'T00:00:00Z')
    y += Math.max(0, ms / (365.25 * 864e5))
  }
  return Math.floor(y)
}

/** Раздел А на атестационната карта — от портфолиото (служителят го преглежда и поправя). */
export function sectionAFromPortfolio(profile: PPProfile | null, items: PPItem[], from: string | null, to: string | null, prev?: SectionA | null): SectionA {
  const at = to || new Date().toISOString().slice(0, 10)
  const edu = [...(profile?.education || [])].sort((a, b) => Number(a.year || 0) - Number(b.year || 0))
  const t = qualificationTotals(items, from, to)
  const out: SectionA = { ...(prev || {}) }
  if (edu[0]?.level) out.edu1 = edu[0].level
  if (edu.length > 1 && edu[edu.length - 1].level) out.edu2 = edu[edu.length - 1].level
  if (profile?.specialty) out.specialty = profile.specialty
  if (profile?.teacher_q != null) out.teacher_q = profile.teacher_q ? 'yes' : 'no'
  if (profile?.other_q) { out.other_q = 'yes'; out.other_q_text = profile.other_q }
  if (profile?.pks) out.pks = profile.pks
  const yt = yearsSince(profile?.work_since, at, Number(profile?.years_extra?.total || 0))
  const yy = yearsSince(profile?.teacher_since, at, Number(profile?.years_extra?.teacher || 0))
  if (yt != null) out.years_total = yt
  if (yy != null) out.years_teacher = yy
  out.hours_internal = t.internal || out.hours_internal || null
  out.hours_mandatory = t.extHours || out.hours_mandatory || null
  out.credits = t.credits || out.credits || null
  return out
}

export const safeName = (n: string) => n.replace(/[^\w.\-]+/g, '_')
export const fmtNum = (v: number | null | undefined) => (v == null ? '' : Number.isInteger(Number(v)) ? String(v) : Number(v).toFixed(1).replace('.', ','))
export const dateRange = (a: string | null, b: string | null) => {
  const d = (x: string) => x.slice(0, 10).split('-').reverse().join('.')
  if (a && b && a !== b) return `${d(a)} – ${d(b)}`
  return a ? d(a) : b ? d(b) : ''
}
