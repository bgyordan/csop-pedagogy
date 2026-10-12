// Членове от КТ за отсъствие на титуляря + части от периода с различен член (substitution_kt_parts)

export const KT_ARTICLES: { v: string; l: string }[] = [
  { v: '155', l: 'чл. 155 и чл. 156 – платен годишен отпуск' },
  { v: '157', l: 'чл. 157 – отпуск при събития (брак, кръводаряване и др.)' },
  { v: '159', l: 'чл. 159 – отпуск за обучение' },
  { v: '160', l: 'чл. 160 – неплатен отпуск' },
  { v: '162', l: 'чл. 162 – отпуск при временна неработоспособност (болничен)' },
  { v: '168', l: 'чл. 168 – допълнителен отпуск за отглеждане на дете' },
  { v: '169', l: 'чл. 169 – отпуск при осиновяване' },
  { v: '170', l: 'чл. 170 – отпуск за изпълнение на граждански/обществени задължения' },
  { v: '176', l: 'чл. 176 – отпуск по други причини' },
]

/** Членовете, при които заместването се финансира по НП „Без свободен час“ (при чл. 162 — първите 2 работни дни) */
export const NP_KT = new Set(['155', '157', '159', '161', '162', '168', '169', '170'])

export type KtPart = { from: string; to: string; kt: string }

/** Членът за дадения ден: частта, в която попада, иначе основният */
export function ktOn(parts: KtPart[] | undefined, base: string | null | undefined, iso: string): string {
  const p = (parts || []).find(x => iso >= x.from && iso <= x.to)
  return p?.kt || base || ''
}

/** „чл. 155 и чл. 160“ — всички членове на отсъствието, в реда на първата им поява */
export function ktLabel(base: string | null | undefined, parts: KtPart[] | undefined) {
  const all = Array.from(new Set([base || '', ...(parts || []).sort((a, b) => a.from.localeCompare(b.from)).map(p => p.kt)].filter(Boolean)))
  return all.map(k => `чл. ${k}`).join(' и ')
}
