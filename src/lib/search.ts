// Търсене, което прощава забравена латиница:
//  • „bdfy“ (написано на латинската клавиатура, но мислено като БДС) → „иван“
//  • „ivan“ (фонетична клавиатура или транслитерация) → „иван“
// Всеки вариант се пробва — намира се, ако който и да е съвпада.

// Фонетична подредба (Bulgarian Phonetic / Traditional) — клавиш → буква
const PHONETIC: Record<string, string> = {
  q: 'я', w: 'в', e: 'е', r: 'р', t: 'т', y: 'ъ', u: 'у', i: 'и', o: 'о', p: 'п', '[': 'ш', ']': 'щ',
  a: 'а', s: 'с', d: 'д', f: 'ф', g: 'г', h: 'х', j: 'й', k: 'к', l: 'л', ';': ';', "'": "'",
  z: 'з', x: 'ь', c: 'ц', v: 'ж', b: 'б', n: 'н', m: 'м', '`': 'ч', '\\': 'ю',
}
// БДС (стандартната българска подредба в Windows) — клавиш → буква
const BDS: Record<string, string> = {
  q: ',', w: 'у', e: 'е', r: 'и', t: 'ш', y: 'щ', u: 'к', i: 'с', o: 'д', p: 'з', '[': 'ц', ']': ';',
  a: 'ь', s: 'я', d: 'а', f: 'о', g: 'ж', h: 'г', j: 'т', k: 'н', l: 'в', ';': 'м', "'": 'ч',
  z: 'ю', x: 'й', c: 'ъ', v: 'э', b: 'ф', n: 'х', m: 'п', ',': 'р', '.': 'л', '/': 'б',
}
// Транслитерация (както се пише име на латиница): първо дългите съчетания
const TRANSLIT: [string, string][] = [
  ['sht', 'щ'], ['sh', 'ш'], ['ch', 'ч'], ['zh', 'ж'], ['ts', 'ц'], ['yu', 'ю'], ['ya', 'я'], ['ju', 'ю'], ['ja', 'я'],
  ['a', 'а'], ['b', 'б'], ['v', 'в'], ['w', 'в'], ['g', 'г'], ['d', 'д'], ['e', 'е'], ['z', 'з'], ['i', 'и'], ['y', 'й'],
  ['j', 'й'], ['k', 'к'], ['l', 'л'], ['m', 'м'], ['n', 'н'], ['o', 'о'], ['p', 'п'], ['r', 'р'], ['s', 'с'], ['t', 'т'],
  ['u', 'у'], ['f', 'ф'], ['h', 'х'], ['c', 'ц'], ['x', 'кс'], ['q', 'к'],
]

const byKeys = (s: string, map: Record<string, string>) => s.split('').map(ch => map[ch] ?? ch).join('')
function translit(s: string) {
  let out = '', i = 0
  outer: while (i < s.length) {
    for (const [lat, cyr] of TRANSLIT) {
      if (s.startsWith(lat, i)) { out += cyr; i += lat.length; continue outer }
    }
    out += s[i++]
  }
  return out
}

/** Всички варианти на търсения текст (малки букви, без повторения) */
export function searchVariants(q: string): string[] {
  const base = (q || '').trim().toLowerCase()
  if (!base) return []
  if (!/[a-z\[\];',.`\\/]/.test(base)) return [base]
  return Array.from(new Set([base, byKeys(base, PHONETIC), byKeys(base, BDS), translit(base)]))
}

/** Съдържа ли текстът търсеното — в който и да е от вариантите */
export function smartMatch(text: string | null | undefined, q: string | null | undefined): boolean {
  const variants = searchVariants(q || '')
  if (!variants.length) return true
  const hay = (text || '').toLowerCase()
  return variants.some(v => hay.includes(v))
}

/** За заявки към базата (.or(...ilike...)) — вариантите без знаци, които чупят филтъра */
export function ilikeVariants(q: string): string[] {
  const out = searchVariants(q).map(v => v.replace(/[,()%*\\]/g, ' ').trim()).filter(Boolean)
  return out.length ? out : ['']
}
