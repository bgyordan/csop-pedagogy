'use client'
// „Към ПС“: качва генерирания Word в „Материали за съгласуване“ (комплект за педагогически съвет),
// където служителите го четат и натискат „Запознах се“.
import { useState } from 'react'
import Link from 'next/link'
import { Send, Loader2, X, Check } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useToast } from '@/components/ui/Toast'
import DateInput from '@/components/ui/DateInput'
import { dmy } from '@/lib/control'

const BUCKET = 'council-materials'
type CSet = { id: string; title: string; event_date: string | null }

export default function CouncilSend({ make, meId, label = 'Към ПС', desc }: { make: () => Promise<{ blob: Blob; file: string }>; meId: string; label?: string; desc?: string }) {
  const { toast } = useToast()
  const supabase = createClient()
  const [open, setOpen] = useState(false)
  const [sets, setSets] = useState<CSet[] | null>(null)
  const [setId, setSetId] = useState<string>('')
  const [title, setTitle] = useState('Педагогически съвет')
  const [date, setDate] = useState('')
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState<string | null>(null)

  async function start() {
    setOpen(true); setDone(null)
    const { data, error } = await supabase.from('council_sets').select('id, title, event_date').eq('is_archived', false)
      .order('event_date', { ascending: false, nullsFirst: false }).limit(20)
    if (error) { toast('„Материали за съгласуване“ не са достъпни', 'error'); setOpen(false); return }
    setSets(data || []); setSetId((data || [])[0]?.id || 'new')
  }

  async function send() {
    setBusy(true)
    try {
      const me = meId
      let target = setId
      if (target === 'new') {
        if (!title.trim()) throw new Error('Попълнете заглавие')
        const { data, error } = await supabase.from('council_sets').insert({ title: title.trim(), event_date: date || null, created_by: me }).select('id').single()
        if (error || !data) throw new Error(error?.message || 'Грешка при създаване на комплекта')
        target = data.id
      }
      const { blob, file } = await make()
      const safe = file.normalize('NFKD').replace(/[^a-zA-Z0-9._-]/g, '_').replace(/_+/g, '_')
      const path = `${target}/${Date.now()}_${safe}`
      const { error: up } = await supabase.storage.from(BUCKET).upload(path, blob, { contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' })
      if (up) throw new Error(up.message)
      const { error: db } = await supabase.from('council_files').insert({
        set_id: target, name: file, description: desc || null, path, size: blob.size,
        mime_type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', uploaded_by: me,
      })
      if (db) { await supabase.storage.from(BUCKET).remove([path]); throw new Error(db.message) }
      setDone(target)
    } catch (e: any) { toast(e.message || 'Грешка', 'error') }
    setBusy(false)
  }

  return (
    <>
      <button type="button" onClick={start} className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm border border-slate-200 hover:bg-slate-50"><Send size={14} /> {label}</button>
      {open && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 flex items-center justify-center p-4" onClick={() => setOpen(false)}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-5 space-y-3" onClick={e => e.stopPropagation()}>
            <div className="flex items-center"><h3 className="flex-1 text-base text-slate-800">Към педагогическия съвет</h3><button type="button" onClick={() => setOpen(false)} className="p-1.5 text-slate-400"><X size={16} /></button></div>
            {done ? (
              <div className="space-y-3">
                <p className="text-sm text-emerald-700 inline-flex items-center gap-1.5"><Check size={15} /> Документът е качен в „Материали за съгласуване“.</p>
                <div className="flex justify-end gap-2"><Link href="/council" className="btn-secondary">Отвори</Link><button type="button" onClick={() => setOpen(false)} className="btn-primary">Готово</button></div>
              </div>
            ) : (
              <>
                <p className="text-sm text-slate-500">Документът отива в „Материали за съгласуване“ — служителите го четат и натискат „Запознах се“.</p>
                {sets === null ? <Loader2 size={16} className="animate-spin text-slate-400" /> : (
                  <select className="input w-full" value={setId} onChange={e => setSetId(e.target.value)}>
                    {sets.map(s => <option key={s.id} value={s.id}>{s.title}{s.event_date ? ` — ${dmy(s.event_date)}` : ''}</option>)}
                    <option value="new">+ Нов комплект…</option>
                  </select>
                )}
                {setId === 'new' && (
                  <div className="grid grid-cols-[1fr_150px] gap-2">
                    <input className="input" value={title} onChange={e => setTitle(e.target.value)} placeholder="Заглавие" />
                    <DateInput value={date} onChange={setDate} placeholder="дата на ПС" />
                  </div>
                )}
                <div className="flex justify-end gap-2">
                  <button type="button" onClick={() => setOpen(false)} className="btn-secondary">Отказ</button>
                  <button type="button" onClick={send} disabled={busy || sets === null} className="btn-primary inline-flex items-center gap-1.5">{busy && <Loader2 size={14} className="animate-spin" />} Изпрати</button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  )
}
