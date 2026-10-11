// „Материали“ — обща библиотека на ЦСОП: колегите търсят, печатат и качват готови материали за децата.
// Лицензите не се показват: материал от източник с изтекъл срок просто не се вижда (ръководството го вижда с бележка).

import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { BackButton } from '@/components/ui/BackButton'
import { Library } from 'lucide-react'
import MaterialsClient from './MaterialsClient'
import { isImage, sourceValid } from './lib'
import type { Material, Source } from './lib'
export const dynamic = 'force-dynamic'

export default async function MaterialsPage({ searchParams }: { searchParams: Promise<{ area?: string }> }) {
  const sp = await searchParams
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')
  const { data: me } = await supabase.from('staff_profiles').select('id, role').eq('user_id', user.id).single()
  if (!me) redirect('/dashboard')
  const isManager = ['admin', 'zdud', 'director'].includes(me.role)

  const [{ data: mats, error }, { data: srcs }] = await Promise.all([
    supabase.from('materials').select('*').order('created_at', { ascending: false }),
    supabase.from('material_sources').select('*').order('sort').order('name'),
  ])
  const sources = (srcs || []) as Source[]
  const today = new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Sofia' })
  const srcOf = Object.fromEntries(sources.map(s => [s.id, s]))
  // колегите не виждат материали от изтекъл източник
  const materials = ((mats || []) as Material[]).filter(m => isManager || sourceValid(srcOf[m.source_id || ''], today))

  // кой е качил
  const ids = Array.from(new Set(materials.map(m => m.uploaded_by).filter(Boolean))) as string[]
  const { data: st } = ids.length ? await supabase.from('staff_profiles').select('id, first_name, last_name').in('id', ids) : { data: [] as any[] }
  const names: Record<string, string> = {}
  ;(st || []).forEach((s: any) => { names[s.id] = `${s.first_name} ${s.last_name}` })

  // малки картинки: превюто (ако има) или самото изображение; ключ — file_path на материала
  const thumbs: Record<string, string> = {}
  const thumbOf = new Map<string, string>()   // път на картинката → file_path
  materials.forEach(m => {
    if (m.preview_path) thumbOf.set(m.preview_path, m.file_path)
    else if (isImage(m)) thumbOf.set(m.file_path, m.file_path)
  })
  if (thumbOf.size) {
    const { data } = await supabase.storage.from('materials').createSignedUrls(Array.from(thumbOf.keys()), 60 * 60)
    ;(data || []).forEach((d: any) => { if (d.signedUrl && d.path && thumbOf.has(d.path)) thumbs[thumbOf.get(d.path)!] = d.signedUrl })
  }

  return (
    <div className="p-4 md:p-8 max-w-6xl mx-auto animate-in fade-in duration-500">
      <BackButton />
      <header className="flex items-center gap-4 mt-2 mb-6 pb-5 border-b border-slate-100">
        <div className="flex items-center justify-center shrink-0 w-12 h-12 rounded-xl bg-emerald-50 border border-emerald-100 text-emerald-700">
          <Library size={22} />
        </div>
        <div>
          <h1 className="text-xl md:text-2xl font-semibold text-slate-800 tracking-tight">Материали</h1>
          <p className="text-sm text-slate-500 mt-0.5">Готови материали за децата — търсете, печатайте и споделяйте своите</p>
        </div>
      </header>
      {error
        ? <div className="bg-amber-50 border border-amber-200 text-amber-800 text-sm rounded-2xl px-4 py-3">Материалите още не са подготвени в базата — пуснете SQL файла 2026-10-11_materials.sql.</div>
        : <MaterialsClient initialArea={sp.area || ''} materials={materials} sources={sources} names={names} thumbs={thumbs} meId={me.id} isManager={isManager} today={today} />}
    </div>
  )
}
