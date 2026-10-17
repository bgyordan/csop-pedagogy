// РЕМЕЛКА — типове, нивата на действие, видовете грешки, „умните“ изчисления и наръчникът за колегите.
// Логиката на методиката: диагностика (къде и как греши детето) → програма точно по грешките →
// кратки чести занимания (от действие с предмети към наум) → нова диагностика.
// Текстовете са наши, по принципите на методиката; не копират авторските тестове и материали.

export type Part = 'math' | 'social'
export type Skill = { id: string; part: Part; area: string; code: string; title: string; hint: string | null; sort: number; archived: boolean }
export type Profile = { student_id: string; parts: Part[]; started_at: string; started_by: string | null; note: string | null; active: boolean }
export type Kind = 'entry' | 'mid' | 'exit'
export type Assessment = { id: string; student_id: string; kind: Kind; held_on: string; staff_id: string | null; note: string | null; created_at: string }
export type Result = { assessment_id: string; skill_id: string; level: number; errors: string[]; note: string | null }
export type Goal = { id: string; student_id: string; skill_id: string; status: 'active' | 'mastered' | 'paused'; target_level: number; added_on: string; mastered_on: string | null; note: string | null }
export type Session = { id: string; student_id: string; staff_id: string | null; held_on: string; minutes: number | null; place: string | null; note: string | null; created_at: string }
export type Support = 'independent' | 'partial' | 'full'
export type SessionItem = { id: string; session_id: string; skill_id: string; level: number; support: Support; activity: string | null }

export const PARTS: Record<Part, { label: string; short: string; color: string; bg: string }> = {
  math: { label: 'Смятане', short: 'Смятане', color: '#2563eb', bg: '#eff6ff' },
  social: { label: 'Социални умения', short: 'Социални', color: '#059669', bg: '#ecfdf5' },
}
export const KINDS: Record<Kind, string> = { entry: 'Входяща', mid: 'Междинна', exit: 'Изходяща' }

/** Ниво на владеене (диагностика) — 0 не владее … 4 автоматизирано, пренася */
export const LEVELS: Record<Part, { n: number; label: string; short: string }[]> = {
  math: [
    { n: 0, label: 'Не владее още', short: 'не' },
    { n: 1, label: 'С предмети, в реална ситуация', short: 'предмети' },
    { n: 2, label: 'С картинка или схема', short: 'картинка' },
    { n: 3, label: 'Със символи (цифри, знаци)', short: 'символи' },
    { n: 4, label: 'Наум, бързо и сигурно', short: 'наум' },
  ],
  social: [
    { n: 0, label: 'Не владее още', short: 'не' },
    { n: 1, label: 'Разпознава (в картинка, история)', short: 'разпознава' },
    { n: 2, label: 'Упражнява в ролева игра', short: 'ролева игра' },
    { n: 3, label: 'Прилага в реална ситуация с подкана', short: 'с подкана' },
    { n: 4, label: 'Прилага сам, на различни места', short: 'сам' },
  ],
}
export const LEVEL_COLOR = ['#e2e8f0', '#fecaca', '#fde68a', '#bbf7d0', '#4ade80']
export const LEVEL_TEXT = ['#64748b', '#991b1b', '#92400e', '#166534', '#14532d']

/** Видовете грешки — „къде и как греши“ е сърцето на диагностиката */
export const ERRORS: Record<Part, string[]> = {
  math: [
    'брои отначало', 'пропуска/повтаря при броене', 'разменя цифрите (37 → 73)', 'огледално записване',
    'бърка десетици и единици', 'грешка при преминаване през 10', 'бърка знака на действието',
    'не разбира условието', 'разчита само на пръсти', 'бавно припомняне', 'губи концентрация',
  ],
  social: [
    'не започва сам', 'нужна е подкана', 'не довършва', 'не пренася в нова ситуация',
    'тревожност/избягване', 'импулсивна реакция', 'не разбира намерението на другия', 'трудност с промяна',
  ],
}

export const SUPPORT: Record<Support, { label: string; color: string; bg: string }> = {
  independent: { label: 'Сам', color: '#16a34a', bg: '#dcfce7' },
  partial: { label: 'Частична помощ', color: '#d97706', bg: '#fef3c7' },
  full: { label: 'Пълна помощ', color: '#ea580c', bg: '#ffedd5' },
}
export const PLACES = ['Индивидуално', 'Класна стая', 'ЦОУД', 'Магазин/навън', 'Кухня', 'Друго']

export const todaySofia = () => new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Sofia' })
export const fmtDate = (d: string) => d.split('-').reverse().join('.')

