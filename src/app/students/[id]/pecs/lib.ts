// PECS — типове, ръководство по етапи и „умните“ изчисления (готовност, подсказки, мотиватори, генерализация).
// Текстовете са наши, по метода; не копират официалните материали на PECS.

export type Profile = {
  student_id: string; phase: number; phase_since: string; started_at: string; started_by: string | null
  criterion_pct: number; criterion_sessions: number; note: string | null; active: boolean
}
export type Item = {
  id: string; student_id: string; label: string; picto_key: string | null; photo: string | null
  is_reinforcer: boolean; status: 'learning' | 'independent' | 'archived'; added_on: string; mastered_on: string | null; sort: number
}
export type Session = {
  id: string; student_id: string; staff_id: string | null; held_on: string; phase: number; place: string | null
  trials: number; independent: number; note: string | null; created_at: string
}
export type Trial = { id: string; session_id: string; item_id: string | null; prompt: Prompt; seq: number }
export type PhaseLog = { id: string; phase: number; changed_on: string; changed_by: string | null; note: string | null }
export type Pref = { id: string; item_a: string; item_b: string; chosen: string | null; created_at: string }
export type Prompt = 'independent' | 'partial' | 'full' | 'error'

export const ROMAN = ['', 'I', 'II', 'III', 'IV', 'V', 'VI']
export const PHASE_COLOR = ['', '#0891b2', '#2563eb', '#7c3aed', '#c026d3', '#db2777', '#ea580c']

export const PROMPTS: Record<Prompt, { label: string; short: string; color: string; bg: string }> = {
  independent: { label: 'Сам', short: 'сам', color: '#16a34a', bg: '#dcfce7' },
  partial: { label: 'Частична помощ', short: 'частична', color: '#d97706', bg: '#fef3c7' },
  full: { label: 'Пълна помощ', short: 'пълна', color: '#ea580c', bg: '#ffedd5' },
  error: { label: 'Грешна картинка', short: 'грешка', color: '#dc2626', bg: '#fee2e2' },
}

export const PLACES = ['Класна стая', 'Терапия', 'Столова', 'Двор', 'ЦОУД', 'Друго']

