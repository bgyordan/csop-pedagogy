import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { ROLE_LABELS, UserRole } from '@/types'
import { getFullName } from '@/lib/utils'
import { UserCircle } from 'lucide-react'

export default async function StaffPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: staff } = await supabase
    .from('staff_profiles')
    .select('*')
    .eq('is_active', true)
    .order('last_name')

  const grouped = staff?.reduce((acc, s) => {
    const role = s.role as UserRole
    if (!acc[role]) acc[role] = []
    acc[role].push(s)
    return acc
  }, {} as Record<UserRole, typeof staff>)

  return (
    <div className="p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-slate-800">Служители</h1>
        <p className="text-slate-500 text-sm mt-1">{staff?.length || 0} активни служители</p>
      </div>

      <div className="space-y-6">
        {Object.entries(ROLE_LABELS).map(([role, label]) => {
          const members = grouped?.[role as UserRole]
          if (!members?.length) return null
          return (
            <div key={role} className="card">
              <h2 className="font-medium text-slate-700 text-sm mb-4 pb-3 border-b border-slate-100">
                {label} <span className="text-slate-400 font-normal">({members.length})</span>
              </h2>
              <div className="grid grid-cols-3 gap-3">
                {members.map(member => (
                  <div key={member.id} className="flex items-center gap-3 p-3 rounded-lg bg-slate-50">
                    <div className="w-10 h-10 rounded-full bg-slate-200 flex items-center justify-center text-slate-600 text-sm font-medium overflow-hidden flex-shrink-0">
                      {member.photo_url
                        ? <img src={member.photo_url} alt="" className="w-full h-full object-cover" />
                        : member.first_name.charAt(0) + member.last_name.charAt(0)
                      }
                    </div>
                    <div className="overflow-hidden">
                      <div className="text-sm font-medium text-slate-800 truncate">{getFullName(member)}</div>
                      <div className="text-xs text-slate-400 truncate">{member.position || member.email}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