/** Последното ниво по умение — от диагностиките и от заниманията (сам = нивото; с помощ — едно по-малко) */
export function currentLevels(assessments: Assessment[], results: Result[], sessions: Session[], items: SessionItem[]) {
  const date: Record<string, string> = {}
  const lvl: Record<string, number> = {}
  const aDate = Object.fromEntries(assessments.map(a => [a.id, a.held_on]))
  results.forEach(r => {
    const d = aDate[r.assessment_id] || ''
    if (!date[r.skill_id] || d >= date[r.skill_id]) { date[r.skill_id] = d; lvl[r.skill_id] = r.level }
  })
  const sDate = Object.fromEntries(sessions.map(s => [s.id, s.held_on]))
  items.filter(i => i.support === 'independent').forEach(i => {
    const d = sDate[i.session_id] || ''
    if (d >= (date[i.skill_id] || '') && i.level > (lvl[i.skill_id] ?? -1)) { date[i.skill_id] = d; lvl[i.skill_id] = i.level }
  })
  return lvl
}

/**
 * Предложение за програма: във всяка област — първите умения подред, които още не са на целевото ниво
 * („работа на границата на възможностите“). Най-много `perArea` на област и `max` общо.
 */
export function suggestProgram(skills: Skill[], parts: Part[], levels: Record<string, number>, goals: Goal[], target = 3, perArea = 2, max = 8) {
  const taken = new Set(goals.filter(g => g.status !== 'paused').map(g => g.skill_id))
  const out: Skill[] = []
  const byArea = new Map<string, Skill[]>()
  skills.filter(s => !s.archived && parts.includes(s.part)).sort((a, b) => a.sort - b.sort)
    .forEach(s => { const k = `${s.part}|${s.area}`; (byArea.get(k) || byArea.set(k, []).get(k)!).push(s) })
  for (const list of Array.from(byArea.values())) {
    // само области, в които има диагностика — без нея не предлагаме
    if (!list.some(s => levels[s.id] !== undefined)) continue
    const open = list.filter(s => (levels[s.id] ?? 0) < target && !taken.has(s.id)).slice(0, perArea)
    out.push(...open)
  }
  return out.slice(0, max)
}

/** Готово ли е умението: последните 3 записа в заниманията — сам, на нивото или над него */
export function masteryReady(goal: Goal, sessions: Session[], items: SessionItem[]) {
  const sDate = Object.fromEntries(sessions.map(s => [s.id, s.held_on + s.created_at]))
  const its = items.filter(i => i.skill_id === goal.skill_id).sort((a, b) => (sDate[a.session_id] || '').localeCompare(sDate[b.session_id] || ''))
  const last = its.slice(-3)
  return last.length >= 3 && last.every(i => i.support === 'independent' && i.level >= goal.target_level)
}

/** Средно ниво по област в една диагностика (0–4) */
export function areaAverages(skills: Skill[], results: Result[], assessmentId: string) {
  const by: Record<string, number[]> = {}
  const sk = Object.fromEntries(skills.map(s => [s.id, s]))
  results.filter(r => r.assessment_id === assessmentId).forEach(r => {
    const s = sk[r.skill_id]; if (!s) return
    ;(by[`${s.part}|${s.area}`] ||= []).push(r.level)
  })
  return Object.fromEntries(Object.entries(by).map(([k, v]) => [k, v.reduce((a, x) => a + x, 0) / v.length]))
}

export type Insight = { tone: 'go' | 'warn' | 'info'; title: string; text: string; action?: { label: string; kind: 'assess' | 'program' | 'master' | 'session'; goalId?: string } }

export function insights(p: Profile, skills: Skill[], assessments: Assessment[], goals: Goal[], sessions: Session[], items: SessionItem[], today: string): Insight[] {
  const out: Insight[] = []
  const days = (a: string, b: string) => Math.round((new Date(b).getTime() - new Date(a).getTime()) / 86400000)
  if (!assessments.length) {
    out.push({ tone: 'info', title: 'Първо — входяща диагностика', text: 'РЕМЕЛКА започва оттам къде и как греши детето. Отбележете нивото по уменията и видовете грешки — програмата се подрежда сама.', action: { label: 'Диагностика', kind: 'assess' } })
    return out
  }
  const active = goals.filter(g => g.status === 'active')
  if (!active.length) out.push({ tone: 'info', title: 'Няма програма', text: 'Изберете 3–6 умения „на границата“ — системата предлага първите неовладени във всяка област.', action: { label: 'Програма', kind: 'program' } })
  for (const g of active) {
    if (masteryReady(g, sessions, items)) {
      const s = skills.find(x => x.id === g.skill_id)
      out.push({ tone: 'go', title: `„${s?.title || 'Умението'}“ — овладяно`, text: 'Последните 3 пъти — сам и на целевото ниво. Отбележете го и добавете следващото в областта.', action: { label: 'Овладяно ✓', kind: 'master', goalId: g.id } })
      break
    }
  }
  const last = sessions.slice().sort((a, b) => b.held_on.localeCompare(a.held_on))[0]
  if (active.length && (!last || days(last.held_on, today) > 10))
    out.push({ tone: 'warn', title: last ? `Последно занимание преди ${days(last.held_on, today)} дни` : 'Още няма занимания', text: 'Методиката разчита на кратки и чести занимания — по 15–20 минути, няколко пъти седмично.', action: { label: 'Занимание', kind: 'session' } })
  // застой: умение в програмата > 6 седмици и само с помощ
  for (const g of active) {
    const its = items.filter(i => i.skill_id === g.skill_id)
    if (days(g.added_on, today) > 42 && its.length >= 4 && !its.some(i => i.support === 'independent')) {
      const s = skills.find(x => x.id === g.skill_id)
      out.push({ tone: 'warn', title: `Застой: „${s?.title}“`, text: 'Върнете се едно ниво назад (към предметите или картинката) или разделете умението на по-малки стъпки.' })
      break
    }
  }
  const lastA = assessments.slice().sort((a, b) => b.held_on.localeCompare(a.held_on))[0]
  if (days(lastA.held_on, today) > 90)
    out.push({ tone: 'info', title: 'Време е за междинна диагностика', text: `Последната е от ${fmtDate(lastA.held_on)}. Новата показва напредъка по области и обновява програмата.`, action: { label: 'Диагностика', kind: 'assess' } })
  return out.slice(0, 4)
}

