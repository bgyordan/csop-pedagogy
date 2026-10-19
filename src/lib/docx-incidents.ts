// Дневникът на случаите като Word — за печат/архив вместо хартиената книга (хоризонтално, таблица).
import { Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, WidthType, AlignmentType, BorderStyle, PageOrientation, TableLayoutType, VerticalAlign } from 'docx'
import { saveAs } from 'file-saver'
import { KINDS, STATUS, LEVELS, ROLE_LABEL, fmtDate } from './incidents'
import type { Case, Participant, Analysis } from './incidents'

const F = 'Times New Roman'
const t = (text: string, o: any = {}) => new TextRun({ text, font: F, size: 18, ...o })

export async function generateIncidentRegister(d: { yearName: string; periodLabel: string; cases: Case[]; parts: Participant[]; students: Record<string, string>; staff: Record<string, string> }) {
  const B = { style: BorderStyle.SINGLE, size: 4, color: '000000' }
  const CELLS = { top: B, bottom: B, left: B, right: B }
  const COLS = [600, 1300, 1400, 2600, 1700, 4200, 2200, 1400]   // сума 15400 (A4 хоризонтално, полета 720)
  const cell = (i: number, lines: string[], bold = false) => new TableCell({
    borders: CELLS, width: { size: COLS[i], type: WidthType.DXA }, verticalAlign: VerticalAlign.TOP,
    margins: { top: 40, bottom: 40, left: 60, right: 60 },
    children: lines.map(l => new Paragraph({ children: [t(l, bold ? { bold: true } : {})] })),
  })
  const head = new TableRow({ tableHeader: true, children: ['№', 'Дата, час', 'Място', 'Деца (роля)', 'Вид, форма, ниво', 'Какво се случи', 'Предприети действия', 'Статус'].map((h, i) => cell(i, [h], true)) })
  const rows = d.cases.slice().sort((a, b) => a.number - b.number).map(c => {
    const ps = d.parts.filter(p => p.case_id === c.id)
    const lvl = LEVELS[c.kind].find(l => l.n === c.level)?.label || ''
    return new TableRow({ cantSplit: true, children: [
      cell(0, [String(c.number)]),
      cell(1, [fmtDate(c.occurred_on), c.occurred_time ? c.occurred_time.slice(0, 5) : '']),
      cell(2, [c.place || '']),
      cell(3, ps.map(p => `${p.student_id ? d.students[p.student_id] || '—' : p.name} (${ROLE_LABEL[p.role]})`)),
      cell(4, [KINDS[c.kind].short, c.forms.join(', '), lvl].filter(Boolean)),
      cell(5, [c.description, ...(c.antecedents.length ? [`Преди: ${c.antecedents.join(', ')}`] : []), ...(c.consequences.length ? [`След: ${c.consequences.join(', ')}`] : [])]),
      cell(6, [c.actions.join(', '), c.reported_by ? `Констатирал: ${d.staff[c.reported_by] || ''}` : ''].filter(Boolean)),
      cell(7, [STATUS[c.status].label, ...(c.closed_on ? [fmtDate(c.closed_on)] : [])]),
    ] })
  })
  const doc = new Document({ sections: [{
    properties: { page: { size: { orientation: PageOrientation.LANDSCAPE, width: 16838, height: 11906 }, margin: { top: 720, bottom: 720, left: 720, right: 720 } } },
    children: [
      new Paragraph({ alignment: AlignmentType.CENTER, children: [t('Център за специална образователна подкрепа – гр. Варна', { size: 22 })] }),
      new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 120 }, children: [t('ДНЕВНИК НА СЛУЧАИТЕ НА ТОРМОЗ И ИНЦИДЕНТИ С ПОВЕДЕНИЕ', { bold: true, size: 24 })] }),
      new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 200 }, children: [t(`Учебна ${d.yearName} г.${d.periodLabel ? ` · ${d.periodLabel}` : ''} · ${d.cases.length} случая`, { size: 20 })] }),
      new Table({ width: { size: COLS.reduce((a, x) => a + x, 0), type: WidthType.DXA }, columnWidths: COLS, layout: TableLayoutType.FIXED, rows: [head, ...rows] }),
    ],
  }] })
  saveAs(await Packer.toBlob(doc), `Дневник_случаи_${d.yearName.replace('/', '-')}.docx`)
}

// ── Годишен доклад на Координационния съвет до ръководството — сглобява се автоматично от дневника ──
// Числата, динамиката, местата, формите, повторенията и препоръките са от данните; съветът допълва изводите и подписва.
// Имената на децата са съкратени (инициали) — пълните данни остават в дневника.

