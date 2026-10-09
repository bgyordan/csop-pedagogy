// Заявление за отпуск по НП „Без свободен час“ (Приложение № 1) — помощни данни без docx (за клиентските форми)

/** Вид отпуск по член от КТ — за „Желая да ползвам … отпуск“ */
export const NP_LEAVE_KIND: Record<string, string> = {
  '155': 'платен годишен', '157': 'платен (по чл. 157 от КТ)', '159': 'платен (по чл. 159 от КТ)', '160': 'неплатен',
  '161': 'платен (по чл. 161 от КТ)', '162': 'платен (по чл. 162 от КТ)', '168': 'платен (по чл. 168 от КТ)',
  '169': 'платен (по чл. 169 от КТ)', '170': 'платен (по чл. 170 от КТ)', '176': 'платен (по чл. 176 от КТ)',
}
/** Работни дни (пон–пет) между две дати включително и първият работен ден след края — за заявлението */
export function leaveDaysInfo(from: string, to: string): { days: number; backOn: string } {
  if (!from || !to || to < from) return { days: 0, backOn: '' }
  const iso = (x: Date) => x.toISOString().slice(0, 10)
  let days = 0
  for (let x = new Date(from + 'T12:00:00Z'); iso(x) <= to; x.setUTCDate(x.getUTCDate() + 1)) {
    const w = x.getUTCDay(); if (w !== 0 && w !== 6) days++
  }
  const b = new Date(to + 'T12:00:00Z'); b.setUTCDate(b.getUTCDate() + 1)
  while (b.getUTCDay() === 0 || b.getUTCDay() === 6) b.setUTCDate(b.getUTCDate() + 1)
  return { days, backOn: iso(b) }
}
