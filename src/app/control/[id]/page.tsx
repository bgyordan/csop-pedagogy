// Констативен протокол — попълване (чернова), подписване и вписване в Книгата, запознаване и възражение.
import { createClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import ProtocolEditor from './ProtocolEditor'
export const dynamic = 'force-dynamic'

export default async function ProtocolPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')
  const { data: me } = await supabase.from('staff_profiles').select('id, role, first_name, last_name, position').eq('user_id', user.id).single()
  if (!me) redirect('/dashboard')

  const { data: check, error: checkError } = await supabase.from('control_checks')
    .select('*, inspector:staff_profiles!control_checks_inspector_id_fkey(first_name, last_name, position), year:academic_years(name), template:control_templates(details)')
    .eq('id', id).maybeSingle()
  if (checkError) return (
    <div className="p-8 max-w-3xl mx-auto">
      <div className="bg-rose-50 border border-rose-200 text-rose-800 text-sm rounded-2xl px-4 py-3">Протоколът не може да се отвори: {checkError.message}</div>
    </div>
  )
  if (!check) notFound()

  const [{ data: staff }, { data: recs }, { data: followUps }, { data: origin }, { data: inspectors }, { data: currentYear }] = await Promise.all([
    supabase.from('control_check_staff').select('*, staff:staff_profiles(first_name, last_name, position)').eq('check_id', id),
    supabase.from('control_recommendations').select('*, responsible:staff_profiles(first_name, last_name)').eq('check_id', id).order('sort'),
    supabase.from('control_checks').select('id, book_no, status, check_date').eq('follow_up_of', id).neq('status', 'voided').order('created_at'),
    check.follow_up_of
      ? supabase.from('control_checks').select('id, book_no, signed_at, subject').eq('id', check.follow_up_of).maybeSingle()
      : Promise.resolve({ data: null }),
    supabase.from('control_inspectors').select('staff_id'),
    supabase.from('academic_years').select('id, name').eq('is_current', true).maybeSingle(),
  ])
  const isInspector = ['director', 'zdud'].includes(me.role) || (inspectors || []).some((i: any) => i.staff_id === me.id)
  const canEdit = check.status === 'draft' && (check.inspector_id === me.id || me.role === 'director')
  const canManage = check.inspector_id === me.id || me.role === 'director'
  const { data: people } = canManage
    ? await supabase.from('staff_profiles').select('id, first_name, last_name, role, position').eq('is_active', true).order('first_name')
    : { data: [] as any[] }

  let scanUrl: string | null = null
  if (check.scan_path) {
    const { data } = await supabase.storage.from('control').createSignedUrl(check.scan_path, 60 * 30)
    scanUrl = data?.signedUrl || null
  }

  return (
    <ProtocolEditor
      me={{ id: me.id, role: me.role, position: me.position || '' }}
      isInspector={isInspector}
      followUps={(followUps || []) as any}
      origin={origin as any}
      currentYear={currentYear as any}
      check={check as any}
      staff={(staff || []) as any}
      recs={(recs || []) as any}
      people={(people || []) as any}
      canEdit={canEdit}
      canManage={canManage}
      scanUrl={scanUrl}
    />
  )
}
