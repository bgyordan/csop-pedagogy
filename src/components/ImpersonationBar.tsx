import { cookies } from 'next/headers'
import { UserCheck, LogOut } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { getFullName } from '@/lib/utils'
import { IMP_COOKIE, parseImp } from '@/lib/impersonate'

// Лента на ВСЯКА страница, докато админът действа като друг служител
export default async function ImpersonationBar() {
  const imp = parseImp((await cookies()).get(IMP_COOKIE)?.value)
  if (!imp) return null
  const supabase = await createClient()
  const { data: p } = await supabase.from('staff_profiles')
    .select('first_name, middle_name, last_name, position').eq('user_id', imp.targetUserId).maybeSingle()
  const until = new Date(imp.until).toLocaleTimeString('bg-BG', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Sofia' })

  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-[100] max-w-[calc(100vw-2rem)] flex items-center gap-3 pl-4 pr-1.5 py-1.5 rounded-2xl border border-amber-200 bg-amber-50/95 backdrop-blur shadow-lg text-sm text-amber-900">
      <UserCheck size={16} className="text-amber-600 shrink-0" />
      <span className="truncate">
        Действаш като <b className="font-medium">{p ? getFullName(p) : 'друг служител'}</b>
        {p?.position && <span className="font-light"> · {p.position}</span>}
        <span className="text-xs text-amber-700 font-light"> · до {until} ч. · записите са реални</span>
      </span>
      {/* обикновен линк (не <Link>) — пълно презареждане, за да се смени сесията навсякъде */}
      <a href="/impersonate/stop"
        className="shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-amber-300 bg-white text-amber-900 hover:bg-amber-100">
        <LogOut size={13} /> Върни се
      </a>
    </div>
  )
}
