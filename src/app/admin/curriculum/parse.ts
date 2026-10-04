// Разчитане на обобщената справка от НЕИСПУО и свързване с паралелки, групи ЦОУД и служители в EIS.
// Само чете от EIS — нищо съществуващо не се променя.

export type RawLine = {
  holder: string; subject: string
  weeksT1: number; hoursT1: number; weeksT2: number; hoursT2: number
  total: number; students: number | null; teacher: string
}
export type Ref = { id: string; name: string }
export type NameMap = { kind: 'staff' | 'class' | 'coud'; source_name: string; target_id: string }[]
export type Matched = RawLine & {
  kind: 'class' | 'coud' | 'specialist'
  classId: string | null; coudId: string | null; staffId: string | null
}

const norm = (s: string) => (s || '').toLowerCase().replace(/ё/g, 'е').replace(/\s+/g, ' ').trim()
const num = (v: any) => { const n = Number(String(v ?? '').replace(',', '.')); return Number.isFinite(n) ? n : 0 }

/** Редовете от листа (масив от масиви) → редове на учебния план. Колоните се намират по заглавие. */
export function parseSheet(rows: any[][]): { lines: RawLine[]; error?: string } {
  const hi = rows.findIndex(r => r.some(c => norm(String(c)) === 'преподавател') && r.some(c => norm(String(c)).startsWith('клас')))
  if (hi < 0) return { lines: [], error: 'Не намирам заглавния ред (Клас … Преподавател). Това ли е обобщената справка от НЕИСПУО?' }
  const h = rows[hi].map(c => norm(String(c ?? '')))
  const col = (test: (x: string) => boolean) => h.findIndex(test)
  const c = {
    holder: col(x => x.startsWith('клас')),
    subject: col(x => x.includes('предмет')),
    w1: col(x => x.startsWith('i срок') && x.includes('ус')),
    h1: col(x => x.startsWith('i срок') && x.includes('чс')),
    w2: col(x => x.startsWith('ii срок') && x.includes('ус')),
    h2: col(x => x.startsWith('ii срок') && x.includes('чс')),
    total: col(x => x.startsWith('общ')),
    students: col(x => x.includes('деца') || x.includes('ученици')),
    teacher: col(x => x.startsWith('преподавател')),
  }
  const missing = Object.entries(c).filter(([, i]) => i < 0).map(([k]) => k)
  if (missing.length) return { lines: [], error: `Липсват колони: ${missing.join(', ')}` }
  const lines: RawLine[] = []
  for (const r of rows.slice(hi + 1)) {
    const holder = String(r[c.holder] ?? '').trim(), subject = String(r[c.subject] ?? '').trim()
    if (!holder || !subject) continue
    lines.push({
      holder, subject,
      weeksT1: num(r[c.w1]), hoursT1: num(r[c.h1]), weeksT2: num(r[c.w2]), hoursT2: num(r[c.h2]),
      total: num(r[c.total]), students: r[c.students] === '' || r[c.students] == null ? null : num(r[c.students]),
      teacher: String(r[c.teacher] ?? '').trim(),
    })
  }
  return { lines }
}

const numberIn = (s: string) => { const m = s.match(/\d+/); return m ? Number(m[0]) : null }

/** Свързва редовете с EIS: „10 паралелка“ → паралелка 10, „ЦОУД №3“ → група 3, преподавател → служител */
export function matchLines(lines: RawLine[], classes: Ref[], couds: Ref[], staff: Ref[], map: NameMap): Matched[] {
  const mapped = (kind: string, name: string) => map.find(m => m.kind === kind && norm(m.source_name) === norm(name))?.target_id || null
  const classByNum = new Map<number, string>()
  classes.forEach(x => { const n = numberIn(x.name); if (n !== null && !classByNum.has(n)) classByNum.set(n, x.id) })
  const coudByNum = new Map<number, string>()
  couds.forEach(x => { const n = numberIn(x.name); if (n !== null && !coudByNum.has(n)) coudByNum.set(n, x.id) })

  // служители: „име фамилия“ точно; иначе — еднозначно по фамилия + първа буква на името
  const full = new Map<string, string>()
  staff.forEach(s => full.set(norm(s.name), s.id))
  const findStaff = (name: string): string | null => {
    if (!name) return null
    const m = mapped('staff', name); if (m) return m
    const n = norm(name)
    if (full.has(n)) return full.get(n)!
    const [first, ...rest] = n.split(' '); const last = rest[rest.length - 1]
    const cands = staff.filter(s => { const p = norm(s.name).split(' '); return p[p.length - 1] === last && p[0]?.[0] === first?.[0] })
    return cands.length === 1 ? cands[0].id : null
  }

  return lines.map(l => {
    const isClass = /паралелка/i.test(l.holder), isCoud = /цоуд/i.test(l.holder)
    const kind: Matched['kind'] = isClass ? 'class' : isCoud ? 'coud' : 'specialist'
    const n = numberIn(l.holder)
    const classId = kind === 'class' ? (mapped('class', l.holder) || (n !== null ? classByNum.get(n) || null : null)) : null
    const coudId = kind === 'coud' ? (mapped('coud', l.holder) || (n !== null ? coudByNum.get(n) || null : null)) : null
    return { ...l, kind, classId, coudId, staffId: findStaff(l.teacher) }
  })
}
