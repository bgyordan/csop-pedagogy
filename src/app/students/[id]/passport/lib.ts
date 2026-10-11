// Паспорт на детето — типове и надписи (ползват се и от досието, и от страницата за печат).

export interface Passport {
  student_id: string
  communication: string[]
  communication_note: string | null
  likes: string | null
  triggers: string | null
  calming: string | null
  eating: 'self' | 'help' | null
  eating_note: string | null
  toilet: 'self' | 'help' | 'diaper' | null
  mobility: 'self' | 'help' | 'wheelchair' | null
  safety: string | null
  updated_by?: string | null
  updated_at?: string | null
}

export const COMMUNICATION: Record<string, string> = {
  speech: 'говори',
  words: 'отделни думи',
  gestures: 'жестове',
  pictures: 'пиктограми / картинки',
  device: 'таблет / устройство',
}
export const EATING: Record<string, string> = { self: 'сам(а)', help: 'с помощ' }
export const TOILET: Record<string, string> = { self: 'самостоятелно', help: 'с помощ', diaper: 'памперс' }
export const MOBILITY: Record<string, string> = { self: 'самостоятелно', help: 'с помощ', wheelchair: 'количка' }

export function emptyPassport(studentId: string): Passport {
  return {
    student_id: studentId, communication: [], communication_note: '', likes: '', triggers: '', calming: '',
    eating: null, eating_note: '', toilet: null, mobility: null, safety: '',
  }
}

// Има ли нещо попълнено
export function isFilled(p: Passport | null | undefined): boolean {
  if (!p) return false
  return p.communication.length > 0 || !!(p.communication_note || p.likes || p.triggers || p.calming || p.eating
    || p.eating_note || p.toilet || p.mobility || p.safety)
}

export const PASSPORT_COLS = 'student_id, communication, communication_note, likes, triggers, calming, eating, eating_note, toilet, mobility, safety, updated_by, updated_at'

// Редът за запис (upsert) — общ за досието и за списъка „Паспорти“
export function passportRow(studentId: string, meId: string, v: Passport) {
  return {
    student_id: studentId, communication: v.communication, communication_note: v.communication_note || null,
    likes: v.likes || null, triggers: v.triggers || null, calming: v.calming || null,
    eating: v.eating, eating_note: v.eating_note || null, toilet: v.toilet, mobility: v.mobility,
    safety: v.safety || null, updated_by: meId || null, updated_at: new Date().toISOString(),
  }
}
