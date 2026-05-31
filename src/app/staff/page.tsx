import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { ROLE_LABELS, UserRole, StaffProfile } from '@/types'
import { getFullName } from '@/lib/utils'

export default async function StaffPage({
  searchParams,
}: {
  searchParams: Promise<{ sort?: string; dir?: string }>
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const params = await searchParams
  const sort = params.sort || 'first_name'
  const dir = params.dir || 'asc'

  const { data: staff } = await supabase
    .from('staff_profiles')
    .select('*')
    .eq('is_active', true)
    .order(sort, { ascending: dir === 'asc' })

  function sortLink(col: string) {
    const newDir = sort === col && dir === 'asc' ? 'desc' : 'asc'
    return `/staff?sort=${col}&dir=${newDir}`
  }

  function sortIcon(col: string) {
    if (sort !== col) return ' ↕'
    return dir === 'asc' ? ' ↑' : ' ↓'
  }

  return (
    <div className="p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-slate-800">Служители</h1>
        <p className="text-slate-500 text-sm mt-1">{staff?.length || 0} активни служители</p>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200">
              <th className="text-left px-4 py-2.5 text-xs font-medium text-slate-500 uppercase tracking-wide">
                <a href={sortLink('first_name')} className="hover:text-slate-800">
                  Три имена{sortIcon('first_name')}
                </a>
              </th>
              <th className="text-left px-4 py-2.5 text-xs font-medium text-slate-500 uppercase tracking-wide">
                <a href={sortLink('role')} className="hover:text-slate-800">
                  Роля{sortIcon('role')}
                </a>
              </th>
              <th className="text-left px-4 py-2.5 text-xs font-medium text-slate-500 uppercase tracking-wide">
                <a href={sortLink('email')} className="hover:text-slate-800">
                  Имейл{sortIcon('email')}
                </a>
              </th>
            </tr>
          </thead>
          <tbody>
            {staff?.map((s: StaffProfile, idx: number) => (
              <tr key={s.id} className={`border-b border-slate-100 hover:bg-blue-50 transition-colors ${idx % 2 === 1 ? 'bg-slate-50/50' : 'bg-white'}`}>
                <td className="px-4 py-2 font-medium text-slate-800">{getFullName(s)}</td>
                <td className="px-4 py-2 text-slate-600">{ROLE_LABELS[s.role]}</td>
                <td className="px-4 py-2 text-slate-500 text-xs font-mono">{s.email}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