export type PhaseGuide = { name: string; goal: string; how: string[]; avoid: string[]; ready: string; tip: string }
export const PHASES: PhaseGuide[] = [
  { name: '', goal: '', how: [], avoid: [], ready: '', tip: '' },
  {
    name: 'Размяна',
    goal: 'Детето взима картинка, подава я в ръката на възрастния и веднага получава това, което иска.',
    how: [
      'Двама възрастни: партньор отпред (държи любимия предмет) и помощник зад детето (помага с ръце).',
      'Партньорът показва предмета, но не пита „Какво искаш?“ и не казва „Дай картинката“.',
      'Щом детето посегне, помощникът насочва ръката му към картинката и към отворената длан на партньора.',
      'Картинката е в дланта → веднага: „Топка!“ и детето получава топката.',
      'Помощта се маха постепенно: първо пълна, после частична, накрая никаква.',
    ],
    avoid: ['Словесни подкани („Кажи…“, „Дай…“)', 'Повече от една картинка пред детето', 'Чакане детето да „заслужи“ — предметът се дава веднага'],
    ready: 'Подава картинката само, без помощ, за различни любими неща.',
    tip: 'Записвайте всеки опит: „Сам“ само ако никой не е докоснал детето.',
  },
  {
    name: 'Разстояние и постоянство',
    goal: 'Детето отива до книгата си, взима картинката и я носи на човека — дори когато той е по-далеч.',
    how: [
      'Партньорът постепенно се отдалечава; после и книгата се слага по-далеч.',
      'Различни хора, стаи и любими предмети — детето трябва да може навсякъде и с всеки.',
      'Картинките вече живеят в комуникационната книга на детето.',
    ],
    avoid: ['Партньорът да се приближава сам към детето', 'Само един човек и едно място'],
    ready: 'Сам отива и подава от разстояние, на различни места и на различни хора.',
    tip: 'Сменяйте партньорите — ЕИС показва с кого и къде вече е упражнявано.',
  },
  {
    name: 'Избор между картинки',
    goal: 'Детето избира правилната картинка между няколко и взема точно това, което е поискало.',
    how: [
      'Започнете с любим и безразличен предмет (напр. бисквитка и чорап).',
      'После два любими: подайте и двата и вижте дали детето взема поисканото (проверка за съответствие).',
      'Ако посегне към другото — спокойно покажете правилната картинка, помогнете да я подаде.',
      'Постепенно повече картинки на страница.',
    ],
    avoid: ['Подсказване кое да избере', 'Укор при грешка'],
    ready: 'Избира правилно между много картинки и взема поисканото.',
    tip: 'Бутонът „Грешна картинка“ се появява от този етап — грешките са нормални и полезни за данните.',
  },
  {
    name: 'Изречение „Аз искам…“',
    goal: 'Детето сглобява изречение на лентата и подава цялата лента.',
    how: [
      'Картинката „Аз искам“ е на лентата; детето добавя желаното.',
      'Партньорът „чете“ лентата, като сочи всяка картинка, и прави пауза — място за думата на детето.',
      'По-нататък — описания: цвят, размер, брой („голяма червена топка“).',
    ],
    avoid: ['Изискване да говори, за да получи', 'Подаване само на картинката без лентата'],
    ready: 'Сам сглобява и подава лентата, често с опит за дума.',
    tip: 'Лентите са готови в „Отпечатай книгата“.',
  },
  {
    name: 'Отговор на „Какво искаш?“',
    goal: 'Детето отговаря с лента, когато го попитат „Какво искаш?“, и продължава да иска и само.',
    how: [
      'Попитайте и веднага посочете „Аз искам“; после забавяйте посочването.',
      'Смесвайте: понякога питайте, понякога оставяйте детето да поиска само.',
    ],
    avoid: ['Само питане — детето трябва да продължи да иска и спонтанно'],
    ready: 'Отговаря без помощ и продължава да иска спонтанно.',
    tip: 'В бележката към заниманието отбележете кои искания бяха спонтанни.',
  },
  {
    name: 'Коментиране',
    goal: 'Детето казва какво вижда, чува или има: „Аз виждам кола“.',
    how: [
      'Нови ленти: „Аз виждам“, „Аз чувам“, „Аз имам“.',
      'Смесвайте въпросите: „Какво искаш?“, „Какво виждаш?“.',
      'Радвайте се заедно — наградата тук е общуването, не предметът.',
    ],
    avoid: ['Даване на предмета след коментар (това не е искане)'],
    ready: 'Коментира спонтанно и различава искане от коментар.',
    tip: 'Добавете в речника и картинки за неща, които не се ядат и не се играят — за коментари.',
  },
]

export const pct = (s: { trials: number; independent: number }) => s.trials ? Math.round((s.independent / s.trials) * 100) : 0

/** Готовност за следващия етап: последните N занимания в текущия етап (с поне 3 опита) */
export function readiness(p: Profile, sessions: Session[]) {
  const inPhase = sessions.filter(s => s.phase === p.phase && s.trials >= 3).sort((a, b) => a.held_on.localeCompare(b.held_on) || a.created_at.localeCompare(b.created_at))
  const last = inPhase.slice(-p.criterion_sessions)
  const avg = last.length ? Math.round(last.reduce((a, s) => a + pct(s), 0) / last.length) : 0
  const ready = p.phase < 6 && last.length >= p.criterion_sessions && last.every(s => pct(s) >= p.criterion_pct)
  const passing = last.filter(s => pct(s) >= p.criterion_pct).length
  return { avg, ready, count: last.length, passing, inPhase: inPhase.length }
}

