// ОРЕС — общо правило „активен днес“ за всички места (табло, списък деца, паралелка, досие, справки).
// Активен = не е приключен от стаята („Приключи ОРЕС“), започнал е и още не е свършил — по софийско време.

export function todaySofia() {
  return new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Sofia' })   // YYYY-MM-DD
}

export type OresDates = { from_date: string; to_date: string | null; room_closed_at?: string | null }

export function isOresActive(o: OresDates, today: string = todaySofia()) {
  return !o.room_closed_at && o.from_date <= today && (!o.to_date || o.to_date >= today)
}

// колоните, нужни за проверката (за .select)
export const ORES_ACTIVE_COLS = 'student_id, from_date, to_date, room_closed_at'
