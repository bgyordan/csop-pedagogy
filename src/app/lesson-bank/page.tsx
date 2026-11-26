// „Банка с уроци“ — колегите споделят готови файлове (планове, презентации, работни листове) по предмет и възраст.
// Анонимно по подразбиране. Кой разглежда и тегли не се записва.

import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { BackButton } from '@/components/ui/BackButton'
import { Lightbulb } from 'lucide-react'
import LessonBankClient from './LessonBankClient'
import type { BankItem } from './lib'
export const dynamic = 'force-dynamic'

export default async function LessonBankPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')
  const { data: me } = await supabase.from('staff_profiles').select('id, role').eq('user_id', user.id).single()
  if (!me) redirect('/dashboard')
  const isManager = ['admin', 'zdud', 'director'].includes(me.role)
  const today = new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Sofia' })

  const [{ data: items, error }, { data: mine }, { data: used }, { data: camp }] = await Promise.all([
    supabase.from('lesson_bank_items').select('*').order('created_at', { ascending: false }),
    supabase.from('lesson_bank_owners').select('item_id'),        // RLS: само моите
    supabase.from('lesson_bank_uses').select('item_id'),          // RLS: само моите
    supabase.from('visit_campaigns').select('focus_subject, date_from, date_to')
      .lte('date_from', today).gte('date_to', today).not('focus_subject', 'is', null).limit(1),
  ])

  return (
    <div className="p-4 md:p-8 max-w-6xl mx-auto animate-in fade-in duration-500">
      <BackButton />
      <header className="flex items-center gap-4 mt-2 mb-6 pb-5 border-b border-slate-100">
        <div className="flex items-center justify-center shrink-0 w-12 h-12 rounded-xl bg-amber-50 border border-amber-100 text-amber-600">
          <Lightbulb size={22} />
        </div>
        <div>
          <h1 className="text-xl md:text-2xl font-semibold text-slate-800 tracking-tight">Банка с уроци</h1>
          <p className="text-sm text-slate-500 mt-0.5">Готови уроци и идеи от колегите — по предмет и възраст. Анонимно, никой не вижда кой какво отваря.</p>
        </div>
      </header>
      {error
        ? <div className="bg-amber-50 border border-amber-200 text-amber-800 text-sm rounded-2xl px-4 py-3">Банката още не е подготвена в базата — пуснете SQL файла 2026-11-26_lesson_bank.sql.</div>
        : <LessonBankClient
            items={(items || []) as BankItem[]}
            mine={(mine || []).map((r: any) => r.item_id)}
            used={(used || []).map((r: any) => r.item_id)}
            focus={(camp && camp[0]?.focus_subject) || ''}
            isManager={isManager} />}
    </div>
  )
}
