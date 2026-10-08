// „Двигателна оценка“ като Word: условия, резултати (входящ → повторен → извод), профил по области, цели.

import { Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, WidthType, AlignmentType, ShadingType, PageOrientation } from 'docx'
import { saveAs } from 'file-saver'
import { DOMAINS, ITEMS, STAGES, DETAIL, CONDITIONS, CODES, SUPPORT, GAS_LABEL, itemOf, resultText, compare, fmtD } from '@/lib/motor'
import type { MotorSession, MotorResult, MotorGoal } from '@/lib/motor'

const F = 'Times New Roman'
const t = (text: string, o: Record<string, unknown> = {}) => new TextRun({ text, font: F, size: 21, color: '000000', ...o })
const p = (text: string, o: Record<string, unknown> = {}, after = 80) => new Paragraph({ spacing: { after }, children: [t(text, o)] })
const cell = (text: string, o: { bold?: boolean; fill?: string; w?: number; span?: number } = {}) => new TableCell({
  width: o.w ? { size: o.w, type: WidthType.PERCENTAGE } : undefined,
  columnSpan: o.span,
  shading: o.fill ? { type: ShadingType.CLEAR, color: 'auto', fill: o.fill } : undefined,
  children: [new Paragraph({ children: [t(text, { bold: o.bold, size: 19 })] })],
})
const SCALE_NOTE = 'Скала: 0 – не изпълнява след проверено разбиране; 1 – с пълна физическа помощ; 2 – с частична физическа помощ; 3 – без физическа помощ, но непълно/неточно/нестабилно; 4 – без физическа помощ по критерия. '
  + `Кодове (не са 0): ${Object.entries(CODES).map(([k, l]) => `${k} – ${l}`).join('; ')}. Подкрепа за инструкцията: ${SUPPORT.map(s => `${s.k} – ${s.label}`).join('; ')}.`

export async function exportMotor(o: {
  studentName: string; className: string; sessions: MotorSession[]; A: MotorSession; B: MotorSession
  results: MotorResult[]; goals: MotorGoal[]; names: Record<string, string>
}) {
  const { A, B, sessions } = o
  const byS: Record<string, Record<number, MotorResult>> = {}
  o.results.forEach(r => { (byS[r.session_id] ||= {})[r.item] = r })
  const lastUpTo = (s: MotorSession, no: number) => {
    for (let i = sessions.indexOf(s); i >= 0; i--) { const r = byS[sessions[i].id]?.[no]; if (r) return r }
    return undefined
  }
  const same = A.id === B.id
  const used = ITEMS.filter(it => sessions.slice(sessions.indexOf(A), sessions.indexOf(B) + 1).some(s => byS[s.id]?.[it.no]))
  const who = (s: MotorSession) => s.assessor_id && o.names[s.assessor_id] ? `, ${o.names[s.assessor_id]}` : ''

  const kids: (Paragraph | Table)[] = [
    new Paragraph({ alignment: AlignmentType.CENTER, children: [t('ДВИГАТЕЛНА ОЦЕНКА — ФИЗИЧЕСКО ВЪЗПИТАНИЕ И СПОРТ', { bold: true, size: 26 })] }),
    new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 200 }, children: [t(`${o.studentName}${o.className ? ', ' + o.className : ''}`, { bold: true, size: 24 })] }),
    p(same ? `Оценка: ${fmtD(B.assessed_on)} (${STAGES[B.stage]}, ${DETAIL[B.detail].toLowerCase()}${who(B)})`
      : `Сравнение: ${fmtD(A.assessed_on)} (${STAGES[A.stage]}${who(A)}) → ${fmtD(B.assessed_on)} (${STAGES[B.stage]}${who(B)})`),
  ]
  const cond = CONDITIONS.filter(c => B.conditions?.[c.k])
  if (cond.length) cond.forEach(c => kids.push(p(`${c.label}: ${B.conditions[c.k]}`)))
  kids.push(p(SCALE_NOTE, { italics: true, size: 18 }, 200))

  const head = new TableRow({ tableHeader: true, children: same
    ? [cell('Проба', { bold: true, fill: 'E2E8F0', w: 34 }), cell('Резултат и подкрепа', { bold: true, fill: 'E2E8F0', w: 33 }), cell('Наблюдение', { bold: true, fill: 'E2E8F0', w: 33 })]
    : [cell('Проба', { bold: true, fill: 'E2E8F0', w: 28 }), cell('Входящ резултат и помощ', { bold: true, fill: 'E2E8F0', w: 24 }), cell('Повторен резултат и помощ', { bold: true, fill: 'E2E8F0', w: 24 }), cell('Извод', { bold: true, fill: 'E2E8F0', w: 24 })] })
  const rows: TableRow[] = [head]
  DOMAINS.forEach(d => {
    const its = used.filter(i => i.domain === d.key)
    if (!its.length) return
    rows.push(new TableRow({ children: [cell(d.label, { bold: true, fill: 'F1F5F9', span: same ? 3 : 4 })] }))
    its.forEach(it => {
      const a = lastUpTo(A, it.no), b = lastUpTo(B, it.no)
      const q = (r: MotorResult | undefined) => r?.quality?.length && it.quality ? `; качество ${r.quality.length}/${it.quality.length}` : ''
      if (same) rows.push(new TableRow({ children: [cell(`${it.no}. ${it.name}`), cell(b ? resultText(it, b) + q(b) : '—'), cell(b?.note || '')] }))
      else {
        const v = compare(it, a, b)
        const verdict = v.dir === 1 ? `↑ напредък (${v.why})` : v.dir === -1 ? `↓ регрес (${v.why})` : v.dir === 0 ? 'без промяна' : '—'
        rows.push(new TableRow({ children: [cell(`${it.no}. ${it.name}`), cell(a ? resultText(it, a) + q(a) : '—'), cell(b ? resultText(it, b) + q(b) : '—'), cell(verdict)] }))
      }
    })
  })
  kids.push(new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows }))

  if (B.observations) { kids.push(p('Наблюдения за разбиране, болка, умора, мотивация и адаптации', { bold: true }, 60)); kids.push(p(B.observations, {}, 200)) }

  const prof = DOMAINS.filter(d => B.profile?.[d.key]?.strengths || B.profile?.[d.key]?.priority)
  if (prof.length) {
    kids.push(new Paragraph({ spacing: { before: 200, after: 80 }, children: [t('Профил и приоритети за работа', { bold: true })] }))
    kids.push(new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows: [
      new TableRow({ tableHeader: true, children: [cell('Област', { bold: true, fill: 'E2E8F0', w: 25 }), cell('Силни страни и затруднения', { bold: true, fill: 'E2E8F0', w: 45 }), cell('Приоритет за работа', { bold: true, fill: 'E2E8F0', w: 30 })] }),
      ...prof.map(d => new TableRow({ children: [cell(d.label), cell(B.profile[d.key]?.strengths || ''), cell(B.profile[d.key]?.priority || '')] })),
    ] }))
  }

  if (o.goals.length) {
    kids.push(new Paragraph({ spacing: { before: 200, after: 80 }, children: [t('Индивидуални цели', { bold: true })] }))
    o.goals.forEach((g, i) => {
      const it = g.item ? itemOf(g.item) : undefined
      const meta = [it ? `проба ${it.no}. ${it.name}` : '', g.due ? `срок ${fmtD(g.due)}` : '', g.gas !== null && g.gas !== undefined ? `GAS ${g.gas > 0 ? '+' : ''}${g.gas} (${GAS_LABEL[g.gas]})` : '', g.achieved_at ? 'постигната' : ''].filter(Boolean).join('; ')
      kids.push(p(`Цел ${i + 1}. ${g.goal}${meta ? ` — ${meta}` : ''}`))
    })
  }
  kids.push(p('Учителят описва функцията; медицинският специалист оценява клиничния проблем. Картата е работна педагогическа, а не стандартизиран тест — без възрастови норми и общ бал.', { italics: true, size: 18 }, 0))

  const doc = new Document({ sections: [{ properties: { page: { margin: { top: 850, bottom: 850, left: 1000, right: 1000 } } }, children: kids }] })
  const blob = await Packer.toBlob(doc)
  saveAs(blob, `Двигателна оценка - ${o.studentName}.docx`)
}

