'use client'
import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Bookmark, Loader2, Check, ArrowDownLeft, ArrowUpRight, ClipboardList } from 'lucide-react'

function deloYearBounds(ref: Date): { start: string; end: string } {
  const y = ref.getFullYear(), m = ref.getMonth() + 1, d = ref.getDate()
  const afterStart = m > 9 || (m === 9 && d >= 15)
  const sy = afterStart ? y : y - 1
  const iso = (yy: number, mm: number, dd: number) => `${yy}-${String(mm).padStart(2, '0')}-${String(dd).padStart(2, '0')}`
  return { start: iso(sy, 9, 15), end: iso(sy + 1, 9, 14) }
}

type Kind = 'incoming' | 'outgoing' | 'order'
const KINDS: { id: Kind; label: string; icon: any }[] = [
  { id: 'incoming', label: 'Вх.', icon: ArrowDownLeft },
  { id: 'outgoing', label: 'Изх.', icon: ArrowUpRight },
  { id: 'order', label: 'Заповед', icon: ClipboardList },
]

export default function ReserveNumberCard({ profileId }: { profileId: string }) {
  const supabase = createClient()
  const [kind, setKind] = useState<Kind>('incoming')
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<string | null>(null)
  const [note, setNote] = useState('')

  async function nextSeq(): Promise<number> {
    const { start, end } = deloYearBounds(new Date())
    if (kind === 'order') {
      const { data } = await supabase.from('orders').select('seq').gte('date', start).lte('date', end).order('seq', { ascending: false, nullsFirst: false }).limit(1)
      return (data?.[0]?.seq ?? 0) + 1
    }
    const { data } = await supabase.from('correspondence').select('seq').eq('direction', kind).gte('date', start).lte('date', end).order('seq', { ascending: false, nullsFirst: false }).limit(1)
    return (data?.[0]?.seq ?? 0) + 1
  }

  async function reserve() {
    setBusy(true); setResult(null)
    const seq = await nextSeq()
    const today = new Date()
    const dateISO = today.toISOString().split('T')[0]
    const number = `${String(seq).padStart(3, '0')}/${dateISO.split('-').reverse().join('.')}г.`
    try {
      if (kind === 'order') {
        await supabase.from('orders').insert({ number, date: dateISO, title: 'Резервиран номер', description: note.trim() || null, seq, is_reserved: true, created_by: profileId })
      } else {
        await supabase.from('correspondence').insert({ number, date: dateISO, direction: kind, subject: 'Резервиран номер', description: note.trim() || null, seq, is_reserved: true, created_by: profileId })
      }
      setResult(number); setNote('')
    } catch (e) { setResult('Грешка') }
    setBusy(false)
  }

  // Плочка като останалите в таблото: вид · бележка · бутон; резервираният номер излиза едро
  return (
    <div className="flex flex-col bg-white px-5 py-5 min-h-[160px] rounded-xl border border-slate-200 shadow-sm">
      <div className="flex items-center gap-1.5 text-xs font-medium text-slate-500 mb-2">
        <Bookmark size={13} className="text-amber-500" /> Резервирай номер
      </div>
      <div className="flex gap-1 p-0.5 rounded-lg bg-slate-100 mb-2">
        {KINDS.map(k => {
          const Icon = k.icon
          const on = kind === k.id
          return (
            <button key={k.id} onClick={() => { setKind(k.id); setResult(null) }}
              className={`flex-1 inline-flex items-center justify-center gap-1 px-1 py-1 rounded-md text-[11px] transition ${
                on ? 'bg-white shadow-sm text-[#0f2240]' : 'text-slate-500 hover:text-slate-700'
              }`}>
              <Icon size={11} /> {k.label}
            </button>
          )
        })}
      </div>
      {result && result !== 'Грешка' ? (
        <button onClick={() => setResult(null)} title="Нов резерв"
          className="flex-1 flex flex-col items-start justify-center text-left">
          <span className="text-[11px] text-amber-600 inline-flex items-center gap-1"><Check size={12} /> резервиран</span>
          <span className="text-2xl font-medium text-slate-800 tracking-tight">{result}</span>
        </button>
      ) : (
        <>
          <input value={note} onChange={e => setNote(e.target.value)} placeholder="бележка — за кого е"
            onKeyDown={e => { if (e.key === 'Enter' && !busy) reserve() }}
            className="w-full px-2.5 py-1.5 mb-2 bg-white border border-slate-200 rounded-lg text-[13px] focus:outline-none focus:border-slate-400" />
          <button onClick={reserve} disabled={busy}
            className="mt-auto w-full inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg border border-amber-200 bg-amber-50 text-amber-900 text-[13px] hover:bg-amber-100 disabled:opacity-60">
            {busy ? <Loader2 size={14} className="animate-spin" /> : <Bookmark size={14} />} Резервирай
          </button>
          {result === 'Грешка' && <span className="mt-1 text-xs text-rose-600">Грешка при резервиране.</span>}
        </>
      )}
    </div>
  )
}
