import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { ROLE_LABELS, UserRole, StaffProfile } from '@/types'
import { getFullName } from '@/lib/utils'

const PER_PAGE = 15

export default async function StaffPage({
  searchParams,
}: {
  searchParams: Promise<{ sort?: string; dir?: string; page?: string; q?: string }>
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: myProfile } = await supabase
    .from('staff_profiles').select('role').eq('user_id', user.id).single()
  const canOpenDetail = ['admin', 'zdud', 'director'].includes(myProfile?.role || '')

  const params = await searchParams
  const sort = params.sort || 'first_name'
  const dir = params.dir || 'asc'
  const page = parseInt(params.page || '1')
  const q = params.q || ''

  const { data: allStaff } = await supabase
    .from('staff_profiles')
    .select('*')
    .eq('is_active', true)
    .order(sort, { ascending: dir === 'asc' })

  const filtered = allStaff?.filter(s =>
    !q || getFullName(s).toLowerCase().includes(q.toLowerCase()) ||
    s.email.toLowerCase().includes(q.toLowerCase())
  ) || []

  const total = filtered.length
  const totalPages = Math.ceil(total / PER_PAGE)
  const staff = filtered.slice((page - 1) * PER_PAGE, page * PER_PAGE)

  function sortLink(col: string) {
    const newDir = sort === col && dir === 'asc' ? 'desc' : 'asc'
    return `/staff?sort=${col}&dir=${newDir}&q=${q}`
  }

  function sortIcon(col: string) {
    if (sort !== col) return ' ↕'
    return dir === 'asc' ? ' ↑' : ' ↓'
  }

  function pageLink(p: number) {
    return `/staff?sort=${sort}&dir=${dir}&q=${q}&page=${p}`
  }

  return (
    <div className="p-4 md:p-8">
      <div className="mb-6">
        <h1 className="text-xl md:text-2xl font-semibold text-slate-800">Служители</h1>
        <p className="text-slate-500 text-sm mt-1">{total} активни служители</p>
      </div>

      {/* Search */}
      <form className="mb-4">
        <input
          name="q"
          defaultValue={q}
          placeholder="Търси по име или имейл..."
          className="input w-full md:max-w-sm"
        />
        <input type="hidden" name="sort" value={sort} />
        <input type="hidden" name="dir" value={dir} />
      </form>

      {/* ДЕСКТОП: таблица */}
      <div className="hidden md:block bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
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
            {staff.map((s: StaffProfile, idx: number) => (
              <tr key={s.id} className={`border-b border-slate-100 hover:bg-blue-50 transition-colors ${idx % 2 === 1 ? 'bg-slate-50/50' : 'bg-white'}`}>
                <td className="px-4 py-2 font-medium text-slate-800">
                  {canOpenDetail ? (
                    <Link href={`/staff/${s.id}`} className="hover:underline hover:text-[#0f2240]">
                      {getFullName(s)}
                    </Link>
                  ) : getFullName(s)}
                </td>
                <td className="px-4 py-2 text-slate-600">{ROLE_LABELS[s.role]}</td>
                <td className="px-4 py-2 text-slate-500 text-xs font-mono">{s.email}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <Pagination page={page} totalPages={totalPages} total={total} PER_PAGE={PER_PAGE} pageLink={pageLink} />
      </div>

      {/* МОБИЛЕН: карти */}
      <div className="md:hidden space-y-2">
        {staff.map((s: StaffProfile) => {
          const inner = (
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="font-medium text-slate-800 text-sm">{getFullName(s)}</div>
                <div className="text-xs text-slate-500 mt-0.5 truncate">{s.email}</div>
              </div>
              <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 flex-shrink-0">
                {ROLE_LABELS[s.role]}
              </span>
            </div>
          )
          return canOpenDetail ? (
            <Link key={s.id} href={`/staff/${s.id}`} className="block bg-white rounded-xl border border-slate-200 px-4 py-3 hover:shadow-sm transition-shadow">
              {inner}
            </Link>
          ) : (
            <div key={s.id} className="bg-white rounded-xl border border-slate-200 px-4 py-3">
              {inner}
            </div>
          )
        })}

        {/* Pagination мобилен */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between pt-2">
            <p className="text-xs text-slate-500">
              {(page - 1) * PER_PAGE + 1}–{Math.min(page * PER_PAGE, total)} от {total}
            </p>
            <div className="flex gap-2">
              {page > 1 && (
                <a href={pageLink(page - 1)} className="px-3 py-1.5 text-xs rounded-lg border border-slate-200 hover:bg-slate-50">← Пред.</a>
              )}
              {page < totalPages && (
                <a href={pageLink(page + 1)} className="px-3 py-1.5 text-xs rounded-lg border border-slate-200 hover:bg-slate-50">Следв. →</a>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function Pagination({ page, totalPages, total, PER_PAGE, pageLink }: {
  page: number, totalPages: number, total: number, PER_PAGE: number,
  pageLink: (p: number) => string
}) {
  if (totalPages <= 1) return null
  return (
    <div className="flex items-center justify-between px-4 py-3 border-t border-slate-100">
      <p className="text-xs text-slate-500">
        {(page - 1) * PER_PAGE + 1}–{Math.min(page * PER_PAGE, total)} от {total}
      </p>
      <div className="flex gap-1">
        {page > 1 && (
          <a href={pageLink(page - 1)} className="px-3 py-1.5 text-xs rounded-lg border border-slate-200 hover:bg-slate-50">← Предишна</a>
        )}
        {Array.from({ length: totalPages }, (_, i) => i + 1).map(p => (
          <a key={p} href={pageLink(p)}
            className={`px-3 py-1.5 text-xs rounded-lg border transition-colors ${p === page ? 'text-white' : 'border-slate-200 hover:bg-slate-50'}`}
            style={p === page ? { backgroundColor: '#0f2240', borderColor: '#0f2240' } : {}}>
            {p}
          </a>
        ))}
        {page < totalPages && (
          <a href={pageLink(page + 1)} className="px-3 py-1.5 text-xs rounded-lg border border-slate-200 hover:bg-slate-50">Следваща →</a>
        )}
      </div>
    </div>
  )
}