/** По картинка: последните 10 опита, % сам, последна употреба */
export function itemStats(items: Item[], trials: Trial[], sessions: Session[]) {
  const date: Record<string, string> = Object.fromEntries(sessions.map(s => [s.id, s.held_on]))
  const order = (t: Trial) => (date[t.session_id] || '') + String(t.seq).padStart(4, '0')
  const out: Record<string, { last: Prompt[]; pct: number; total: number; lastUsed: string | null }> = {}
  for (const it of items) {
    const ts = trials.filter(t => t.item_id === it.id).sort((a, b) => order(a).localeCompare(order(b)))
    const last = ts.slice(-10).map(t => t.prompt)
    out[it.id] = {
      last, total: ts.length,
      pct: last.length ? Math.round(last.filter(x => x === 'independent').length / last.length * 100) : 0,
      lastUsed: ts.length ? date[ts[ts.length - 1].session_id] || null : null,
    }
  }
  return out
}

/** Подреждане на мотиваторите по „Кое избира?“ (изглаждане на Лаплас) */
export function prefRanking(items: Item[], prefs: Pref[]) {
  const st: Record<string, { w: number; n: number }> = {}
  for (const it of items) st[it.id] = { w: 0, n: 0 }
  for (const p of prefs) {
    for (const id of [p.item_a, p.item_b]) if (st[id]) st[id].n++
    if (p.chosen && st[p.chosen]) st[p.chosen].w++
  }
  return items.map(it => ({ item: it, ...st[it.id], score: (st[it.id].w + 1) / (st[it.id].n + 2) }))
    .sort((a, b) => b.score - a.score || b.n - a.n)
}

/** Следващата двойка за „Кое избира?“ — най-рядко сравняваните */
export function nextPair(items: Item[], prefs: Pref[], skip?: string): [Item, Item] | null {
  if (items.length < 2) return null
  const seen: Record<string, number> = {}
  const key = (a: string, b: string) => a < b ? a + b : b + a
  for (const p of prefs) seen[key(p.item_a, p.item_b)] = (seen[key(p.item_a, p.item_b)] || 0) + 1
  let best: [Item, Item] | null = null, bestN = Infinity
  for (let i = 0; i < items.length; i++) for (let j = i + 1; j < items.length; j++) {
    const k = key(items[i].id, items[j].id)
    if (k === skip) continue
    const n = (seen[k] || 0) + Math.random() * 0.5
    if (n < bestN) { bestN = n; best = Math.random() < 0.5 ? [items[i], items[j]] : [items[j], items[i]] }
  }
  return best
}

export type Insight = { tone: 'go' | 'warn' | 'info'; title: string; text: string; action?: { label: string; kind: 'advance' | 'master' | 'session' | 'prefs' | 'add'; itemId?: string } }