const REC: Record<string, string> = {
  'преход/смяна на дейност': 'предварително предупреждение и визуален график при смяна на дейност',
  'искане/задача': 'адаптиране на задачите — по-кратки стъпки, избор и планирани почивки',
  'отказ (казано „не“)': 'обучение в приемане на отказ и предлагане на алтернатива',
  'шум/много хора': 'тиха зона и намаляване на сетивното натоварване',
  'чакане': 'структурирани занимания по време на чакане',
  'конфликт за предмет': 'правила за споделяне и редуване, достатъчно материали',
  'провокация от друго дете': 'работа с групата и социални умения',
  'неструктурирано време': 'структурирани дейности в междучасията и свободното време',
  'умора/глад/болка': 'проследяване на физическото състояние и връзка с родителите',
  'нов човек/място': 'предварителна подготовка за нови хора и места',
}
const DAY_NAMES = ['неделя', 'понеделник', 'вторник', 'сряда', 'четвъртък', 'петък', 'събота']
const MONTH_NAMES = ['януари', 'февруари', 'март', 'април', 'май', 'юни', 'юли', 'август', 'септември', 'октомври', 'ноември', 'декември']
const initials = (n: string) => n.split(/\s+/).filter(Boolean).map(w => w[0].toUpperCase() + '.').join(' ')
const pct = (n: number, t: number) => (t ? Math.round((n / t) * 100) : 0)
const top = (xs: string[]) => {
  const m: Record<string, number> = {}
  xs.forEach(x => { m[x] = (m[x] || 0) + 1 })
  return Object.entries(m).sort((a, b) => b[1] - a[1])
}
const listTop = (rows: [string, number][], n = 5) => rows.slice(0, n).map(([k, v]) => `${k} (${v})`).join(', ')

