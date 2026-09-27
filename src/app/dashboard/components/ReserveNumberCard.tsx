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

  // Един ред: заглавие · вид · бележка · бутон · резултат (като плочките горе, не голяма карта)
  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm px-4 py-3">
      <div className="flex flex-wrap items-center gap-2.5">
        <div className="flex items-center gap-1.5 shrink-0">
          <Bookmark size={15} className="text-amber-500" />
          <span className="text-xs font-medium text-slate-500">Резервирай номер</span>
        </div>
        <div className="flex gap-1 p-0.5 rounded-lg bg-slate-100 shrink-0">
          {KINDS.map(k => {
            const Icon = k.icon
            const on = kind === k.id
            return (
              <button key={k.id} onClick={() => { setKind(k.id); setResult(null) }}
                className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] transition ${
                  on ? 'bg-white shadow-sm text-[#0f2240]' : 'text-slate-500 hover:text-slate-700'
                }`}>
                <Icon size={12} /> {k.label}
              </button>
            )
          })}
        </div>
        <input value={note} onChange={e => setNote(e.target.value)} placeholder="бележка (по избор) — за кого е"
          onKeyDown={e => { if (e.key === 'Enter' && !busy) reserve() }}
          className="flex-1 min-w-[160px] px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-[13px] focus:outline-none focus:border-slate-400" />
        <button onClick={reserve} disabled={busy}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-amber-200 bg-amber-50 text-amber-900 text-[13px] hover:bg-amber-100 disabled:opacity-60 shrink-0">
          {busy ? <Loader2 size={14} className="animate-spin" /> : <Bookmark size={14} />} Резервирай
        </button>
        {result && result !== 'Грешка' && (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-amber-50 border border-amber-200 text-sm text-slate-800 shrink-0">
            <Check size={14} className="text-amber-600" /> <b className="font-semibold">{result}</b>
          </span>
        )}
        {result === 'Грешка' && <span className="text-sm text-rose-600">Грешка при резервиране.</span>}
      </div>
    </div>
  )
}
