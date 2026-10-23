// Генератор на заповеди — каталог от шаблони и сглобяване на текста.
// Всеки шаблон описва полетата (какво питаме) и как от тях се получава заповедта:
// правно основание → разпоредителна дума (НАРЕЖДАМ, УТВЪРЖДАВАМ…) → точки → контрол → запознати.
// Текстът е с лека маркировка: **удебелено** и ⟦липсва⟧ (непопълнено поле — в прегледа е жълто, в Word — точки).
// Правните основания са предложения: преди първа употреба на шаблон ги прегледайте; в „Текст“ всичко се редактира.

export const CENTER_NAME = 'Център за специална образователна подкрепа – гр. Варна'
export const CENTER_CITY = 'гр. Варна'
export const ZPUO = 'чл. 259, ал. 1 от Закона за предучилищното и училищното образование'

export type StaffLite = { id: string; name: string; position: string; role: string }
export type StudentLite = { id: string; name: string; className: string }
export type EplrTeam = { class_teacher_id?: string | null; psychologist_id?: string | null; speech_therapist_id?: string | null; rehabilitator_id?: string | null }

export type Ctx = {
  staff: Record<string, StaffLite>
  students: Record<string, StudentLite>
  eplr: Record<string, EplrTeam>
  director: StaffLite | null
  yearName: string
}

export type FieldKind = 'text' | 'textarea' | 'lines' | 'date' | 'number' | 'select' | 'staff' | 'staffs' | 'student' | 'toggle'
export type Field = {
  key: string
  label: string
  kind: FieldKind
  required?: boolean
  hint?: string
  placeholder?: string
  options?: { value: string; label: string }[]
  /** показва полето само при условие */
  when?: (d: Data) => boolean
  half?: boolean
}
export type Data = Record<string, any>

export type OrderBody = {
  basis: string
  verb: string
  points: string[]
  closing: string[]
}

export type Group = 'org' | 'staff' | 'students' | 'control' | 'safety' | 'free'
export const GROUPS: { key: Group; label: string; hint: string }[] = [
  { key: 'org', label: 'Организация', hint: 'комисии, отговорници, утвърждаване' },
  { key: 'staff', label: 'Персонал', hint: 'отпуски, командировки, квалификация' },
  { key: 'students', label: 'Деца и ученици', hint: 'записване, ЕПЛР, мероприятия' },
  { key: 'control', label: 'Контрол и оценяване', hint: 'проверки, ДТВ, атестиране' },
  { key: 'safety', label: 'Безопасност', hint: 'ЗБУТ, инструктажи' },
  { key: 'free', label: 'Свободен текст', hint: 'празна бланка' },
]

export type OrderTemplate = {
  key: string
  group: Group
  title: string
  blurb: string
  icon: string            // име на икона (виж ICONS в клиента)
  tint: number            // цвят на плочката
  /** ключови думи за архивния индекс (номенклатурата за заповеди) */
  indexHint?: RegExp
  /** по подразбиране: кой упражнява контрол */
  control?: 'zdud' | 'zdasd' | 'director' | 'none'
  fields: Field[]
  /** заглавие за Книгата за заповеди („Относно“) */
  subject: (d: Data, c: Ctx) => string
  build: (d: Data, c: Ctx) => { basis: string; verb: string; points: string[]; people: string[] }
  defaults?: (c: Ctx) => Data
}

// ─── помощни ──────────────────────────────────────────────────────────────
export const MISSING = (label: string) => `⟦${label}⟧`
export const has = (v: any) => (Array.isArray(v) ? v.length > 0 : v !== undefined && v !== null && String(v).trim() !== '')
const val = (v: any, label: string) => (has(v) ? String(v).trim() : MISSING(label))
export function dmy(iso?: string | null) {
  if (!iso) return ''
  const [y, m, d] = String(iso).slice(0, 10).split('-')
  return d && m && y ? `${d}.${m}.${y}` : String(iso)
}
const date = (iso: any, label = 'дата') => (has(iso) ? `${dmy(iso)} г.` : MISSING(label))
const ids = (v: any): string[] => (Array.isArray(v) ? v.filter(Boolean) : v ? [v] : [])
/** „**Мария Иванова** – учител“ */
export function who(c: Ctx, id: any, label = 'служител') {
  const s = id ? c.staff[id] : null
  if (!s) return MISSING(label)
  return `**${s.name}**${s.position ? ` – ${s.position}` : ''}`
}
function whoList(c: Ctx, list: any, label = 'служители', numbered = true) {
  const a = ids(list)
  if (!a.length) return MISSING(label)
  return a.map((id, i) => `${numbered ? `${i + 1}. ` : ''}${who(c, id)}`).join('\n')
}
const lines = (v: any) => String(v || '').split('\n').map(x => x.trim()).filter(Boolean)
const periodText = (from: any, to: any) =>
  has(from) && has(to) && from !== to ? `от ${date(from)} до ${date(to)} включително`
    : has(from) ? `на ${date(from)}` : `от ${MISSING('начална дата')} до ${MISSING('крайна дата')}`
