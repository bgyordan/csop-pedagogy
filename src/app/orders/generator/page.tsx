import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { getFullName } from '@/lib/utils'
import GeneratorClient from './GeneratorClient'
import type { StaffLite, StudentLite, EplrTeam } from '@/lib/order-generator'
export const dynamic = 'force-dynamic'

const ROLES = ['admin', 'director', 'zdud', 'zdasd', 'secretary']

export default async function OrderGeneratorPage({ searchParams }: { searchParams: Promise<{ d?: string; t?: string }> }) {
  const params = await searchParams
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')
  const { data: me } = await supabase.from('staff_profiles').select('id, role').eq('user_id', user.id).single()
  if (!me || !ROLES.includes(me.role)) redirect('/dashboard')

  const { data: cy } = await supabase.from('academic_years').select('id, name').eq('is_current', true).maybeSingle()

  const [{ data: staffRows }, { data: studentRows }, { data: enr }, { data: teams }, { data: nomenclature }, drafts] = await Promise.all([
    supabase.from('staff_profiles').select('id, first_name, middle_name, last_name, position, role').eq('is_active', true),
    supabase.from('students').select('id, first_name, middle_name, last_name').eq('status', 'active'),
    cy ? supabase.from('student_enrollments').select('student_id, class:classes(name)').eq('academic_year_id', cy.id) : Promise.resolve({ data: [] as any[] }),
    cy ? supabase.from('eplr_teams').select('student_id, class_teacher_id, psychologist_id, speech_therapist_id, rehabilitator_id').eq('academic_year_id', cy.id) : Promise.resolve({ data: [] as any[] }),
    supabase.from('nomenclature_items').select('item_code, section_code, name').eq('for_orders', true).order('section_code').order('item_code'),
    supabase.from('order_drafts')
      .select('id, kind, template_key, title, name, data, body, order_date, order_id, order_number, registered_at, created_by, updated_at, author:staff_profiles!order_drafts_created_by_fkey(first_name, last_name)')
      .order('updated_at', { ascending: false }).limit(80),
  ])

  const staff: StaffLite[] = (staffRows || []).map((s: any) => ({ id: s.id, name: getFullName(s), position: s.position || '', role: s.role || '' }))
    .sort((a, b) => a.name.localeCompare(b.name, 'bg'))
  const cls: Record<string, string> = {}
  ;(enr || []).forEach((e: any) => { if (e.class?.name) cls[e.student_id] = e.class.name })
  const students: StudentLite[] = (studentRows || []).map((s: any) => ({ id: s.id, name: getFullName(s), className: cls[s.id] || '' }))
    .sort((a, b) => a.name.localeCompare(b.name, 'bg'))
  const eplr: Record<string, EplrTeam> = {}
  ;(teams || []).forEach((t: any) => { eplr[t.student_id] = t })

  return (
    <GeneratorClient
      meId={me.id}
      staff={staff}
      students={students}
      eplr={eplr}
      nomenclature={nomenclature || []}
      drafts={(drafts.data as any[]) || []}
      ready={!drafts.error}
      yearName={cy?.name || ''}
      initialDraft={params.d || ''}
      initialTemplate={params.t || ''}
    />
  )
}
