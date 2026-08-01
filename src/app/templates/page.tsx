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
    <div className="p-4 md:p-8 max-w-4xl mx-auto">
      <BackButton />
      <div className="mb-6">
        <div className="flex items-center gap-2">
          <FolderOpen size={22} className="text-blue-500" />
          <h1 className="text-xl md:text-2xl font-semibold text-slate-800">Образци на документи</h1>
        </div>
        <p className="text-slate-500 text-sm mt-1">Изтеглете готов образец, попълнете го и го качете в досието на детето</p>
      </div>
      <TemplatesClient
        templates={templates || []}
        canManage={canManage}
        staffId={profile?.id || ''}
      />
    </div>
  )
}
