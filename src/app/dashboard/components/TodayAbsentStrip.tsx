import { createAdminClient } from '@/lib/supabase/admin'
import { getTodayAbsences, sofiaToday } from '@/lib/today-absences'
import AbsentNote from './AbsentNote'

// „Днес отсъстват“ за всички колеги (без управата — тя има картата в OpsPanel).
// Листче от тетрадка: изскача само с новото (ново отсъствие или нов заместник), „Видях“ го прибира;
// после остава малка бележка, от която се отваря отново с всички отсъстващи днес.
// Чете през service-role (само имена, длъжности и дати).
export default async function TodayAbsentStrip() {
  let rows: Awaited<ReturnType<typeof getTodayAbsences>> = []
  try { rows = await getTodayAbsences(createAdminClient(), { all: true }) } catch { return null }
  if (!rows.some(r => !!r.by)) return null   // листчето е само за заместванията
  return <AbsentNote rows={rows} today={sofiaToday()} />
}