const student = (c: Ctx, id: any) => {
  const s = id ? c.students[id] : null
  return s ? `**${s.name}**${s.className ? `, паралелка ${s.className}` : ''}` : MISSING('дете/ученик')
}
const commission = (c: Ctx, chair: any, members: any) =>
  `Председател: ${who(c, chair, 'председател')}\nЧленове:\n${whoList(c, ids(members).filter(x => x !== chair), 'членове')}`

const YES_NO = [{ value: 'yes', label: 'Да' }, { value: 'no', label: 'Не' }]

// ─── каталог ──────────────────────────────────────────────────────────────
export const TEMPLATES: OrderTemplate[] = [
  // ── Организация
  {
    key: 'commission', group: 'org', icon: 'users', tint: 0,
    title: 'Назначаване на комисия',
    blurb: 'Комисия с председател, членове, задачи и срок — инвентаризация, бракуване, прием, изпити…',
    indexHint: /комиси|организац|дейност/i, control: 'director',
    fields: [
      { key: 'purpose', label: 'Комисия за…', kind: 'text', required: true, placeholder: 'инвентаризация на материалните активи' },
      { key: 'chair', label: 'Председател', kind: 'staff', required: true },
      { key: 'members', label: 'Членове', kind: 'staffs', required: true },
      { key: 'tasks', label: 'Задачи на комисията', kind: 'lines', hint: 'по една на ред', placeholder: 'да извърши пълна инвентаризация…\nда състави протокол…' },
      { key: 'deadline', label: 'Срок за протокола', kind: 'date', half: true },
    ],
    subject: d => `Назначаване на комисия за ${d.purpose || '…'}`,
    build: (d, c) => {
      const pts = [`Назначавам комисия за ${val(d.purpose, 'предназначение')} в състав:\n${commission(c, d.chair, d.members)}`]
      const t = lines(d.tasks)
      if (t.length) pts.push(`Комисията да:\n${t.map((x, i) => `${i + 1}) ${x.replace(/[.;]$/, '')}${i === t.length - 1 ? '.' : ';'}`).join('\n')}`)
      pts.push(`Комисията да представи протокол за резултатите от работата си в срок до ${date(d.deadline, 'срок')}.`)
      return { basis: ZPUO, verb: 'НАРЕЖДАМ', points: pts, people: [d.chair, ...ids(d.members)] }
    },
  },
  {
    key: 'responsible', group: 'org', icon: 'badge', tint: 2,
    title: 'Определяне на отговорник',
    blurb: 'Възлагане на задължения на служител — отговорник по направление, координатор, ресурс…',
    indexHint: /организац|дейност|персонал/i, control: 'director',
    fields: [
      { key: 'people', label: 'Служител(и)', kind: 'staffs', required: true },
      { key: 'role', label: 'Определям за…', kind: 'text', required: true, placeholder: 'отговорник по поддържане на сайта на центъра' },
      { key: 'duties', label: 'Задължения', kind: 'lines', hint: 'по едно на ред' },
      { key: 'from', label: 'Считано от', kind: 'date', half: true },
      { key: 'to', label: 'До (по желание)', kind: 'date', half: true },
      { key: 'pay', label: 'Възнаграждение', kind: 'select', options: [
        { value: 'none', label: 'Без допълнително възнаграждение' },
        { value: 'vprz', label: 'Съгласно Вътрешните правила за работната заплата' },
        { value: 'skip', label: 'Не се споменава' },
      ] },
    ],
    defaults: () => ({ pay: 'skip' }),
    subject: d => `Определяне на ${d.role || 'отговорник'}`,
    build: (d, c) => {
      const many = ids(d.people).length > 1
      const span = has(d.from) ? (has(d.to) ? `, за периода от ${date(d.from)} до ${date(d.to)}` : `, считано от ${date(d.from)}`) : ''
      const pts = [many
        ? `Определям за ${val(d.role, 'отговорност')}${span}:\n${whoList(c, d.people)}`
        : `Определям ${who(c, ids(d.people)[0])} за ${val(d.role, 'отговорност')}${span}.`]
      const t = lines(d.duties)
      if (t.length) pts.push(`${many ? 'Определените лица' : 'Определеното лице'} да:\n${t.map((x, i) => `${i + 1}) ${x.replace(/[.;]$/, '')}${i === t.length - 1 ? '.' : ';'}`).join('\n')}`)
      if (d.pay === 'none') pts.push('Възложените задължения се изпълняват в рамките на установеното работно време, без допълнително възнаграждение.')
      if (d.pay === 'vprz') pts.push('За изпълнението на възложените задължения да се изплаща допълнително възнаграждение съгласно Вътрешните правила за работната заплата.')
      return { basis: ZPUO, verb: 'НАРЕЖДАМ', points: pts, people: ids(d.people) }
    },
  },
  {
    key: 'approve', group: 'org', icon: 'stamp', tint: 6,
    title: 'Утвърждаване на документ',
    blurb: 'План, правила, програма, график, правилник — с решение на ПС или без',
    indexHint: /план|правил|утвържд|организац/i, control: 'none',
    fields: [
      { key: 'doc', label: 'Документ', kind: 'text', required: true, placeholder: 'Годишен план за дейността на центъра за учебната 2026/2027 година' },
      { key: 'council', label: 'Приет на Педагогически съвет?', kind: 'select', options: YES_NO },
      { key: 'protocol', label: 'Протокол №', kind: 'text', half: true, when: d => d.council === 'yes' },
      { key: 'protocolDate', label: 'от дата', kind: 'date', half: true, when: d => d.council === 'yes' },
      { key: 'from', label: 'В сила от', kind: 'date', half: true },
      { key: 'publish', label: 'Да се публикува на сайта?', kind: 'select', options: YES_NO, half: true },
      { key: 'responsible', label: 'Отговорник за запознаването', kind: 'staff', hint: 'кой да запознае служителите' },
    ],
    defaults: () => ({ council: 'yes', publish: 'no' }),
    subject: d => `Утвърждаване на ${!d.doc ? 'документ' : /^[А-ЯA-Z][а-яa-z]/.test(d.doc) ? d.doc.charAt(0).toLowerCase() + d.doc.slice(1) : d.doc}`,
    build: (d, c) => {
      const basis = d.council === 'yes'
        ? `${ZPUO} и решение на Педагогическия съвет, отразено в Протокол № ${val(d.protocol, '№')} от ${date(d.protocolDate)}`
        : ZPUO
      const pts = [`${val(d.doc, 'наименование на документа')}${has(d.from) ? `, в сила от ${date(d.from)}` : ''}.`]
      if (has(d.responsible)) pts.push(`${who(c, d.responsible)} да запознае служителите на центъра с утвърдения документ срещу подпис.`)
      else pts.push('Утвърденият документ да се доведе до знанието на служителите на центъра срещу подпис.')
      if (d.publish === 'yes') pts.push('Документът да се публикува на интернет страницата на центъра.')
      return { basis, verb: 'УТВЪРЖДАВАМ', points: pts, people: ids(d.responsible) }
    },
  },

  // ── Персонал
  {
    key: 'leave', group: 'staff', icon: 'sun', tint: 3,
    title: 'Отпуск',
    blurb: 'Платен годишен, допълнителен, по чл. 157 или неплатен — по молба на служителя',
    indexHint: /отпуск|персонал|трудов/i, control: 'none',
    fields: [
      { key: 'person', label: 'Служител', kind: 'staff', required: true },
      { key: 'type', label: 'Вид отпуск', kind: 'select', required: true, options: [
        { value: '155', label: 'Платен годишен — чл. 155, ал. 1 КТ' },
        { value: '156', label: 'Допълнителен платен — чл. 156, ал. 1 КТ' },
        { value: '157', label: 'Платен по чл. 157, ал. 1 КТ (брак, смърт, кръводаряване…)' },
        { value: '160', label: 'Неплатен — чл. 160, ал. 1 КТ' },
      ] },
      { key: 'days', label: 'Работни дни', kind: 'number', required: true, half: true },
      { key: 'year', label: 'За година', kind: 'text', half: true, when: d => d.type === '155' || d.type === '156' },
      { key: 'from', label: 'От', kind: 'date', required: true, half: true },
      { key: 'to', label: 'До', kind: 'date', required: true, half: true },
      { key: 'request', label: 'Молба вх. №', kind: 'text', half: true },
      { key: 'requestDate', label: 'от дата', kind: 'date', half: true },
      { key: 'substitute', label: 'Задълженията му се изпълняват от', kind: 'staff', hint: 'по желание' },
    ],
    defaults: () => ({ type: '155', year: String(new Date().getFullYear()) }),
    subject: (d, c) => `Отпуск на ${c.staff[d.person]?.name || '…'}`,
    build: (d, c) => {
      const art = { '155': 'чл. 155, ал. 1', '156': 'чл. 156, ал. 1', '157': 'чл. 157, ал. 1', '160': 'чл. 160, ал. 1' }[d.type as string] || 'чл. 155, ал. 1'
      const kind = { '155': 'платен годишен отпуск', '156': 'допълнителен платен годишен отпуск', '157': 'платен отпуск', '160': 'неплатен отпуск' }[d.type as string] || 'платен годишен отпуск'
      const req = has(d.request) ? `, във връзка с молба вх. № ${d.request}${has(d.requestDate) ? ` от ${date(d.requestDate)}` : ''}` : ''
      const forYear = (d.type === '155' || d.type === '156') && has(d.year) ? ` за ${d.year} г.` : ''
      const pts = [`На ${who(c, d.person)} да ползва ${val(d.days, 'брой')} работни дни ${kind}${forYear}, ${periodText(d.from, d.to)}.`]
      if (d.type === '160') pts.push('Неплатеният отпуск до 30 работни дни в една календарна година се признава за трудов стаж съгласно чл. 160, ал. 3 от Кодекса на труда.')
      else pts.push('Възнаграждението за времето на отпуска да се изплати съгласно чл. 177 от Кодекса на труда.')
      if (has(d.substitute)) pts.push(`За времето на отпуска задълженията на служителя да се изпълняват от ${who(c, d.substitute)}.`)
      return { basis: `${art} от Кодекса на труда${req}`, verb: 'РАЗРЕШАВАМ', points: pts, people: [d.person, d.substitute].filter(Boolean) }
    },
  },
  {
    key: 'trip', group: 'staff', icon: 'plane', tint: 5,
    title: 'Командировка',
    blurb: 'Командироване в страната — място, задача, срок, транспорт и разходи',
    indexHint: /командиров|персонал/i, control: 'none',
    fields: [
      { key: 'people', label: 'Командировани', kind: 'staffs', required: true },
      { key: 'place', label: 'Населено място', kind: 'text', required: true, half: true, placeholder: 'гр. София' },
      { key: 'host', label: 'Приемаща организация', kind: 'text', half: true, placeholder: 'МОН' },
      { key: 'task', label: 'Задача', kind: 'text', required: true, placeholder: 'участие в работна среща…' },
      { key: 'from', label: 'От', kind: 'date', required: true, half: true },
      { key: 'to', label: 'До', kind: 'date', required: true, half: true },
      { key: 'transport', label: 'Пътуване с', kind: 'select', options: [
        { value: 'public', label: 'обществен транспорт' }, { value: 'own', label: 'личен автомобил' },
        { value: 'service', label: 'служебен автомобил' }, { value: 'host', label: 'транспорт на организатора' },
      ], half: true },
      { key: 'costs', label: 'Разходите са за сметка на', kind: 'select', options: [
        { value: 'center', label: 'центъра' }, { value: 'host', label: 'приемащата организация' }, { value: 'none', label: 'без разходи' },
      ], half: true },
    ],
    defaults: () => ({ transport: 'public', costs: 'center' }),
    subject: (d, c) => `Командировка на ${ids(d.people).map(id => c.staff[id]?.name).filter(Boolean).join(', ') || '…'} до ${d.place || '…'}`,
    build: (d, c) => {
      const many = ids(d.people).length > 1
      const tr = { public: 'обществен транспорт', own: 'личен автомобил', service: 'служебен автомобил', host: 'транспорт, осигурен от организатора' }[d.transport as string] || 'обществен транспорт'
      const pts = [
        many
          ? `Командировам следните служители в ${val(d.place, 'населено място')}${has(d.host) ? ` (${d.host})` : ''} ${periodText(d.from, d.to)} със задача: ${val(d.task, 'задача')}:\n${whoList(c, d.people)}`
          : `Командировам ${who(c, ids(d.people)[0])} в ${val(d.place, 'населено място')}${has(d.host) ? ` (${d.host})` : ''} ${periodText(d.from, d.to)} със задача: ${val(d.task, 'задача')}.`,
        `Пътуването да се осъществи с ${tr}.`,
        d.costs === 'host' ? 'Разходите за командировката са за сметка на приемащата организация.'
          : d.costs === 'none' ? 'Командировката е без разходи за центъра.'
          : 'Пътните, дневните и квартирните пари да се изплатят от бюджета на центъра съгласно Наредбата за командировките в страната.',
        `${many ? 'Командированите да представят' : 'Командированият да представи'} отчет за командировката в 7-дневен срок след завръщането.`,
      ]
      return { basis: 'чл. 121, ал. 1 от Кодекса на труда и Наредбата за командировките в страната', verb: 'НАРЕЖДАМ', points: pts, people: ids(d.people) }
    },
  },
  {
    key: 'training', group: 'staff', icon: 'cap', tint: 1,
    title: 'Участие в квалификация',
    blurb: 'Обучение на педагогически специалисти — организатор, кредити, документ за портфолиото',
    indexHint: /квалифик|обучени|персонал/i, control: 'zdud',
    fields: [
      { key: 'people', label: 'Участници', kind: 'staffs', required: true },
      { key: 'name', label: 'Тема на обучението', kind: 'text', required: true },
      { key: 'org', label: 'Обучаваща организация', kind: 'text', half: true },
      { key: 'form', label: 'Форма', kind: 'select', half: true, options: [
        { value: 'присъствена', label: 'присъствена' }, { value: 'дистанционна', label: 'дистанционна' }, { value: 'смесена', label: 'смесена' },
      ] },
      { key: 'from', label: 'От', kind: 'date', required: true, half: true },
      { key: 'to', label: 'До', kind: 'date', half: true },
      { key: 'hours', label: 'Академични часове', kind: 'number', half: true },
      { key: 'credits', label: 'Квалификационни кредити', kind: 'number', half: true },
      { key: 'funding', label: 'Финансиране', kind: 'select', options: [
        { value: 'center', label: 'от бюджета на центъра' }, { value: 'program', label: 'по национална програма / проект' }, { value: 'own', label: 'лични средства' }, { value: 'free', label: 'безплатно' },
      ] },
    ],
    defaults: () => ({ form: 'присъствена', funding: 'center' }),
    subject: d => `Участие в обучение „${d.name || '…'}“`,
    build: (d, c) => {
      const extra = [has(d.hours) ? `${d.hours} академични часа` : '', has(d.credits) ? `${d.credits} квалификационни кредита` : ''].filter(Boolean).join(', ')
      const fund = { center: 'от бюджета на центъра', program: 'по национална програма / проект', own: 'със собствени средства на участниците', free: '' }[d.funding as string] || ''
      const pts = [
        `Определям следните педагогически специалисти да участват в обучение на тема „${val(d.name, 'тема')}“${has(d.org) ? `, организирано от ${d.org}` : ''}, ${periodText(d.from, d.to)}, в ${d.form || 'присъствена'} форма${extra ? ` (${extra})` : ''}:\n${whoList(c, d.people, 'участници')}`,
      ]
      if (fund) pts.push(`Обучението да се финансира ${fund}.`)
      pts.push('Участниците да представят копие от документа за преминато обучение в 7-дневен срок след приключването му — за вписване в регистъра на квалификацията и в професионалното портфолио.')
      return { basis: `${ZPUO}, чл. 221 от ЗПУО и Наредба № 15 от 22.07.2019 г. за статута и професионалното развитие на учителите, директорите и другите педагогически специалисти`, verb: 'НАРЕЖДАМ', points: pts, people: ids(d.people) }
    },
  },

  // ── Деца и ученици
  {
    key: 'enroll', group: 'students', icon: 'userplus', tint: 1,
    title: 'Записване на ученик',
    blurb: 'Записване в паралелка след насочване — с правното основание и задачите към екипа',
    indexHint: /ученици|деца|записван|движени/i, control: 'zdud',
    fields: [
      { key: 'student', label: 'Дете / ученик', kind: 'student', required: true },
      { key: 'className', label: 'Паралелка / група', kind: 'text', half: true },
      { key: 'from', label: 'Считано от', kind: 'date', required: true, half: true },
      { key: 'ref', label: 'Във връзка с', kind: 'text', placeholder: 'заповед № … на началника на РУО – Варна / заявление на родителя вх. № …' },
      { key: 'classTeacher', label: 'Класен ръководител', kind: 'staff' },
    ],
    subject: (d, c) => `Записване на ${c.students[d.student]?.name || 'ученик'}`,
    build: (d, c) => {
      const cls = d.className || c.students[d.student]?.className
      const pts = [
        `Записвам ${student(c, d.student).replace(/, паралелка .*$/, '')} в ${has(cls) ? `паралелка/група ${cls}` : MISSING('паралелка')}, считано от ${date(d.from)}.`,
        `${has(d.classTeacher) ? who(c, d.classTeacher) : 'Класният ръководител'} да впише детето/ученика в задължителната училищна документация и да уведоми родителя.`,
        'Да се сформира екип за подкрепа за личностно развитие и да се изготви план за подкрепа в нормативно определения срок.',
      ]
      return { basis: `${ZPUO}${has(d.ref) ? `, във връзка с ${d.ref}` : ''}`, verb: 'НАРЕЖДАМ', points: pts, people: ids(d.classTeacher) }
    },
  },
  {
    key: 'eplr', group: 'students', icon: 'heart', tint: 4,
    title: 'Екип за подкрепа (ЕПЛР)',
    blurb: 'Определяне на ЕПЛР за дете — попълва се от екипите в ЕИС',
    indexHint: /ученици|деца|подкреп/i, control: 'zdud',
    fields: [
      { key: 'student', label: 'Дете / ученик', kind: 'student', required: true, hint: 'екипът се попълва от „ЕПЛР екипи“' },
      { key: 'leader', label: 'Ръководител на екипа', kind: 'staff', required: true },
      { key: 'members', label: 'Членове', kind: 'staffs', required: true },
      { key: 'year', label: 'Учебна година', kind: 'text', half: true },
      { key: 'plan', label: 'Срок за плана за подкрепа', kind: 'date', half: true },
    ],
    defaults: c => ({ year: c.yearName }),
    subject: (d, c) => `Определяне на ЕПЛР за ${c.students[d.student]?.name || 'дете'}`,
    build: (d, c) => {
      const pts = [
        `Определям екип за подкрепа за личностно развитие на ${student(c, d.student)}, за учебната ${val(d.year, 'година')} година, в състав:\nРъководител: ${who(c, d.leader, 'ръководител')}\nЧленове:\n${whoList(c, ids(d.members).filter((x: string) => x !== d.leader), 'членове')}`,
        `Екипът да извърши оценка на индивидуалните потребности и да изготви план за подкрепа${has(d.plan) ? ` в срок до ${date(d.plan)}` : ''}.`,
        'Ръководителят на екипа да координира работата му и да осигури участието на родителя.',
      ]
      return { basis: `${ZPUO}, чл. 188 от ЗПУО и Наредбата за приобщаващото образование`, verb: 'НАРЕЖДАМ', points: pts, people: [d.leader, ...ids(d.members)] }
    },
  },
  {
    key: 'event', group: 'students', icon: 'bus', tint: 5,
    title: 'Изнесено мероприятие',
    blurb: 'Посещение, екскурзия, състезание — ръководители, транспорт, инструктаж',
    indexHint: /ученици|деца|мероприят|организац/i, control: 'zdud',
    fields: [
      { key: 'name', label: 'Мероприятие', kind: 'text', required: true, placeholder: 'посещение на Природонаучния музей' },
      { key: 'place', label: 'Място', kind: 'text', required: true },
      { key: 'day', label: 'Дата', kind: 'date', required: true, half: true },
      { key: 'time', label: 'Час', kind: 'text', half: true, placeholder: '09:30 – 12:00' },
      { key: 'group', label: 'Деца / паралелки', kind: 'text', required: true, placeholder: 'паралелки 3а и 4б, 12 ученици' },
      { key: 'leaders', label: 'Ръководители и придружители', kind: 'staffs', required: true },
      { key: 'transport', label: 'Придвижване', kind: 'select', options: [
        { value: 'walk', label: 'пеша' }, { value: 'bus', label: 'училищен автобус' }, { value: 'public', label: 'градски транспорт' }, { value: 'hired', label: 'нает транспорт (лицензиран превозвач)' },
      ] },
    ],
    defaults: () => ({ transport: 'bus' }),
    subject: d => `Провеждане на ${d.name || 'изнесено мероприятие'}`,
    build: (d, c) => {
      const tr = { walk: 'пеша', bus: 'с училищния автобус', public: 'с градски транспорт', hired: 'с нает транспорт от лицензиран превозвач' }[d.transport as string] || ''
      const pts = [
        `Разрешавам провеждането на ${val(d.name, 'мероприятие')} в ${val(d.place, 'място')} на ${date(d.day)}${has(d.time) ? `, ${d.time} ч.` : ''}, с ${val(d.group, 'деца')}.`,
        `Ръководители и придружители:\n${whoList(c, d.leaders, 'ръководители')}`,
        'Ръководителите отговарят за живота и здравето на децата по време на мероприятието.',
        'Преди мероприятието ръководителите да проведат инструктаж на децата и да вземат информирано съгласие от родителите.',
      ]
      if (tr) pts.push(`Придвижването да се осъществи ${tr}.`)
      return { basis: ZPUO, verb: 'НАРЕЖДАМ', points: pts, people: ids(d.leaders) }
    },
  },

  // ── Контрол и оценяване
  {
    key: 'control', group: 'control', icon: 'search', tint: 0,
    title: 'Тематична проверка',
    blurb: 'Контролна дейност — предмет, проверяващ, проверявани, срок за протокола',
    indexHint: /контрол|проверк/i, control: 'none',
    fields: [
      { key: 'subject', label: 'Предмет на проверката', kind: 'text', required: true, placeholder: 'водене на задължителната документация' },
      { key: 'form', label: 'Форма', kind: 'select', options: [
        { value: 'проверка на документация', label: 'проверка на документация' }, { value: 'наблюдение на педагогическа дейност', label: 'наблюдение на педагогическа дейност' },
        { value: 'проверка на място', label: 'проверка на място' }, { value: 'анкета / събеседване', label: 'анкета / събеседване' },
      ], half: true },
      { key: 'planned', label: 'По плана за контролната дейност?', kind: 'select', options: YES_NO, half: true },
      { key: 'inspector', label: 'Проверяващ', kind: 'staff', required: true },
      { key: 'checked', label: 'Проверявани', kind: 'staffs' },
      { key: 'from', label: 'От', kind: 'date', required: true, half: true },
      { key: 'to', label: 'До', kind: 'date', half: true },
      { key: 'report', label: 'Срок за протокола', kind: 'date', half: true },
    ],
    defaults: () => ({ form: 'проверка на документация', planned: 'yes' }),
    subject: d => `Проверка: ${d.subject || '…'}`,
    build: (d, c) => {
      const pts = [
        `Да се извърши ${d.form || 'проверка'} с предмет: ${val(d.subject, 'предмет')}, ${periodText(d.from, d.to)}.`,
        `Проверката да се извърши от ${who(c, d.inspector, 'проверяващ')}.`,
      ]
      if (ids(d.checked).length) pts.push(`Проверявани лица:\n${whoList(c, d.checked)}`)
      pts.push(`Резултатите да се отразят в констативен протокол${has(d.report) ? ` в срок до ${date(d.report)}` : ''}, който да се впише в Книгата за контролната дейност.`)
      const basis = d.planned === 'yes' ? `${ZPUO}, във връзка с Плана за контролната дейност на директора` : ZPUO
      return { basis, verb: 'НАРЕЖДАМ', points: pts, people: [d.inspector, ...ids(d.checked)] }
    },
  },
  {
    key: 'dtv', group: 'control', icon: 'chart', tint: 2,
    title: 'Комисия за оценяване на ДТВ',
    blurb: 'Оценяване на постигнатите резултати по картите за ДТВ — комисия и срокове',
    indexHint: /възнагр|заплат|персонал|комиси/i, control: 'director',
    fields: [
      { key: 'period', label: 'Оценяван период', kind: 'text', required: true, placeholder: 'учебната 2025/2026 година' },
      { key: 'chair', label: 'Председател', kind: 'staff', required: true },
      { key: 'members', label: 'Членове', kind: 'staffs', required: true },
      { key: 'self', label: 'Срок за самооценка', kind: 'date', half: true },
      { key: 'deadline', label: 'Срок за комисията', kind: 'date', half: true },
    ],
    defaults: c => ({ period: c.yearName ? `учебната ${c.yearName} година` : '' }),
    subject: d => `Комисия за оценяване на ДТВ за ${d.period || '…'}`,
    build: (d, c) => ({
      basis: `${ZPUO}, Колективния трудов договор за системата на предучилищното и училищното образование и Вътрешните правила за работната заплата`,
      verb: 'НАРЕЖДАМ',
      points: [
        `Назначавам комисия за оценяване на постигнатите резултати от труда (ДТВ) на служителите за ${val(d.period, 'период')} в състав:\n${commission(c, d.chair, d.members)}`,
        `Служителите да попълнят карта за самооценка по утвърдените критерии${has(d.self) ? ` в срок до ${date(d.self)}` : ''}.`,
        `Комисията да оцени картите и да представи протокол с предложение за размера на възнагражденията${has(d.deadline) ? ` в срок до ${date(d.deadline)}` : ''}.`,
      ],
      people: [d.chair, ...ids(d.members)],
    }),
  },
  {
    key: 'attest', group: 'control', icon: 'award', tint: 6,
    title: 'Атестационна комисия',
    blurb: 'Атестиране на педагогически специалисти — комисия и атестирани',
    indexHint: /атест|персонал|комиси/i, control: 'director',
    fields: [
      { key: 'chair', label: 'Председател', kind: 'staff', required: true },
      { key: 'members', label: 'Членове', kind: 'staffs', required: true },
      { key: 'attested', label: 'Атестирани', kind: 'staffs', required: true },
      { key: 'deadline', label: 'Срок за атестирането', kind: 'date', half: true },
    ],
    subject: () => 'Определяне на атестационна комисия',
    build: (d, c) => ({
      basis: `${ZPUO}, чл. 230 от ЗПУО и Наредба № 15 от 22.07.2019 г. за статута и професионалното развитие на учителите, директорите и другите педагогически специалисти`,
      verb: 'НАРЕЖДАМ',
      points: [
        `Определям атестационна комисия в състав:\n${commission(c, d.chair, d.members)}`,
        `Да бъдат атестирани следните педагогически специалисти:\n${whoList(c, d.attested, 'атестирани')}`,
        `Атестирането да приключи с атестационна карта и подписан протокол${has(d.deadline) ? ` в срок до ${date(d.deadline)}` : ''}.`,
      ],
      people: [d.chair, ...ids(d.members), ...ids(d.attested)],
    }),
  },

  // ── Безопасност
  {
    key: 'safety', group: 'safety', icon: 'shield', tint: 3,
    title: 'Инструктажи по ЗБУТ',
    blurb: 'Длъжностни лица за начален, периодичен и извънреден инструктаж',
    indexHint: /безопас|збут|охран|труд/i, control: 'zdasd',
    fields: [
      { key: 'initial', label: 'Начален инструктаж провежда', kind: 'staff', required: true },
      { key: 'workplace', label: 'Инструктаж на работното място провеждат', kind: 'staffs', required: true },
      { key: 'periodic', label: 'Периодичен инструктаж', kind: 'select', options: [
        { value: '6', label: 'на 6 месеца' }, { value: '12', label: 'веднъж годишно' },
      ], half: true },
      { key: 'kids', label: 'Инструктаж на децата — от класните ръководители', kind: 'select', options: YES_NO, half: true },
    ],
    defaults: () => ({ periodic: '6', kids: 'yes' }),
    subject: () => 'Провеждане на инструктажи по ЗБУТ',
    build: (d, c) => {
      const pts = [
        `Определям ${who(c, d.initial)} за провеждане на начален инструктаж на новопостъпилите служители.`,
        `Инструктаж на работното място, периодичен, извънреден и ежедневен инструктаж да провеждат:\n${whoList(c, d.workplace)}`,
        `Периодичният инструктаж да се провежда ${d.periodic === '12' ? 'веднъж годишно' : 'на 6 месеца'}.`,
        'Инструктажите да се вписват в съответните книги за инструктаж с подпис на инструктиращия и инструктирания.',
      ]
      if (d.kids === 'yes') pts.push('Класните ръководители да провеждат инструктаж на децата и учениците в началото на учебната година и преди всяко изнесено мероприятие, с отразяване в дневника.')
      return {
        basis: `${ZPUO}, чл. 275, ал. 1 от Кодекса на труда и Наредба № РД-07-2 от 16.12.2009 г. за условията и реда за провеждането на периодично обучение и инструктаж на работниците и служителите по правилата за осигуряване на здравословни и безопасни условия на труд`,
        verb: 'НАРЕЖДАМ',
        points: pts,
        people: [d.initial, ...ids(d.workplace)],
      }
    },
  },

  // ── Свободна
  {
    key: 'free', group: 'free', icon: 'pen', tint: 7,
    title: 'Свободна заповед',
    blurb: 'Празна бланка с реквизитите — пишете основанието и точките сами',
    control: 'none',
    fields: [
      { key: 'subject', label: 'Относно (за Книгата)', kind: 'text', required: true },
      { key: 'basis', label: 'На основание', kind: 'textarea', placeholder: ZPUO },
      { key: 'verb', label: 'Разпоредителна дума', kind: 'select', options: ['НАРЕЖДАМ', 'ОПРЕДЕЛЯМ', 'УТВЪРЖДАВАМ', 'РАЗРЕШАВАМ', 'ВЪЗЛАГАМ', 'НАЗНАЧАВАМ', 'ОТМЕНЯМ'].map(x => ({ value: x, label: x })) },
      { key: 'points', label: 'Точки', kind: 'lines', hint: 'всеки ред е отделна точка' },
      { key: 'people', label: 'За запознаване', kind: 'staffs' },
    ],
    defaults: () => ({ verb: 'НАРЕЖДАМ', basis: ZPUO }),
    subject: d => d.subject || 'Заповед',
    build: d => ({
      basis: has(d.basis) ? d.basis : ZPUO,
      verb: d.verb || 'НАРЕЖДАМ',
      points: lines(d.points).length ? lines(d.points) : [MISSING('текст на точката')],
      people: ids(d.people),
    }),
  },
]

