import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import LeaveNpClient from './LeaveNpClient'
export const dynamic = 'force-dynamic'

// „Заявление за отпуск по НП“ (Приложение № 1 на НП „Без свободен час“) — попълнено и готово за подпис.
// Всеки го прави за себе си; деловодството и управата — за всеки служител.
export default async function LeaveNpPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')
  const { data: me } = await supabase.from('staff_profiles').select('id, role, first_name, last_name, position').eq('user_id', user.id).single()
  if (!me || me.role === 'support') redirect('/dashboard')
  const forOthers = ['admin', 'zdud', 'director', 'secretary'].includes(me.role)
  const { data: staff } = forOthers
    ? await supabase.from('staff_profiles').select('id, first_name, last_name, position').eq('is_active', true).order('first_name')
    : { data: null }
  const people = (staff || [me]).map((s: any) => ({ id: s.id, name: `${s.first_name} ${s.last_name}`, position: s.position || '' }))
  return <LeaveNpClient people={people} meId={me.id} forOthers={forOthers} />
}
