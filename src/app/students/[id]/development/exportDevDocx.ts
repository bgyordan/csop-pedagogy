// „Оценка на развитието“ като Word — за ЕПЛР папката: области, умения, начало → сега, цели, обобщения.

import { Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, WidthType, AlignmentType, ShadingType } from 'docx'
import { saveAs } from 'file-saver'
import { AREAS, SCALE, KINDS, fmtD, profileUpTo, areaPct } from './lib'
import type { Skill, Assessment, Score, Target } from './lib'

const F = 'Times New Roman'
const t = (text: string, o: Record<string, unknown> = {}) => new TextRun({ text, font: F, size: 22, color: '000000', ...o })
const cell = (text: string, o: { bold?: boolean; fill?: string; w?: number; center?: boolean } = {}) => new TableCell({
  width: o.w ? { size: o.w, type: WidthType.PERCENTAGE } : undefined,
  shading: o.fill ? { type: ShadingType.CLEAR, color: 'auto', fill: o.fill } : undefined,
  children: [new Paragraph({ alignment: o.center ? AlignmentType.CENTER : AlignmentType.LEFT, children: [t(text, { bold: o.bold })] })],
})

export async function exportDevelopment(o: {
  studentName: string; className: string; skills: Skill[]; assessments: Assessment[]; scores: Score[]; targets: Target[]
  staffNames: Record<string, string>; fromIdx: number; toIdx: number
}) {
  const { skills, assessments, scores, targets, fromIdx, toIdx } = o
  const A = assessments[fromIdx], B = assessments[toIdx]
  const pa = profileUpTo(assessments, scores, fromIdx), pb = profileUpTo(assessments, scores, toIdx)
  const same = fromIdx === toIdx
  const lvl = (v: number | undefined) => v === undefined ? '—' : `${v} – ${SCALE[v].label}`
  const kids: (Paragraph | Table)[] = [
    new Paragraph({ alignment: AlignmentType.CENTER, children: [t('ОЦЕНКА НА РАЗВИТИЕТО', { bold: true, size: 28 })] }),
    new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 240 }, children: [t(`${o.studentName}${o.className ? ', ' + o.className : ''}`, { bold: true, size: 24 })] }),
    new Paragraph({ children: [t(same ? `Оценка: ${fmtD(B.assessed_on)} (${KINDS[B.kind] || ''})` : `Сравнение: ${fmtD(A.assessed_on)} (${KINDS[A.kind] || ''}) → ${fmtD(B.assessed_on)} (${KINDS[B.kind] || ''})`)] }),
    new Paragraph({ spacing: { after: 200 }, children: [t('Скала: 0 – не се проявява; 1 – с пълна помощ; 2 – с частична помощ/подкана; 3 – самостоятелно; 4 – устойчиво, в различни ситуации.', { italics: true, size: 20 })] }),
  ]
  // Обобщена таблица по области
  kids.push(new Paragraph({ spacing: { before: 120, after: 80 }, children: [t('Профил по области', { bold: true })] }))
  kids.push(new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      new TableRow({ children: [cell('Област', { bold: true, fill: 'E7EDF5', w: 55 }), ...(same ? [] : [cell('Начало', { bold: true, fill: 'E7EDF5', center: true })]), cell(same ? 'Резултат' : 'Сега', { bold: true, fill: 'E7EDF5', center: true }), ...(same ? [] : [cell('Промяна', { bold: true, fill: 'E7EDF5', center: true })])] }),
      ...AREAS.map(a => {
        const x = areaPct(pa, skills, a.key), y = areaPct(pb, skills, a.key)
        const d = x !== null && y !== null ? y - x : null
        return new TableRow({ children: [cell(a.label), ...(same ? [] : [cell(x === null ? '—' : `${x}%`, { center: true })]), cell(y === null ? '—' : `${y}%`, { center: true }), ...(same ? [] : [cell(d === null ? '—' : `${d > 0 ? '+' : ''}${d}`, { center: true })])] })
      }),
    ],
  }))
  // По области — умения
  for (const a of AREAS) {
    const rows = skills.filter(s => s.area === a.key && (pa[s.id] !== undefined || pb[s.id] !== undefined))
    const note = B.notes?.[a.key] || (!same ? A.notes?.[a.key] : '')
    if (!rows.length && !note) continue
    kids.push(new Paragraph({ spacing: { before: 280, after: 80 }, children: [t(a.label, { bold: true, size: 24 })] }))
    if (rows.length) kids.push(new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      rows: [
        new TableRow({ children: [cell('Умение', { bold: true, fill: 'F1F5F9', w: 50 }), ...(same ? [] : [cell('Начало', { bold: true, fill: 'F1F5F9' })]), cell(same ? 'Ниво' : 'Сега', { bold: true, fill: 'F1F5F9' })] }),
        ...rows.map(s => new TableRow({ children: [cell((targets.some(tg => tg.skill_id === s.id) ? '★ ' : '') + s.label), ...(same ? [] : [cell(lvl(pa[s.id]))]), cell(lvl(pb[s.id]))] })),
      ],
    }))
    if (note) kids.push(new Paragraph({ spacing: { before: 80 }, children: [t('Обобщение: ', { bold: true }), t(note)] }))
  }
  if (targets.length) {
    kids.push(new Paragraph({ spacing: { before: 280, after: 80 }, children: [t('Цели', { bold: true, size: 24 })] }))
    targets.forEach(tg => {
      const s = skills.find(x => x.id === tg.skill_id); if (!s) return
      const v = pb[s.id]
      kids.push(new Paragraph({ bullet: { level: 0 }, children: [t(`${s.label} (${AREAS.find(a => a.key === s.area)?.label}) — ${v !== undefined && v >= 3 ? 'постигната' : `текущо ниво: ${lvl(v)}`}`)] }))
    })
  }
  const by = Array.from(new Set(assessments.slice(fromIdx, toIdx + 1).map(a => o.staffNames[a.assessor_id || '']).filter(Boolean)))
  if (by.length) kids.push(new Paragraph({ spacing: { before: 360 }, children: [t('Оценили: ' + by.join(', '))] }))

  const doc = new Document({ sections: [{ properties: { page: { margin: { top: 1134, bottom: 1134, left: 1134, right: 1134 } } }, children: kids }] })
  saveAs(await Packer.toBlob(doc), `Развитие_${o.studentName.replace(/\s+/g, '_')}_${B.assessed_on}.docx`)
}