export const TEMPLATE_BY_KEY: Record<string, OrderTemplate> = Object.fromEntries(TEMPLATES.map(t => [t.key, t]))

// ─── общи реквизити ───────────────────────────────────────────────────────
export type Common = { control?: string; deliver?: 'all' | 'acc' | 'none' }

/** Пълният текст: шаблонът + контрол + връчване. `people` — за „Запознати“. */
export function compose(t: OrderTemplate, d: Data, c: Ctx): OrderBody & { people: string[] } {
  const b = t.build(d, c)
  const closing: string[] = []
  const ctl = d.__control as string | undefined
  if (ctl === 'director' || (!ctl && t.control === 'director')) closing.push('Контрол по изпълнението на заповедта ще упражнявам лично.')
  else if (ctl && ctl !== 'none' && c.staff[ctl]) closing.push(`Контрол по изпълнението на заповедта възлагам на ${who(c, ctl)}.`)
  const deliver = d.__deliver || 'all'
  if (deliver === 'acc') closing.push('Заповедта да се доведе до знанието на заинтересованите лица срещу подпис и да се предостави на счетоводството за сведение и изпълнение.')
  else if (deliver === 'all') closing.push('Заповедта да се доведе до знанието на заинтересованите лица за сведение и изпълнение срещу подпис.')
  const people = Array.from(new Set([...b.people.filter(Boolean), ...(ctl && ctl !== 'none' && ctl !== 'director' ? [ctl] : [])]))
  const tidy = (x: string) => x.replace(/г\.\./g, 'г.').replace(/(?<!\.)\.\.(?!\.)/g, '.')
  return { basis: tidy(b.basis), verb: b.verb, points: b.points.map(tidy), closing, people }
}

