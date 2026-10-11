// Пиктограми (Twemoji, CC-BY 4.0) — public/pictos/<key>.svg, списък в public/pictos/catalog.json.
// Генерират се от scripts/materials/pictos.py.

export const pictoUrl = (key: string) => `/pictos/${key}.svg`

export type PictoItem = { key: string; label: string; cat: string }
export type PictoCatalog = { license: string; categories: Record<string, string>; items: PictoItem[] }

// Предмет от разписанието → пиктограма (по ключови думи; първото съвпадение печели)
const SUBJECT_RULES: [RegExp, string][] = [
  [/логопед|комуникатив|речев|говор/, 'speech'],
  [/психолог|емоционал|социал/, 'psychologist'],
  [/кинези|рехабилит|двигател|моторн/, 'therapy_move'],
  [/ерготерап|сензор/, 'puzzle'],
  [/физическо|фвс|спорт|физкулт/, 'sport'],
  [/математ/, 'math'],
  [/български|бел\b|четене|писане|литератур|ограмот/, 'letters'],
  [/английск|чужд|немск|руск|френск/, 'talk'],
  [/музик|пеене/, 'music'],
  [/изобраз|рисуван|изкуств/, 'paint'],
  [/технолог|предприемач|трудов|бит\b|домашен/, 'scissors'],
  [/компют|информ|дигитал/, 'computer'],
  [/околен|природ|човекът|история|географ|наук|биолог|физика|химия/, 'science'],
  [/час на класа|класа\b/, 'class'],
  [/религ/, 'book'],
  [/занимани|интерес|игр/, 'play'],
  [/ресурс|корекц|индивидуал/, 'pencil'],
]

export function subjectPicto(name: string): string {
  const n = (name || '').toLowerCase()
  for (const [re, key] of SUBJECT_RULES) if (re.test(n)) return key
  return 'school'
}
