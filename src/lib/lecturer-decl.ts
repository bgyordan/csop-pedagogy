// Декларации за лекторски над норматив — от отметнатите дати до Word файловете.
// Едно и също за колегата („Над норматив“) и за прегледа на управата („Проверка лекторски“),
// за да е прегледът точно това, което колегата ще изтегли.
//  • над норматив — „По Образец 3“, по заповедта „над норматив“;
//  • ИФО — отделен файл „По Образец 1“, по ИФО заповедта;
//  • логопед — „По Образец 1“, „…за допълнителна подкрепа“, колона „Учебен час“, предмет по учебния план.

import { generateLecturerDeclaration } from './docx-substitution'
import { PERIOD_TIMES } from './periods'

export type DeclItem = { iso: string; period: number; subject: string; holderType?: string; holderLabel: string }
export type DeclInput = {
  teacherName: string; position: string; periodLabel: string
  orderOver: string; orderIfo: string
  isSpeech?: boolean; rate?: number
  items: DeclItem[]
  /** „_ПРЕГЛЕД“ към името на файла — при прегледа от управата */
  tagSuffix?: string
}

// „9:15–9:50“ → „09:15 – 09:50“ (като в бланката)
export const hourText = (p: number) => (PERIOD_TIMES[p] || `${p}. час`).split('–').map(x => x.padStart(5, '0')).join(' – ')
export const SPEECH_SUBJECT = 'Рехабилитация на комуникативните нарушения'
const fmt = (d: string) => d.split('-').reverse().join('.')

/** „септември – октомври 2026 (15.09.2026 – 31.10.2026)“ — началото е не по-рано от 15.09 (началото на учебната година) */
export function declPeriodLabel(label: string, from: string, to: string) {
  const y = Number(from.slice(0, 4)), m = Number(from.slice(5, 7))
  const start = m === 9 && from < `${y}-09-15` ? `${y}-09-15` : from
  return `${label} (${fmt(start)} – ${fmt(to)})`
}

/** Тегли една или две декларации; връща колко часа влязоха във всяка */
export async function downloadLecturerDeclarations(d: DeclInput): Promise<{ over: number; ifo: number }> {
  type Row = { iso: string; date: string; group: string; subject: string; hours: number }
  const over: Row[] = [], ifo: Row[] = []
  d.items.forEach(it => {
    const isIfo = it.holderType === 'ifo'
    const speech = !!d.isSpeech && !isIfo
    ;(isIfo ? ifo : over).push({
      iso: it.iso, date: fmt(it.iso), hours: 1,
      group: speech ? hourText(it.period) : it.holderLabel,
      subject: isIfo ? `${it.subject} · ${hourText(it.period)}` : speech && (!it.subject || it.subject === 'Терапия') ? SPEECH_SUBJECT : it.subject,
    })
  })
  const byDate = (a: Row, b: Row) => a.iso.localeCompare(b.iso) || a.subject.localeCompare(b.subject, 'bg')
  const tag = d.tagSuffix || ''
  if (over.length) await generateLecturerDeclaration({
    teacherName: d.teacherName, position: d.position, periodLabel: d.periodLabel, orderRef: d.orderOver,
    rows: over.sort(byDate), totalHours: over.length, rate: d.rate,
    ...(d.isSpeech
      ? { form: 'По Образец 1', groupHeader: 'Учебен час', workNote: ' за допълнителна подкрепа', layout: 'speech' as const, fileTag: `лекторски${tag}` }
      : { fileTag: `лекторски${tag}` }),
  })
  if (ifo.length) await generateLecturerDeclaration({
    teacherName: d.teacherName, position: d.position, periodLabel: d.periodLabel, orderRef: d.orderIfo,
    rows: ifo.sort(byDate), totalHours: ifo.length, rate: d.rate, form: 'По Образец 1', fileTag: `ИФО${tag}`, layout: 'ifo',
  })
  return { over: over.length, ifo: ifo.length }
}
