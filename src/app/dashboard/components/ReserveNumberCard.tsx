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
  { id: 'incoming', label: 'Входящ', icon: ArrowDownLeft },
  { id: 'outgoing', label: 'Изходящ', icon: ArrowUpRight },
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

  return (
    <div className="bg-white rounded-2xl border border-slate-200/70 p-5 shadow-sm">
      <div className="flex items-center gap-2 mb-4 pb-3 border-b border-slate-100">
        <Bookmark size={18} className="text-amber-500" />
        <h2 className="font-semibold text-slate-800 text-sm">Резервирай номер</h2>
      </div>
      <div className="flex gap-1.5 mb-3">
        {KINDS.map(k => {
          const Icon = k.icon
          const on = kind === k.id
          return (
            <button key={k.id} onClick={() => { setKind(k.id); setResult(null) }}
              className={`flex-1 inline-flex items-center justify-center gap-1.5 px-2 py-2 rounded-xl text-xs font-medium border transition-all ${
                on ? 'bg-[#0f2240] text-white border-[#0f2240]' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
              }`}>
              <Icon size={13} /> {k.label}
            </button>
          )
        })}
      </div>
      <input value={note} onChange={e => setNote(e.target.value)} placeholder="Бележка (по избор) — напр. за кого е"
        className="w-full px-3 py-2 mb-3 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-slate-400" />
      <button onClick={reserve} disabled={busy}
        className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-white text-sm font-medium hover:opacity-90 disabled:opacity-60" style={{ backgroundColor: '#0f2240' }}>
        {busy ? <Loader2 size={16} className="animate-spin" /> : <Bookmark size={16} />} Резервирай
      </button>
      {result && result !== 'Грешка' && (
        <div className="mt-3 flex items-center gap-2 px-4 py-3 rounded-xl bg-amber-50 border border-amber-200">
          <Check size={16} className="text-amber-600 shrink-0" />
          <div>
            <div className="text-[11px] text-amber-600">Резервиран номер:</div>
            <div className="text-lg font-semibold text-slate-800">{result}</div>
          </div>
        </div>
      )}
      {result === 'Грешка' && <div className="mt-3 text-sm text-rose-600">Грешка при резервиране.</div>}
    </div>
  )
}