/** Липсващи задължителни полета (за проверката преди вписване) */
export function missingFields(t: OrderTemplate, d: Data): string[] {
  return t.fields.filter(f => f.required && (!f.when || f.when(d)) && !has(d[f.key])).map(f => f.label)
}

/** Номер в Книгата: „045/23.10.2026г.“ (същият формат като „Нова заповед“) */
export function orderNumber(seq: number, iso: string) {
  return `${String(seq).padStart(3, '0')}/${dmy(iso)}г.`
}

/** Разделя текста на парчета за показване: обикновен, удебелен, липсващ */
export type Run = { text: string; bold?: boolean; missing?: boolean }
export function runs(s: string): Run[] {
  const out: Run[] = []
  const re = /\*\*(.+?)\*\*|⟦(.+?)⟧/g
  let last = 0, m: RegExpExecArray | null
  while ((m = re.exec(s))) {
    if (m.index > last) out.push({ text: s.slice(last, m.index) })
    if (m[1] !== undefined) {
      // удебеленото може да съдържа липсващо
      runs(m[1]).forEach(r => out.push({ ...r, bold: true }))
    } else out.push({ text: m[2], missing: true })
    last = re.lastIndex
  }
  if (last < s.length) out.push({ text: s.slice(last) })
  return out
}
export const plain = (s: string) => runs(s).map(r => (r.missing ? '…………' : r.text)).join('')

/** Подсказка за архивен индекс по ключовите думи на шаблона */
export function guessIndex(t: OrderTemplate, items: { item_code: string; name: string }[]) {
  if (!t.indexHint) return ''
  return items.find(i => t.indexHint!.test(i.name))?.item_code || ''
}