export async function generateIncidentReport(d: {
  yearName: string; periodLabel: string; a: Analysis; cases: Case[]; parts: Participant[]; students: Record<string, string>
  members: { name: string; position: string | null; is_chair: boolean }[]; meetings: number
}) {
  const { a, cases } = d
  const P = (children: TextRun[], o: any = {}) => new Paragraph({ spacing: { after: 80, line: 300 }, children, ...o })
  const T = (text: string, o: any = {}) => new TextRun({ text, font: F, size: 24, ...o })
  const H = (text: string) => new Paragraph({ keepNext: true, spacing: { before: 240, after: 100 }, children: [T(text, { bold: true })] })
  const LI = (text: string) => new Paragraph({ spacing: { after: 60, line: 300 }, indent: { left: 360, hanging: 240 }, children: [T(`– ${text}`)] })

  const bul = cases.filter(c => c.kind === 'bullying'), beh = cases.filter(c => c.kind === 'behavior')
  const lv = (xs: Case[], n: number) => xs.filter(c => c.level === n).length
  const closed = cases.filter(c => c.status === 'closed').length
  const withProtocol = cases.filter(c => c.protocol_id).length
  const signals = cases.filter(c => c.actions.some(x => x.startsWith('сигнал до'))).length

  // кога: ден и най-честият ден×час
  const days = top(cases.map(c => DAY_NAMES[new Date(c.occurred_on + 'T00:00').getDay()]))
  const heatTop = Object.entries(a.heat).sort((x, y) => y[1] - x[1])[0]
  const places = a.places.filter(([k]) => k !== 'не е посочено')

  // имена → инициали
  const nm = (p: Participant) => initials(p.student_id ? d.students[p.student_id] || '' : p.name || '') || '—'
  const ROLE_TXT: Record<string, string> = { victim: 'пострадал', perpetrator: 'извършител', involved: 'с поведението', affected: 'засегнат', witness: 'свидетел' }

  // ── автоматични препоръки ──
  const recs: string[] = []
  if (places.length && a.total >= 3 && pct(places[0][1], a.total) >= 30) recs.push(`Засилен надзор и дежурство в „${places[0][0]}“ — там са ${pct(places[0][1], a.total)}% от случаите.`)
  if (heatTop && heatTop[1] >= 2) {
    const [dd, hh] = heatTop[0].split('|').map(Number)
    recs.push(`Повишено внимание в ${DAY_NAMES[dd]} около ${hh} ч. — най-честото време на случаите (${heatTop[1]}).`)
  }
  top(beh.flatMap(c => c.antecedents)).filter(([k, n]) => n >= 2 && REC[k]).slice(0, 3)
    .forEach(([k, n]) => recs.push(`Преди поведението най-често: „${k}“ (${n}) — ${REC[k]}.`))
  if (beh.length >= 3) recs.push('За децата с повтарящо се поведение — анализ на функцията на поведението (ABC) и индивидуален план за подкрепа на поведението.')
  const many = a.repeat.filter(k => k.total >= 3)
  if (many.length) recs.push(`За ${many.length} ${many.length === 1 ? 'дете' : 'деца'} с 3 и повече случая — оценка на потребностите и план за подкрепа от ЕПЛР.`)
  if (a.pairs.length) recs.push(`Наблюдение и разделяне при дейности на повтарящите се двойки (${a.pairs.length}).`)
  if (lv(bul, 3)) recs.push(`Проследяване на случаите от III ниво (${lv(bul, 3)}) съвместно с ОЗД и родителите.`)
  if (a.stale.length) recs.push(`Да се приключат ${a.stale.length} ${a.stale.length === 1 ? 'случай, отворен' : 'случая, отворени'} повече от 2 седмици.`)
  if (a.total && a.parentsPct < 100) recs.push(`Уведомяване на родителите във всеки случай (сега ${a.parentsPct}%).`)
  recs.push('Продължаване на превантивните дейности по плана на Координационния съвет и запознаване на персонала с Механизма.')

  const B = { style: BorderStyle.SINGLE, size: 4, color: '000000' }
  const CELLS = { top: B, bottom: B, left: B, right: B }
  const MW = [3200, 1900, 1900, 1900]
  const mc = (i: number, s: string, bold = false) => new TableCell({ borders: CELLS, width: { size: MW[i], type: WidthType.DXA }, margins: { top: 40, bottom: 40, left: 80, right: 80 },
    children: [new Paragraph({ alignment: i ? AlignmentType.CENTER : AlignmentType.LEFT, children: [T(s, { bold, size: 22 })] })] })
  const monthTable = new Table({
    width: { size: MW.reduce((x, y) => x + y, 0), type: WidthType.DXA }, columnWidths: MW, layout: TableLayoutType.FIXED,
    rows: [
      new TableRow({ tableHeader: true, children: ['Месец', 'Тормоз', 'Поведение', 'Общо'].map((h, i) => mc(i, h, true)) }),
      ...a.months.map(m => new TableRow({ children: [mc(0, `${MONTH_NAMES[Number(m.key.slice(5, 7)) - 1]} ${m.key.slice(0, 4)}`), mc(1, String(m.bullying)), mc(2, String(m.behavior)), mc(3, String(m.bullying + m.behavior))] })),
      new TableRow({ children: [mc(0, 'Общо', true), mc(1, String(a.bullying), true), mc(2, String(a.behavior), true), mc(3, String(a.total), true)] }),
    ],
  })

  const chair = d.members.find(m => m.is_chair)
  const others = d.members.filter(m => !m.is_chair)
  const dots = '…'.repeat(37)
  const period = `учебната ${d.yearName} година${d.periodLabel ? ` (${d.periodLabel})` : ''}`

  const children: (Paragraph | Table)[] = [
    new Paragraph({ alignment: AlignmentType.CENTER, children: [T('ЦЕНТЪР ЗА СПЕЦИАЛНА ОБРАЗОВАТЕЛНА ПОДКРЕПА – ГР. ВАРНА', { bold: true })] }),
    new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 360 }, border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: '000000', space: 4 } }, children: [T('гр. Варна, ул. „Петко Стайнов“ № 7', { size: 20 })] }),
    new Paragraph({ children: [T('ДО', { bold: true })] }),
    new Paragraph({ children: [T('ДИРЕКТОРА НА ЦСОП – ВАРНА', { bold: true })] }),
    new Paragraph({ spacing: { after: 360 }, children: [T('Вх. № ……………… / ………………')] }),
    new Paragraph({ alignment: AlignmentType.CENTER, children: [T('Д О К Л А Д', { bold: true, size: 28 })] }),
    new Paragraph({ alignment: AlignmentType.CENTER, children: [T('от Координационния съвет за противодействие на тормоза и насилието')] }),
    new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 300 }, children: [T(`за ${period}`)] }),
    P([T('Уважаема госпожо Директор,')]),
    P([T(`В изпълнение на Механизма за противодействие на тормоза и насилието в институциите в системата на предучилищното и училищното образование Координационният съвет представя анализ на случаите, вписани в Дневника на случаите на тормоз и инциденти с поведение за ${period}, и препоръки за по-сигурна среда.`)], { alignment: AlignmentType.JUSTIFIED, indent: { firstLine: 567 } }),

    H('1. Обобщени данни'),
    LI(`Вписани случаи: ${a.total}.`),
    LI(`Тормоз и насилие: ${a.bullying}${a.bullying ? ` (II ниво – ${lv(bul, 2)}, III ниво – ${lv(bul, 3)}${lv(bul, 1) ? `, I ниво – ${lv(bul, 1)}` : ''})` : ''}.`),
    LI(`Инциденти с поведение: ${a.behavior}${a.behavior ? ` (леки – ${lv(beh, 1)}, средни – ${lv(beh, 2)}, тежки – ${lv(beh, 3)})` : ''}.`),
    LI(`Приключени: ${closed}; неприключени: ${a.open}${a.stale.length ? `, от тях отворени над 2 седмици – ${a.stale.length}` : ''}.`),
    ...(a.avgClose !== null ? [LI(`Средно време до приключване: ${a.avgClose} ${a.avgClose === 1 ? 'ден' : 'дни'}.`)] : []),
    LI(`Уведомени родители: в ${a.parentsPct}% от случаите.`),
    LI(`Разгледани на заседание на Координационния съвет (с протокол): ${withProtocol}; проведени заседания през годината: ${d.meetings}.`),
    LI(`Подадени сигнали до ОЗД/полиция: ${signals}.`),

    H('2. Динамика по месеци'),
    monthTable,

    H('3. Къде и кога'),
    LI(places.length ? `Най-чести места: ${listTop(places, 4)}.` : 'Мястото не е посочено.'),
    ...(days.length ? [LI(`По дни от седмицата: ${listTop(days as [string, number][], 5)}.`)] : []),
    ...(heatTop ? [LI(`Най-често време: ${DAY_NAMES[Number(heatTop[0].split('|')[0])]} около ${heatTop[0].split('|')[1]} ч. (${heatTop[1]}).`)] : []),

    H('4. Форми на тормоза и видове поведение'),
    LI(bul.length ? `Форми на тормоза: ${listTop(top(bul.flatMap(c => c.forms)), 6) || 'не са посочени'}.` : 'Няма вписани случаи на тормоз.'),
    LI(beh.length ? `Видове поведение: ${listTop(top(beh.flatMap(c => c.forms)), 6) || 'не са посочени'}.` : 'Няма вписани инциденти с поведение.'),

    ...(beh.length ? [
      H('5. Какво предшества поведението и как се реагира'),
      LI(`Предшестващи обстоятелства: ${listTop(top(beh.flatMap(c => c.antecedents)), 6) || 'не са посочени'}.`),
      LI(`Реакции след поведението: ${listTop(top(beh.flatMap(c => c.consequences)), 6) || 'не са посочени'}.`),
    ] : []),

    H(`${beh.length ? 6 : 5}. Деца с повторни случаи`),
    ...(a.repeat.length ? [
      P([T(`Деца с два и повече случая: ${a.repeat.length}${many.length ? `, от тях с 3 и повече – ${many.length}` : ''}. Имената са съкратени; пълните данни са в Дневника на случаите.`)]),
      ...a.repeat.slice(0, 15).map(k => LI(`${initials(k.name)} – ${k.total} ${k.total === 1 ? 'случай' : 'случая'} (${Object.entries(k.roles).map(([r, n]) => `${ROLE_TXT[r] || r} ${n}`).join(', ')})`)),
      ...(a.pairs.length ? [P([T(`Повтарящи се двойки извършител → пострадал: ${a.pairs.map(p => `${initials(p.a)} → ${initials(p.b)} (${p.n})`).join('; ')}.`)])] : []),
    ] : [P([T('Няма деца с повторни случаи.')])]),

    H(`${beh.length ? 7 : 6}. Изводи и препоръки`),
    ...recs.map(r => LI(r)),
    P([T('Допълнителни изводи на Координационния съвет:', { italics: true })], { spacing: { before: 160, after: 80 } }),
    ...[1, 2, 3, 4].map(() => P([T(dots)])),

    new Paragraph({ spacing: { before: 360 }, children: [T('Дата: ………………')] }),
    new Paragraph({ spacing: { before: 240 }, children: [T('Председател на Координационния съвет: ………………………')] }),
    new Paragraph({ indent: { left: 4800 }, spacing: { after: 200 }, children: [T(`/ ${chair?.name || '……………………………'} /`)] }),
    new Paragraph({ children: [T('Членове:')] }),
    ...(others.length ? others : [{ name: '', position: null, is_chair: false }, { name: '', position: null, is_chair: false }])
      .map((m, i) => new Paragraph({ spacing: { before: 120 }, children: [T(`${i + 1}. ${m.name || '……………………………'}${m.position ? `, ${m.position}` : ''}  ………………………`)] })),
  ]

  const doc = new Document({ sections: [{
    properties: { page: { margin: { top: 1134, bottom: 1134, left: 1418, right: 1134 } } },
    children,
  }] })
  saveAs(await Packer.toBlob(doc), `Доклад_Координационен_съвет_${d.yearName.replace('/', '-')}.docx`)
}
