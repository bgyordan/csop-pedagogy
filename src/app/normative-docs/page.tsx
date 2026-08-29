import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { BackButton } from '@/components/ui/BackButton'
import { ScrollText } from 'lucide-react'
import NormativeDocsClient from './NormativeDocsClient'
export const dynamic = 'force-dynamic'
export interface NormDoc {
  id: string
  name: string
  file_url: string
  academic_year: string | null
  sort_order: number
}
export default async function NormativeDocsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')
  const { data } = await supabase
    .from('site_documents')
    .select('id, name, file_url, academic_year, sort_order')
    .eq('section', 'internal')
    .order('academic_year', { ascending: false })
    .order('sort_order', { ascending: true })
  const docs: NormDoc[] = data || []
  return (
    <div className="p-4 md:p-8 max-w-4xl mx-auto animate-in fade-in duration-500">
      <BackButton />
      <header className="flex items-center gap-4 mt-2 mb-7 pb-5 border-b border-slate-100">
        <div className="flex items-center justify-center shrink-0 w-12 h-12 rounded-xl bg-blue-50 border border-blue-100 shadow-sm text-blue-600">
          <ScrollText size={22} strokeWidth={2} />
        </div>
        <div>
          <h1 className="text-xl md:text-2xl font-semibold text-slate-800 tracking-tight">Нормативни документи</h1>
          <p className="text-sm text-slate-500 mt-0.5">Правилници, стратегии и планове на центъра</p>
        </div>
      </header>
      <NormativeDocsClient docs={docs} />
    </div>
  )
}
