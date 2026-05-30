import { createClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Plus, Calendar, Users } from 'lucide-react'
import { formatDate, getFullName } from '@/lib/utils'

export default async function CommitteeDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: committee } = await supabase
    .from('committees')
    .select('*')
    .eq('id', id)
    .single()

  if (!committee) notFound()

  const { data: members } = await supabase
    .from('committee_members')
    .select('*, staff:staff_profiles(*)')
    .eq('committee_id', id)

  const { data: sessions } = await supabase
    .from('committee_sessions')
    .select('*')
    .eq('committee_id', id)
    .order('session_date', { ascending: false })

  return (
    <div className="p-8 max-w-4xl">
      <Link href="/committees" className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800 mb-6">
        <ArrowLeft size={15} />
        Назад
      </Link>

      <h1 className="text-2xl font-semibold text-slate-800 mb-2">{committee.name}</h1>
      {committee.description && <p className="text-slate-500 text-sm mb-6">{committee.description}</p>}

      <div className="grid grid-cols-3 gap-6">
        {/* Members */}
        <div className="card">
          <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <Users size={15} className="text-slate-400" />
              <h2 className="font-medium text-slate-700 text-sm">Членове</h2>
            </div>
          </div>
          <div className="space-y-3">
            {members?.map(m => (
              <div key={m.id} className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-xs font-medium text-slate-600">
                  {(m.staff as any)?.first_name?.charAt(0)}{(m.staff as any)?.last_name?.charAt(0)}
                </div>
                <div>
                  <div className="text-sm font-medium text-slate-700">{getFullName(m.staff as any)}</div>
                  {m.role && <div className="text-xs text-slate-400">{m.role}</div>}
                </div>
              </div>
            ))}
            {!members?.length && <p className="text-sm text-slate-400">Няма членове</p>}
          </div>
        </div>

        {/* Sessions */}
        <div className="card col-span-2">
          <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <Calendar size={15} className="text-slate-400" />
              <h2 className="font-medium text-slate-700 text-sm">Заседания</h2>
            </div>
            <Link href={`/committees/${id}/session/new`} className="text-xs text-slate-400 hover:text-slate-700 flex items-center gap-1">
              <Plus size={12} />
              Ново заседание
            </Link>
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
