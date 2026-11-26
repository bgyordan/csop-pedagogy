// Доклад за промени в паралелките до РУО — сравнение на два състава.
// Чисти функции (без база), ползват се и от страницата, и от генератора на Word.

export type RuoStudent = { id: string; name: string; school: string; externalClass: string }
export type RuoClass = { className: string; students: RuoStudent[] }

export type ChangeIn = RuoStudent & { fromClass: string | null }   // null = ново дете в ЦСОП
export type ChangeOut = RuoStudent & { toClass: string | null }    // null = отписано от ЦСОП
export type ClassChange = {
  className: string
  before: number
  after: number
  ins: ChangeIn[]
  outs: ChangeOut[]
  studentsAfter: RuoStudent[]
}

// „Служебна“ не е истинска паралелка — дете там се брои, все едно още не е в паралелка.
export const isServiceClass = (name: string) => /служебна/i.test(name)

export function computeChanges(base: RuoClass[], current: RuoClass[]): ClassChange[] {
  const real = (list: RuoClass[]) => list.filter(c => !isServiceClass(c.className))
  const b = real(base), c = real(current)
  const where = (list: RuoClass[]) => {
    const m = new Map<string, string>()
    list.forEach(cl => cl.students.forEach(s => m.set(s.id, cl.className)))
    return m
  }
  const wasIn = where(b), isIn = where(c)
  const names = [...new Set([...b.map(x => x.className), ...c.map(x => x.className)])]
  const out: ClassChange[] = []
  for (const name of names) {
    const before = b.find(x => x.className === name)?.students || []
    const after = c.find(x => x.className === name)?.students || []
    const ins: ChangeIn[] = after
      .filter(s => wasIn.get(s.id) !== name)
      .map(s => ({ ...s, fromClass: wasIn.get(s.id) ?? null }))
    const outs: ChangeOut[] = before
      .filter(s => isIn.get(s.id) !== name)
      .map(s => ({ ...s, toClass: isIn.get(s.id) ?? null }))
    if (ins.length || outs.length) {
      out.push({ className: name, before: before.length, after: after.length, ins, outs, studentsAfter: after })
    }
  }
  return out.sort((x, y) => x.className.localeCompare(y.className, 'bg', { numeric: true }))
}

// Номерата на документите за едно дете (спрямо базовата снимка)
export type ChangeDetail = {
  studentId: string
  kind: 'in' | 'out'
  parentName: string
  applicationNo: string
  opinionNo: string     // № на заповедта за насочване от РЦПППО (становището е вътрешен документ и не се вписва)
  opinionInNo: string   // вх. № на заповедта при нас
  orderNo: string
}

export const detailKey = (studentId: string, kind: 'in' | 'out') => `${kind}:${studentId}`
