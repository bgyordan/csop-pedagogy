'use server'
import { createClient } from '@/lib/supabase/server'
import { getLecturerOverview, getReviewDetail } from '../lecturer-review/actions'
import { getMonthlyDeclarationFor } from '../substitutions/actions'

// „Отчитане лекторски“ — контролният лист по хартиените декларации.
// Самата декларация е на хартия; тук се пазят само отметките: получена → ОК / несъответствие → изплатена.

export type CheckKind = 'over' | 'sub_budget' | 'sub_np'
export type Check = {
  staffId: string; kind: CheckKind; from: string; to: string
  receivedAt: string | null; status: 'ok' | 'issue' | null; note: string | null
  hoursAtCheck: number | null; paidAt: string | null
}
export type CheckRow = {
  staffId: string; name: string; position: string
  overPlanned: number; overDeclared: number; subBudget: number; subNp: number
}

const MANAGERS = ['admin', 'zdud', 'director', 'secretary']

async function manager() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { supabase, me: null, error: 'Не сте влезли' }
  const { data: me } = await supabase.from('staff_profiles').select('id, role').eq('user_id', user.id).single()
  if (!MANAGERS.includes(me?.role || '')) return { supabase, me: null, error: 'Нямате права' }
  return { supabase, me, error: '' }
}

// Месецът: заместване = този месец; над норматив = периодът, който СВЪРШВА с този месец (окт. → септ.–окт.), за септември — няма
export async function getCheckMonth(month: { from: string; to: string }, over: { from: string; to: string } | null) {
  const { supabase, error } = await manager()
  if (error) return { error }

  const subRes: any = await getLecturerOverview(month.from, month.to)
  if (subRes.error) return { error: subRes.error }
  const overRes: any = !over ? { data: [] }
    : (over.from === month.from && over.to === month.to) ? subRes
    : await getLecturerOverview(over.from, over.to)
  if (overRes.error) return { error: overRes.error }

  const rows: Record<string, CheckRow> = {}
  const row = (r: any) => (rows[r.staffId] = rows[r.staffId] || { staffId: r.staffId, name: r.name, position: r.position, overPlanned: 0, overDeclared: 0, subBudget: 0, subNp: 0 })
  ;(subRes.data || []).forEach((r: any) => { if (r.np + r.budget > 0) { const x = row(r); x.subBudget = r.budget; x.subNp = r.np } })
  if (over) (overRes.data || []).forEach((r: any) => { if (r.planned + r.declared > 0) { const x = row(r); x.overPlanned = r.planned; x.overDeclared = r.declared } })

  const periods = [month, ...(over ? [over] : [])]
  const { data: ch, error: chErr } = await supabase.from('lecturer_checks')
    .select('staff_id, kind, period_from, period_to, received_at, status, note, hours_at_check, paid_at')
    .or(periods.map(p => `and(period_from.eq.${p.from},period_to.eq.${p.to})`).join(','))
  if (chErr) return { error: /lecturer_checks/.test(chErr.message) ? 'Пуснете SQL файла 2026-10-10_lecturer_checks.sql' : chErr.message }
  const checks: Check[] = (ch || []).map((c: any) => ({
    staffId: c.staff_id, kind: c.kind, from: c.period_from, to: c.period_to,
    receivedAt: c.received_at, status: c.status, note: c.note,
    hoursAtCheck: c.hours_at_check === null ? null : Number(c.hours_at_check), paidAt: c.paid_at,
  }))

  return { data: Object.values(rows).sort((a, b) => a.name.localeCompare(b.name, 'bg')), checks }
}

// Редовете на клетката — същите като в хартиената декларация
export type DetailLine = { date: string; orderRef?: string; cls: string; subject: string; hours: number; absent?: string; mark?: 'declared' | 'missing' | 'absent' }
export async function getCellDetail(staffId: string, kind: CheckKind, from: string, to: string): Promise<{ lines?: DetailLine[]; hasDecl?: boolean; error?: string }> {
  const { error } = await manager()
  if (error) return { error }

  if (kind !== 'over') {
    const r: any = await getMonthlyDeclarationFor(staffId, from, to)
    if (r.error) return { error: r.error }
    const lines = (r.data.rows as any[]).filter(x => x.bsch === (kind === 'sub_np'))
      .map(x => ({ date: x.date, orderRef: x.orderRef, cls: x.cls, subject: x.subject, hours: x.hours, absent: x.absentName }))
    return { lines }
  }

  // над норматив: по дати, като в декларацията (Образец 3) — декларирани / недекларирани / в отсъствие
  const d: any = await getReviewDetail(staffId, from, to)
  if (d.error) return { error: d.error }
  const hasDecl = (d.over as any[]).some(s => s.dates.some((x: any) => x.declared))
  const map: Record<string, DetailLine> = {}
  ;(d.over as any[]).forEach(s => s.dates.forEach((x: any) => {
    const mark = x.declared ? 'declared' : x.absent ? 'absent' : 'missing'
    const key = `${x.date}|${s.holder}|${s.subject}|${mark}`
    const m = (map[key] = map[key] || { date: x.date.split('-').reverse().join('.'), cls: s.holder, subject: s.subject, hours: 0, mark })
    m.hours++
  }))
  const lines = Object.values(map).sort((a, b) => a.date.split('.').reverse().join('').localeCompare(b.date.split('.').reverse().join('')))
  return { lines, hasDecl }
}

// Отметка: received / ok / issue / paid / reset (изтрива реда — всичко отначало)
export async function setCheck(p: { staffId: string; kind: CheckKind; from: string; to: string; action: 'received' | 'ok' | 'issue' | 'paid' | 'unpaid' | 'reset'; note?: string; hours?: number }) {
  const { supabase, me, error } = await manager()
  if (error || !me) return { error: error || 'Нямате права' }
  const key = { staff_id: p.staffId, kind: p.kind, period_from: p.from, period_to: p.to }
  const now = new Date().toISOString()

  if (p.action === 'reset') {
    const { error: e } = await supabase.from('lecturer_checks').delete().match(key)
    return e ? { error: e.message } : { ok: true }
  }
  const { data: cur } = await supabase.from('lecturer_checks').select('received_at').match(key).maybeSingle()
  const patch: any = { ...key }
  if (!cur?.received_at) { patch.received_at = now; patch.received_by = me.id }
  if (p.action === 'ok' || p.action === 'issue') {
    patch.status = p.action; patch.note = p.action === 'issue' ? (p.note || '').trim() || null : null
    patch.hours_at_check = p.hours ?? null; patch.checked_at = now; patch.checked_by = me.id
  }
  if (p.action === 'paid') { patch.paid_at = now; patch.paid_by = me.id }
  if (p.action === 'unpaid') { patch.paid_at = null; patch.paid_by = null }
  const { error: e } = await supabase.from('lecturer_checks').upsert(patch, { onConflict: 'staff_id,kind,period_from,period_to' })
  if (e) return { error: /lecturer_checks/.test(e.message) ? 'Пуснете SQL файла 2026-10-10_lecturer_checks.sql' : e.message }
  return { ok: true }
}