/** „Умни подсказки“ — какво да направим сега */
export function insights(p: Profile, items: Item[], sessions: Session[], trials: Trial[], prefs: Pref[], names: Record<string, string>, today: string): Insight[] {
  const out: Insight[] = []
  const r = readiness(p, sessions)
  const active = items.filter(i => i.status !== 'archived')
  const reinf = active.filter(i => i.is_reinforcer)
  const sorted = sessions.slice().sort((a, b) => a.held_on.localeCompare(b.held_on))
  const last = sorted[sorted.length - 1]

  if (!active.length) out.push({ tone: 'info', title: 'Започнете с любимите неща', text: 'Добавете 3–5 неща, които детето най-много обича (храна, играчка, дейност). PECS започва от тях.', action: { label: 'Добави', kind: 'add' } })
  if (r.ready) out.push({ tone: 'go', title: `Готов за етап ${ROMAN[p.phase + 1]}`, text: `${r.passing} от последните ${r.count} занимания са над ${p.criterion_pct}% сам (средно ${r.avg}%). Следва: ${PHASES[p.phase + 1].name.toLowerCase()}.`, action: { label: `Премини към етап ${ROMAN[p.phase + 1]}`, kind: 'advance' } })
  else if (r.inPhase && r.count) out.push({ tone: 'info', title: `Етап ${ROMAN[p.phase]}: ${r.passing} от ${p.criterion_sessions} занимания над прага`, text: `Нужни са ${p.criterion_sessions} поредни занимания с поне ${p.criterion_pct}% сам. Сега: средно ${r.avg}%.` })

  if (last) {
    const days = Math.round((Date.parse(today) - Date.parse(last.held_on)) / 864e5)
    if (days >= 7) out.push({ tone: 'warn', title: `${days} дни без занимание`, text: 'PECS работи с всекидневни кратки упражнения — дори 5 опита на ден са достатъчни.', action: { label: 'Занимание сега', kind: 'session' } })
  } else if (active.length) out.push({ tone: 'info', title: 'Първото занимание', text: 'Натиснете „Занимание“ — ЕИС ще ви води стъпка по стъпка и ще брои опитите.', action: { label: 'Занимание', kind: 'session' } })

  // генерализация: хора и места
  const recent = sorted.slice(-8)
  if (recent.length >= 4) {
    const people = new Set(recent.map(s => s.staff_id))
    const places = new Set(recent.map(s => s.place || ''))
    if (people.size === 1) out.push({ tone: 'warn', title: 'Само с един човек', text: `Последните занимания са само с ${names[last?.staff_id || ''] || 'един колега'}. Детето трябва да общува с всеки — нека опита и друг колега.` })
    else if (places.size === 1 && p.phase >= 2) out.push({ tone: 'warn', title: 'Само на едно място', text: 'Опитайте в столовата, на двора или в друга стая — етап II е точно за това.' })
  }

  // помощта не намалява
  const lastIds = new Set(sorted.slice(-3).map(s => s.id))
  const lt = trials.filter(t => lastIds.has(t.session_id))
  if (lt.length >= 10 && p.phase <= 2 && lt.filter(t => t.prompt === 'full').length / lt.length > 0.5)
    out.push({ tone: 'warn', title: 'Помощта е предимно пълна', text: 'Опитайте да я намалите: ръка на лакътя вместо върху дланта, после само докосване.' })
  if (lt.length >= 10 && p.phase >= 3 && lt.filter(t => t.prompt === 'error').length / lt.length > 0.3)
    out.push({ tone: 'warn', title: 'Много грешни избори', text: 'Намалете броя картинки на страницата или сложете по-различни една от друга (любимо + безразлично).' })

  // застой → мотиваторът
  if (r.inPhase >= 5 && r.avg < 40) {
    const top = prefRanking(reinf, prefs)[0]
    out.push({ tone: 'warn', title: 'Бавен напредък', text: top && top.n ? `Проверете мотиватора — най-силно предпочита „${top.item.label}“. Ползвайте него.` : 'Може би мотиваторът не е достатъчно силен. Направете „Кое избира?“.', action: { label: 'Кое избира?', kind: 'prefs' } })
  }
  if (reinf.length >= 2 && !prefs.length) out.push({ tone: 'info', title: 'Кое обича най-много?', text: 'Минута игра „Кое избира?“ подрежда любимите неща — така знаем с какво да започнем.', action: { label: 'Кое избира?', kind: 'prefs' } })

  // научени картинки
  const stats = itemStats(active, trials, sessions)
  for (const it of active) {
    const s = stats[it.id]
    if (it.status === 'learning' && s.last.length >= 10 && s.pct >= 80) {
      out.push({ tone: 'go', title: `„${it.label}“ — вече сам`, text: `${s.pct}% сам в последните 10 опита. Маркирайте като научена и добавете нова.`, action: { label: 'Научена ✓', kind: 'master', itemId: it.id } })
      break
    }
  }
  return out.slice(0, 5)
}

/** Кой с детето и къде — за матрицата на генерализацията */
export function generalization(sessions: Session[]) {
  const people = Array.from(new Set(sessions.map(s => s.staff_id || ''))).filter(Boolean)
  const places = PLACES.filter(pl => sessions.some(s => (s.place || 'Друго') === pl))
  const cell: Record<string, number> = {}
  for (const s of sessions) { const k = `${s.staff_id}|${s.place || 'Друго'}`; cell[k] = (cell[k] || 0) + 1 }
  return { people, places, cell, max: Math.max(1, ...Object.values(cell)) }
}

export const todaySofia = () => new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Sofia' })
export const fmtDate = (d: string) => d.split('-').reverse().join('.')
