'use client'

// Началният комплект на ЕИС: ~70 PDF материала, които идват с приложението (public/materials-seed).
// Ръководството ги зарежда в библиотеката с един бутон — файловете се качват в кофата materials,
// а редовете получават seed_key, за да не се дублират. При ново издание „Обнови“ презаписва файловете и описанията.

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { PackagePlus, RefreshCw, Loader2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useToast } from '@/components/ui/Toast'
import { SEED_SOURCE } from './lib'
import type { Material, SeedItem, Source } from './lib'

export default function SeedLoader({ materials, sources, meId }: { materials: Material[]; sources: Source[]; meId: string }) {
  const supabase = createClient()
  const router = useRouter()
  const { toast } = useToast()
  const [items, setItems] = useState<SeedItem[] | null>(null)
  const [busy, setBusy] = useState<{ done: number; total: number } | null>(null)

  useEffect(() => {
    fetch('/materials-seed/manifest.json', { cache: 'no-store' })
      .then(r => r.ok ? r.json() : null).then(j => setItems(j?.items || [])).catch(() => setItems([]))
  }, [])

  if (!items || !items.length) return null
  const have = new Set(materials.map(m => m.seed_key).filter(Boolean))
  const missing = items.filter(i => !have.has(i.seed_key))
  const source = sources.find(s => s.name === SEED_SOURCE)

  async function blob(name: string) {
    const r = await fetch('/materials-seed/' + name, { cache: 'no-store' })
    if (!r.ok) throw new Error('Липсва файл ' + name)
    return r.blob()
  }

  async function run(all: boolean) {
    if (!source) { toast('Пуснете SQL файла 2026-10-11_materials_seed.sql', 'error'); return }
    const list = (all ? items! : missing).slice().reverse()   // най-новите са най-горе → обратен ред запазва реда от комплекта
    setBusy({ done: 0, total: list.length })
    let errors = 0
    for (let i = 0; i < list.length; i++) {
      const it = list[i]
      try {
        const pdf = await blob(it.file)
        const jpg = await blob(it.preview)
        const fp = `seed/${it.file}`, pp = `seed/${it.preview}`
        const u1 = await supabase.storage.from('materials').upload(fp, pdf, { contentType: 'application/pdf', upsert: all })
        if (u1.error && !/exists|Duplicate/i.test(u1.error.message)) throw u1.error
        const u2 = await supabase.storage.from('materials').upload(pp, jpg, { contentType: 'image/jpeg', upsert: all })
        if (u2.error && !/exists|Duplicate/i.test(u2.error.message)) throw u2.error
        const row = {
          title: it.title, description: it.description, kind: it.kind, areas: it.areas, source_id: source.id,
          file_path: fp, file_name: `${it.title}.pdf`, mime_type: 'application/pdf', size: pdf.size,
          preview_path: pp, pages: it.pages, seed_key: it.seed_key,
        }
        const res = have.has(it.seed_key)
          ? await supabase.from('materials').update(row).eq('seed_key', it.seed_key)
          : await supabase.from('materials').insert({ ...row, uploaded_by: meId })
        if (res.error) throw res.error
      } catch (e: any) {
        errors++
        console.error(it.seed_key, e)
      }
      setBusy({ done: i + 1, total: list.length })
    }
    setBusy(null)
    toast(errors ? `Готово, но ${errors} не се заредиха — опитайте отново` : 'Началният комплект е в библиотеката', errors ? 'error' : undefined)
    router.refresh()
  }

  if (busy) return (
    <div className="flex items-center gap-3 px-4 py-3 rounded-2xl bg-emerald-50 border border-emerald-200 text-sm text-emerald-900">
      <Loader2 size={16} className="animate-spin shrink-0" />
      Зареждам материалите… {busy.done} от {busy.total}
      <div className="flex-1 h-1.5 rounded-full bg-emerald-100 overflow-hidden"><div className="h-full bg-emerald-500 transition-all" style={{ width: `${(busy.done / busy.total) * 100}%` }} /></div>
    </div>
  )

  if (missing.length) return (
    <div className="flex flex-wrap items-center gap-3 px-4 py-3 rounded-2xl bg-emerald-50 border border-emerald-200">
      <PackagePlus size={20} className="text-emerald-700 shrink-0" />
      <div className="flex-1 min-w-[220px] text-sm text-emerald-900">
        <b className="font-semibold">Начален комплект на ЕИС</b> — {missing.length === items.length ? `${items.length} готови материала` : `още ${missing.length} от ${items.length} материала`} за печат: работни листове, табла за общуване, карти, социални истории, поредици за самообслужване. Свободни за ползване, включително за родители.
        <span className="block text-[12px] text-emerald-700/80 mt-0.5">Вижда го само ръководството.</span>
      </div>
      <button type="button" onClick={() => run(false)} className="px-4 py-2 rounded-xl text-white text-sm bg-emerald-700 hover:bg-emerald-800">Зареди в библиотеката</button>
    </div>
  )

  return (
    <div className="flex justify-end -mt-2">
      <button type="button" onClick={() => { if (confirm('Да се презапишат файловете и описанията на началния комплект с текущото издание?')) run(true) }}
        className="inline-flex items-center gap-1.5 text-[12px] text-slate-400 hover:text-slate-700">
        <RefreshCw size={12} /> Обнови началния комплект
      </button>
    </div>
  )
}
