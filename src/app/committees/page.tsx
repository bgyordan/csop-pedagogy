import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Plus, Building2, Users } from 'lucide-react'

export default async function CommitteesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: profile } = await supabase.from('staff_profiles').select('role').eq('user_id', user.id).single()
  const canWrite = ['admin', 'zdud', 'director'].includes(profile?.role || '')

  const { data: committees } = await supabase
    .from('committees')
    .select('*, members:committee_members(count)')
    .order('name')

  return (
    <div className="p-4 md:p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl md:text-2xl font-semibold text-slate-800">Комисии</h1>
          <p className="text-slate-500 text-sm mt-1">{committees?.length || 0} комисии</p>
        </div>
        {canWrite && (
          <Link
            href="/committees/new"
            className="flex items-center gap-2 px-3 md:px-4 py-2 rounded-lg text-sm font-medium text-white"
            style={{ backgroundColor: '#0f2240' }}
          >
            <Plus size={16} />
            <span className="hidden sm:inline">Нова комисия</span>
            <span className="sm:hidden">Нова</span>
          </Link>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4">
        {committees?.map(committee => (
          <Link
            key={committee.id}
            href={`/committees/${committee.id}`}
            className="card hover:shadow-md transition-shadow"
          >
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center flex-shrink-0">
                <Building2 size={18} className="text-slate-500" />
              </div>
              <div className="flex-1 min-w-0">
                <h2 className="font-medium text-slate-800 truncate">{committee.name}</h2>
                {committee.description && (
                  <p className="text-xs text-slate-500 mt-1 line-clamp-2">{committee.description}</p>
                )}
                <div className="flex items-center gap-1 mt-2 text-xs text-slate-400">
                  <Users size={12} />
                  <span>{(committee.members as any)?.[0]?.count || 0} членове</span>
                </div>
              </div>
              <span className="text-xs text-slate-400 flex-shrink-0">→</span>
            </div>
          </Link>
        ))}

        {!committees?.length && (
          <div className="col-span-1 md:col-span-2 text-center py-16 text-slate-400">
            <Building2 className="mx-auto mb-2 opacity-30" size={32} />
            <p className="text-sm">Няма създадени комисии</p>
          </div>
        )}
      </div>
    </div>
  )
}
