// Сроковете от „График срокове“ (recurring_tasks) за таблата — следващото неотметнато появяване на всяка задача
import { taskStatus, type RecTask } from '@/lib/recurring'

export type UpcomingTask = { id: string; title: string; deadline_date: string; days: number; state: 'overdue' | 'due-soon' | 'upcoming' }

export async function upcomingTasks(supabase: any, limit = 6): Promise<UpcomingTask[]> {
  const [{ data: tasks }, { data: comp }] = await Promise.all([
    supabase.from('recurring_tasks').select('*').eq('active', true),
    supabase.from('recurring_task_completions').select('task_id, occurrence_date'),
  ])
  const done = new Set<string>((comp || []).map((r: any) => `${r.task_id}:${r.occurrence_date}`))
  const now = new Date(new Date().toLocaleString('en-US', { timeZone: 'Europe/Sofia' }))
  return ((tasks || []) as RecTask[])
    .map(t => {
      const st = taskStatus(t, done, now)
      return st.current && st.state !== 'none'
        ? { id: t.id, title: t.title, deadline_date: st.current, days: st.daysUntil ?? 0, state: st.state as UpcomingTask['state'] }
        : null
    })
    .filter(Boolean)
    .sort((a: any, b: any) => a.deadline_date.localeCompare(b.deadline_date))
    .slice(0, limit) as UpcomingTask[]
}
