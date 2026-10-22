'use client'

// Списък на източниците: име, „може да се дава на родител“, валиден до, бележка (договор, номер, контакт).
// Изтекъл източник → материалите му се скриват за колегите.

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, Save, Loader2, Trash2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useToast, confirmDialog } from '@/components/ui/Toast'
import type { Source } from '../lib'

function Toggle({ on, onChange, yes, no }: { on: boolean; onChange: (v: boolean) => void; yes: string; no: string }) {
  return (
    <div className="inline-flex p-0.5 bg-slate-100 rounded-lg">
      <button type="button" onClick={() => onChange(false)} className={`px-2.5 py-1 rounded-md text-[12px] ${!on ? 'bg-white shadow-sm text-slate-800' : 'text-slate-500'}`}>{no}</button>
      <button type="button" onClick={() => onChange(true)} className={`px-2.5 py-1 rounded-md text-[12px] ${on ? 'bg-white shadow-sm text-emerald-700' : 'text-slate-500'}`}>{yes}</button>
    </div>
  )
}

export default function SourcesClient({ sources, counts }: { sources: Source[]; counts: Record<string, number> }) {
  const supabase = createClient()
  const router = useRouter()
  const { toast } = useToast()
  const [rows, setRows] = useState<Source[]>(sources)
  const [busy, setBusy] = useState<string | null>(null)
  const today = new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Sofia' })
  const set = (id: string, patch: Partial<Source>) => setRows(r => r.map(x => x.id === id ? { ...x, ...patch } : x))

  async function save(s: Source) {
    if (!s.name.trim()) { toast('Името е задължително', 'error'); return }
    setBusy(s.id)
    const row = { name: s.name.trim(), allow_parents: s.allow_parents, valid_until: s.valid_until || null, note: s.note || null, sort: s.sort }
    const { error } = s.id.startsWith('new-')
      ? await supabase.from('material_sources').insert(row)
      : await supabase.from('material_sources').update(row).eq('id', s.id)
    setBusy(null)
    if (error) { toast('Грешка: ' + error.message, 'error'); return }
    toast('Записано'); router.refresh()
  }
  async function remove(s: Source) {
    if (s.id.startsWith('new-')) { setRows(r => r.filter(x => x.id !== s.id)); return }
    if (counts[s.id]) { toast(`Има ${counts[s.id]} материала от този източник — не може да се изтрие`, 'error'); return }
    if (!await confirmDialog(`Да се изтрие ли „${s.name}“?`)) return
    const { error } = await supabase.from('material_sources').delete().eq('id', s.id)
    if (error) { toast(error.message, 'error'); return }
    setRows(r => r.filter(x => x.id !== s.id))
  }

  return (
    <div className="space-y-3">
      {rows.map(s => {
        const expired = !!s.valid_until && s.valid_until < today
        return (
          <div key={s.id} className={`bg-white rounded-2xl border shadow-sm px-5 py-4 space-y-3 ${expired ? 'border-rose-200' : 'border-slate-200'}`}>
            <div className="flex flex-wrap items-center gap-2">
              <input value={s.name} onChange={e => set(s.id, { name: e.target.value })} placeholder="напр. Boardmaker, Communicator, издателство…"
                className="flex-1 min-w-[200px] px-3 py-2 border border-slate-200 rounded-xl text-[14px] focus:outline-none focus:border-[#0f2240]" />
              <span className="text-[12px] text-slate-500">{counts[s.id] || 0} материала</span>
              {expired && <span className="text-[11px] px-2 py-0.5 rounded-full bg-rose-50 text-rose-700 border border-rose-200">изтекъл — скрит за колегите</span>}
            </div>
            <div className="flex flex-wrap items-center gap-4">
              <label className="flex items-center gap-2 text-[13px] text-slate-600">Даване на родител
                <Toggle on={s.allow_parents} onChange={v => set(s.id, { allow_parents: v })} yes="Да" no="Не" />
              </label>
              <label className="flex items-center gap-2 text-[13px] text-slate-600">Валиден до
                <input type="date" value={s.valid_until || ''} onChange={e => set(s.id, { valid_until: e.target.value || null })}
                  className="px-2 py-1 border border-slate-200 rounded-lg text-[13px]" />
                <span className="text-[11px] text-slate-400">празно = безсрочно</span>
              </label>
            </div>
            <textarea value={s.note || ''} onChange={e => set(s.id, { note: e.target.value })} rows={1} placeholder="бележка: договор №, срок, контакт…"
              className="w-full px-3 py-2 border border-slate-200 rounded-xl text-[13px] focus:outline-none focus:border-[#0f2240] resize-y" />
            <div className="flex items-center gap-2">
              <button type="button" onClick={() => save(s)} disabled={busy === s.id}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-white text-[13px] hover:opacity-90 disabled:opacity-50" style={{ backgroundColor: '#0f2240' }}>
                {busy === s.id ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />} Запази
              </button>
              <button type="button" onClick={() => remove(s)} className="ml-auto p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50"><Trash2 size={14} /></button>
            </div>
          </div>
        )
      })}
      <button type="button" onClick={() => setRows(r => [...r, { id: `new-${Date.now()}`, name: '', allow_parents: false, valid_until: null, note: null, sort: r.length + 1 }])}
        className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl border border-dashed border-slate-300 text-sm text-slate-600 hover:border-[#0f2240]">
        <Plus size={15} /> Нов източник
      </button>
    </div>
  )
}
