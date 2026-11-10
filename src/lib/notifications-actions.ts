'use server'
// Камбанката в менюто: нещата, които чакат ТОЗИ човек — събрани от няколко модула.
// Всеки източник е отделен и защитен: ако модулът още няма таблици (SQL файлът не е пуснат)
// или човекът няма достъп, просто не дава нищо, без да събаря останалите.
import { createClient } from '@/lib/supabase/server'
import { canSubstitute } from '@/lib/pedagogues'

export type Notice = {
  key: string                       // устойчив ключ — по него се помни „видяно“
  tone: 'rose' | 'amber' | 'blue'   // просрочено / скоро / за сведение
  title: string
  hint?: string
  href: string
}

const sofiaToday = () => new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Sofia' })
const addDays = (iso: string, n: number) => { const d = new Date(iso + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10) }
const dm = (iso: string) => iso.slice(5, 10).split('-').reverse().join('.')
const span = (a: string, b: string) => a === b ? dm(a) : `${dm(a)} – ${dm(b)}`
const dueTone = (due: string | null, today: string): Notice['tone'] => due && due < today ? 'rose' : 'amber'

export async function getNotifications(): Promise<Notice[]> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []
  const { data: me } = await supabase.from('staff_profiles').select('id, role').eq('user_id', user.id).maybeSingle()
  if (!me) return []
  const today = sofiaToday()
  const isMgmt = ['admin', 'zdud', 'director'].includes(me.role)
  const canSubs = isMgmt || me.role === 'secretary'

  const safe = async (fn: () => Promise<Notice[]>): Promise<Notice[]> => { try { return await fn() } catch { return [] } }

  const parts = await Promise.all([
    // 1. Документи за съгласуване, с които още не съм се запознал (или има нови файлове)
    safe(async () => {
      const { data: sets, error } = await supabase.from('council_sets').select('id, title, event_date')
        .eq('is_archived', false).or(`event_date.is.null,event_date.gte.${today}`)
      if (error || !sets?.length) return []
      const ids = sets.map((s: any) => s.id)
      const [{ data: files }, acks] = await Promise.all([
        supabase.from('council_files').select('set_id, created_at').in('set_id', ids),
        supabase.from('council_acks').select('set_id, acked_at').eq('staff_id', me.id).in('set_id', ids),
      ])
      if (acks.error) return []
      const last: Record<string, number> = {}
      ;(files || []).forEach((f: any) => { last[f.set_id] = Math.max(last[f.set_id] || 0, Date.parse(f.created_at) || 0) })
      const acked: Record<string, number> = {}
      ;(acks.data || []).forEach((a: any) => { acked[a.set_id] = Date.parse(a.acked_at) || 0 })
      return sets.filter((s: any) => last[s.id] && !(acked[s.id] >= last[s.id])).map((s: any) => ({
        key: `council:${s.id}:${last[s.id]}`, tone: 'blue' as const,
        title: `За съгласуване: ${s.title}`,
        hint: s.event_date ? `заседание на ${dm(s.event_date)}` : 'запознайте се с документите',
        href: '/council',
      }))
    }),
    // 2. Констативни протоколи, с които трябва да се запозная
    safe(async () => {
      const { data, error } = await supabase.from('control_check_staff')
        .select('check_id, check:control_checks!inner(status, subject)')
        .eq('staff_id', me.id).is('acked_at', null).eq('check.status', 'signed')
      if (error) return []
      return (data || []).map((p: any) => ({
        key: `ctl-ack:${p.check_id}`, tone: 'blue' as const,
        title: 'Констативен протокол за запознаване',
        hint: p.check?.subject || undefined, href: `/control/${p.check_id}`,
      }))
    }),
    // 3. Мои препоръки от контролната дейност — със срок до 7 дни или просрочени
    safe(async () => {
      const { data, error } = await supabase.from('control_recommendations')
        .select('id, check_id, due_date, check:control_checks!control_recommendations_check_id_fkey!inner(status)')
        .eq('responsible_id', me.id).eq('check.status', 'signed').in('status', ['open', 'not_done'])
        .lte('due_date', addDays(today, 7))
      if (error) return []
      return (data || []).map((r: any) => ({
        key: `ctl-rec:${r.id}:${r.due_date}`, tone: dueTone(r.due_date, today),
        title: r.due_date < today ? 'Препоръка с изтекъл срок' : 'Препоръка със срок',
        hint: `до ${dm(r.due_date)} — отчетете изпълнението`, href: `/control/${r.check_id}`,
      }))
    }),
    // 4. Решения на ПС / общото събрание, за които отговарям
    safe(async () => {
      const { data, error } = await supabase.from('mtg_decisions')
        .select('id, due_date, task_status, meeting:mtg_meetings!inner(status)')
        .eq('responsible_id', me.id).in('task_status', ['open', 'not_done']).eq('meeting.status', 'final')
      if (error) return []
      return (data || []).filter((d: any) => !d.due_date || d.due_date <= addDays(today, 14)).map((d: any) => ({
        key: `mtg-dec:${d.id}:${d.due_date || ''}`, tone: d.due_date ? dueTone(d.due_date, today) : 'blue' as const,
        title: d.due_date && d.due_date < today ? 'Решение с изтекъл срок за изпълнение' : 'Решение за изпълнение',
        hint: d.due_date ? `срок ${dm(d.due_date)}` : 'ПС / общо събрание', href: '/meetings',
      }))
    }),
    // 5. Замествам колега — днес и в следващите 7 дни
    safe(async () => {
      const hi = addDays(today, 7)
      const { data: as } = await supabase.from('substitution_assignments')
        .select('substitution_id, date_from, date_to').eq('substitute_staff_id', me.id).lte('date_from', hi).gte('date_to', today)
      const mine: Record<string, { from: string; to: string }> = {}
      ;(as || []).forEach((a: any) => {
        const c = mine[a.substitution_id]
        mine[a.substitution_id] = c ? { from: a.date_from < c.from ? a.date_from : c.from, to: a.date_to > c.to ? a.date_to : c.to } : { from: a.date_from, to: a.date_to }
      })
      const { data: subs, error } = await supabase.from('substitutions')
        .select('id, date_from, date_to, substitute_staff_id, absent:staff_profiles!substitutions_absent_staff_id_fkey(first_name, last_name)')
        .lte('date_from', hi).gte('date_to', today)
      if (error) return []
      // при разпределение по дни важат само моите редове
      const { data: split } = subs?.length
        ? await supabase.from('substitution_assignments').select('substitution_id').in('substitution_id', subs.map((s: any) => s.id))
        : { data: [] as any[] }
      const isSplit = new Set((split || []).map((a: any) => a.substitution_id))
      return (subs || []).flatMap((s: any) => {
        const r = isSplit.has(s.id) ? mine[s.id] : (s.substitute_staff_id === me.id ? { from: s.date_from, to: s.date_to } : null)
        if (!r) return []
        const from = r.from < today ? today : r.from
        return [{
          key: `sub-me:${s.id}:${r.from}:${r.to}`, tone: (from === today ? 'amber' : 'blue') as Notice['tone'],
          title: `Замествате ${s.absent ? `${s.absent.first_name} ${s.absent.last_name}` : 'колега'}`,
          hint: from === today && r.to === today ? 'днес' : span(from, r.to), href: '/my-lecturer',
        }]
      })
    }),
    // 6. Управата и деловодството: отсъствия на учители без заместник (текущи и до 7 дни напред)
    safe(async () => {
      if (!canSubs) return []
      const { data: subs, error } = await supabase.from('substitutions')
        .select('id, date_from, date_to, absent:staff_profiles!substitutions_absent_staff_id_fkey(first_name, last_name, role)')
        .is('substitute_staff_id', null).lte('date_from', addDays(today, 7)).gte('date_to', today)
      if (error || !subs?.length) return []
      const { data: asg } = await supabase.from('substitution_assignments').select('substitution_id').in('substitution_id', subs.map((s: any) => s.id))
      const has = new Set((asg || []).map((a: any) => a.substitution_id))
      return subs.filter((s: any) => !has.has(s.id) && s.absent && canSubstitute(s.absent.role)).map((s: any) => ({
        key: `sub-none:${s.id}`, tone: (s.date_from <= today ? 'rose' : 'amber') as Notice['tone'],
        title: `Без заместник: ${s.absent.first_name} ${s.absent.last_name}`,
        hint: span(s.date_from, s.date_to), href: '/substitutions',
      }))
    }),
  ])

  const order = { rose: 0, amber: 1, blue: 2 }
  return parts.flat().sort((a, b) => order[a.tone] - order[b.tone]).slice(0, 40)
}
