import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import ProjectsClient from './ProjectsClient'
export const dynamic = 'force-dynamic'

export default async function ProjectsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')
  const { data: me } = await supabase
    .from('staff_profiles').select('id, role').eq('user_id', user.id).single()
  if (!me) redirect('/dashboard')

  const { data: currentYear } = await supabase
    .from('academic_years').select('id, name').eq('is_current', true).single()

  const isManager = ['admin', 'zdud', 'director'].includes(me.role)

  // Моите паралелки (като класен) за текущата година
  const { data: myCta } = await supabase
    .from('class_teacher_assignments').select('class_id')
    .eq('staff_id', me.id).eq('academic_year_id', currentYear?.id)
  const myClassIds = (myCta || []).map((c: any) => c.class_id)

  // Всички паралелки за избор в проекта
  const { data: classes } = await supabase
    .from('classes').select('id, name').eq('academic_year_id', currentYear?.id).order('name')

  // Проекти + участващите паралелки
  const { data: projects } = await supabase
    .from('class_projects')
    .select('id, title, ideas, activities, goals, period_from, period_to, status, created_by, class_project_classes(class_id)')
    .eq('academic_year_id', currentYear?.id)
    .order('created_at', { ascending: false })

  const rows = (projects || []).map((p: any) => ({
    id: p.id,
    title: p.title,
    ideas: p.ideas,
    activities: p.activities,
    goals: p.goals,
    period_from: p.period_from,
    period_to: p.period_to,
    status: p.status,
    created_by: p.created_by,
    classIds: (p.class_project_classes || []).map((c: any) => c.class_id),
  }))

  return (
    <ProjectsClient
      meId={me.id}
      isManager={isManager}
      myClassIds={myClassIds}
      classes={classes || []}
      projects={rows}
      academicYearId={currentYear?.id || null}
      yearName={currentYear?.name || ''}
    />
  )
}