/** Групова карта (попълнена или празна) — проби по редове, деца по колони */
export async function exportGroupCard(o: {
  title: string; date: string; assessor: string; items: number[]; kids: { id: string; name: string }[]
  cells: Record<string, Record<number, string>>
}) {
  const kidsChunks: { id: string; name: string }[][] = []
  for (let i = 0; i < Math.max(o.kids.length, 1); i += 6) kidsChunks.push(o.kids.slice(i, i + 6))
  const children: (Paragraph | Table)[] = []
  kidsChunks.forEach((ch, ci) => {
    children.push(new Paragraph({ alignment: AlignmentType.CENTER, pageBreakBefore: ci > 0, spacing: { after: 80 }, children: [t('ГРУПОВА КАРТА — ДВИГАТЕЛНА ОЦЕНКА', { bold: true, size: 24 })] }))
    children.push(p(`${o.title}   Дата: ${o.date ? fmtD(o.date) : '__________'}   Оценяващ: ${o.assessor || '______________________'}`))
    children.push(p('В клетките: оценка 0–4 или код, резултат и помощ, например „4 · 4/5 усп. · М“ или „8 сек без опора“. Еднакви условия за всички деца.', { italics: true, size: 18 }, 120))
    const rows: TableRow[] = [new TableRow({ tableHeader: true, children: [cell('Проба', { bold: true, fill: 'E2E8F0', w: 28 }), ...ch.map(k => cell(k.name, { bold: true, fill: 'E2E8F0', w: Math.floor(72 / ch.length) }))] })]
    DOMAINS.forEach(d => {
      const its = o.items.filter(no => itemOf(no)?.domain === d.key)
      if (!its.length) return
      rows.push(new TableRow({ children: [cell(d.label, { bold: true, fill: 'F1F5F9', span: ch.length + 1 })] }))
      its.forEach(no => rows.push(new TableRow({ children: [cell(`${no} ${itemOf(no)!.name}`), ...ch.map(k => cell(o.cells[k.id]?.[no] || ''))] })))
    })
    children.push(new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows }))
  })
  const doc = new Document({ sections: [{ properties: { page: { size: { orientation: PageOrientation.LANDSCAPE }, margin: { top: 700, bottom: 700, left: 700, right: 700 } } }, children }] })
  const blob = await Packer.toBlob(doc)
  saveAs(blob, `Групова карта - ${o.title}.docx`)
}