// ── Наръчник за колегите (наш текст, по принципите на методиката) ──
export const PRINCIPLES: { title: string; text: string }[] = [
  { title: 'Първо диагностика', text: 'Не започваме „от началото на учебника“, а оттам, където детето реално е. Важно е не само дали греши, а КАК греши — грешката показва какво точно не е изградено.' },
  { title: 'Програма по грешките', text: 'Работи се върху малко умения наведнъж (3–6), първите неовладени във всяка област. Всяко следващо се гради върху предходното.' },
  { title: 'От действие към наум', text: 'Всяко умение минава през нивата: с предмети и в реална ситуация → с картинка или схема → със символи → наум. Ако детето се затруднява — връщаме се едно ниво назад, не повтаряме по-силно.' },
  { title: 'Игра и ежедневие', text: 'Смятаме с неща, които детето познава: пари, часовник, рецепта, пазаруване. Социалните умения се упражняват първо в ролева игра, после в класа, после навън.' },
  { title: 'Кратко и често', text: '15–20 минути, няколко пъти седмично, са по-ценни от един дълъг час. Записът в ЕИС отнема минута — така целият екип вижда къде е детето.' },
  { title: 'Успех на всяко занимание', text: 'Завършваме със задача, която детето може. Хвалим усилието и стратегията, не само верния отговор.' },
  { title: 'Пренос', text: 'Умението е овладяно, когато детето го прилага само, с различни хора и на различни места. Затова записваме кой и къде е работил.' },
  { title: 'Заедно със семейството', text: 'Една конкретна задача за вкъщи (напр. „броим чиниите на масата“) струва повече от лист с упражнения.' },
]

export const AREA_IDEAS: Record<string, string[]> = {
  'Броене и количество': ['Броим предмети, като ги местим от купичка в купичка.', 'Зарове и домино — колко точки виждаш?', 'Подреждаме масата: колко чинии са ни нужни?'],
  'Числа и място': ['Пръчици по 10, вързани с ластик = десетица.', 'Пари: монети от 1 и 10 цента за единици и десетици.', 'Числова лента на пода — скачаме до числото.'],
  'Събиране и изваждане': ['„Допълни до 10“ с рамка от 10 полета.', 'Пазаруване в класа с етикети с цени.', 'Истории с играчки: имаше 5, дойдоха още 3…'],
  'Умножение и деление': ['Групи по равен брой (кутии с яйца, чорапи по чифтове).', 'Разпределяме бисквитки поравно.', 'Броене през 2, 5, 10 със скачане.'],
  'Измерване': ['Мерим с крачки, после с линийка.', 'Кухня: рецепта с чаши и кантар.', 'Кое е по-тежко — познай, после претегли.'],
  'Време': ['Картонен часовник с дневния режим на детето.', 'Визуален график за деня с часове.', 'Календар на рождените дни в класа.'],
  'Пари': ['Магазин в класа с истински цени в евро.', 'Подреждаме монетите по стойност.', 'Стига ли ми за…? — избор с ограничен бюджет.'],
  'Грижа за себе си': ['Визуална последователност за миене на ръце.', 'Игра „Облечи се за времето“.', 'Ролева игра „на масата“ (хранене, сервиране).'],
  'Общуване': ['Ролева игра: „Как ще помолиш за помощ?“', 'Карти с емоции — как се чувства той?', 'Игра на ред с топка — говори този, който държи топката.'],
  'Правила и поведение': ['Правилата на класа с картинки, договорени заедно.', 'Задача в двойка с едни ножици — споделяме.', 'Истории „Какво би направил, ако…“.'],
  'Самостоятелност навън': ['Списък с картинки за пазаруване.', 'Разходка до пешеходна пътека — стоп, погледни, слушай.', 'Карта с адреса и телефона на родителя в раницата.'],
  'Ежедневие': ['Визуален график от „Визуален график“ в ЕИС.', 'Отговорник за деня: полива цветята, раздава листовете.', 'Последователност за приготвяне на сандвич.'],
}
