import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { BackButton } from '@/components/ui/BackButton'
import TemplatesClient from './TemplatesClient'
import { FolderOpen } from 'lucide-react'

export const dynamic = 'force-dynamic'

export default async function TemplatesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: profile } = await supabase
    .from('staff_profiles').select('id, role, is_coordinator').eq('user_id', user.id).single()
  const canManage = ['admin', 'zdud'].includes(profile?.role || '') || profile?.is_coordinator === true

  const { data: templates } = await supabase
    .from('document_templates')
    .select('*')
    .order('created_at', { ascending: false })

  return (
    <div className="p-4 md:p-8 max-w-5xl mx-auto animate-in fade-in duration-500">
      <BackButton />

      {/* Заглавна част */}
      <header className="flex items-center gap-4 mt-2 mb-7 pb-5 border-b border-slate-100">
        <div className="flex items-center justify-center shrink-0 w-12 h-12 rounded-xl bg-blue-50 border border-blue-100 shadow-sm text-blue-600">
          <FolderOpen size={22} strokeWidth={2} />
        </div>
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-slate-800 tracking-tight">Образци на документи</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Изтеглете готов образец, попълнете го в Word и го качете в досието на детето.
          </p>
        </div>
      </header>

      <TemplatesClient
        templates={templates || []}
        canManage={canManage}
        staffId={profile?.id || ''}
      />
    </div>
  )
}
