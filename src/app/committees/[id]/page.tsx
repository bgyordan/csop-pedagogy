import { createClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Plus, Calendar } from 'lucide-react'
import { formatDate, getFullName } from '@/lib/utils'
import { CommitteeMembers } from './CommitteeMembers'

export default async function CommitteeDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: profile } = await supabase
    .from('staff_profiles').select('role').eq('user_id', user.id).single()
  const canManage = ['admin', 'zdud', 'director'].includes(profile?.role || '')

  const { data: committee } = await supabase
    .from('committees').select('*').eq('id', id).single()
  if (!committee) notFound()

  const { data: members } = await supabase
    .from('committee_members').select('*, staff:staff_profiles(*)').eq('committee_id', id)

  const { data: sessions } = await supabase
    .from('committee_sessions').select('*').eq('committee_id', id)
    .order('session_date', { ascending: false })

  // Всички служители за добавяне към комисията
  const { data: allStaff } = await supabase
    .from('staff_profiles').select('id, first_name, middle_name, last_name, role')
    .eq('is_active', true).order('last_name')

  return (
    <div className="p-4 md:p-8 max-w-4xl">
      <Link href="/committees" className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800 mb-6">
        <ArrowLeft size={15} />
        Назад
      </Link>

      <h1 className="text-xl md:text-2xl font-semibold text-slate-800 mb-2">{committee.name}</h1>
      {committee.description && <p className="text-slate-500 text-sm mb-6">{committee.description}</p>}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6">
        {/* Членове — client component за управление */}
        <CommitteeMembers
          committeeId={id}
          members={members || []}
          allStaff={allStaff || []}
          canManage={canManage}
        />

        {/* Заседания */}
        <div className="card md:col-span-2">
          <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <Calendar size={15} className="text-slate-400" />
              <h2 className="font-medium text-slate-700 text-sm">Заседания</h2>
            </div>
            {canManage && (
              <Link href={`/committees/${id}/session/new`}
                className="text-xs text-slate-400 hover:text-slate-700 flex items-center gap-1">
                <Plus size={12} />
                Ново заседание
              </Link>
            )}
          </div>

          <div className="space-y-3">
            {sessions?.map(session => (
              <div key={session.id} className="p-4 border border-slate-100 rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-slate-700">{formatDate(session.session_date)}</span>
                  {session.deadline && (
                    <span className="text-xs text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full">
                      Срок: {formatDate(session.deadline)}
                    </span>
                  )}
                </div>
                {session.agenda && (
                  <div className="text-xs text-slate-500 mb-2">
                    <span className="font-medium">Дневен ред:</span> {session.agenda}
                  </div>
                )}
                {session.protocol && (
                  <div className="text-xs text-slate-500 mb-2">
                    <span className="font-medium">Протокол:</span> {session.protocol}
                  </div>
                )}
                {session.decisions && (
                  <div className="text-xs text-slate-500">
                    <span className="font-medium">Решения:</span> {session.decisions}
                  </div>
                )}
              </div>
            ))}
            {!sessions?.length && <p className="text-sm text-slate-400">Няма заседания</p>}
          </div>
        </div>
      </div>
    </div>
  )
}
