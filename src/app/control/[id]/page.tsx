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

  const { data: check } = await supabase.from('control_checks')
    .select('*, inspector:staff_profiles(first_name, last_name, position), year:academic_years(name), template:control_templates(details)')
    .eq('id', id).maybeSingle()
  if (!check) notFound()

  const [{ data: staff }, { data: recs }] = await Promise.all([
    supabase.from('control_check_staff').select('*, staff:staff_profiles(first_name, last_name, position)').eq('check_id', id),
    supabase.from('control_recommendations').select('*').eq('check_id', id).order('sort'),
  ])
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
      me={{ id: me.id, role: me.role }}
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
