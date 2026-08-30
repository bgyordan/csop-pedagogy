'use client'
import { useState, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Search, Plus, X, Loader2, Check, ArrowRight, CalendarClock, UserX } from 'lucide-react'
import { useToast } from '@/components/ui/Toast'
import type { SubRow } from './page'

type Staff = { id: string; first_name: string; last_name: string }

function fmt(d: string) { return d ? d.split('-').reverse().join('.') : '—' }
function statusOf(r: SubRow): { label: string; cls: string } {
  if (r.hasOrder) return { label: 'Заповед издадена', cls: 'bg-emerald-50 text-emerald-600' }
  if (r.substituteId) return { label: 'Готово за заповед', cls: 'bg-blue-50 text-blue-600' }
  return { label: 'Чака заместник', cls: 'bg-amber-50 text-amber-600' }
}

function PersonCombo({ people, value, onChange, placeholder, excludeId }: {
  people: Staff[]; value: string; onChange: (id: string) => void; placeholder: string; excludeId?: string
}) {
  const [open, setOpen] = useState(false)
  const [q, setQ] = useState('')
  const selected = people.find(p => p.id === value)
  const list = people.filter(p => p.id !== excludeId)
    .filter(p => `${p.first_name} ${p.last_name}`.toLowerCase().includes(q.toLowerCase()))
    .sort((a, b) => a.first_name.localeCompare(b.first_name, 'bg')).slice(0, 40)
  return (
    <div className="relative">
      <input type="text" value={selected ? `${selected.first_name} ${selected.last_name}` : q}
        onChange={e => { setQ(e.target.value); onChange(''); setOpen(true) }}
        onFocus={() => setOpen(true)} onBlur={() => setTimeout(() => setOpen(false), 150)}
        placeholder={placeholder} className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-slate-400" />
      {selected && <button type="button" onMouseDown={e => e.preventDefault()} onClick={() => { onChange(''); setQ('') }}
        className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"><X size={14} /></button>}
      {open && !selected && (
        <div className="absolute z-30 mt-1 w-full max-h-52 overflow-y-auto bg-white border border-slate-200 rounded-xl shadow-lg">
          {list.map(p => (
            <button key={p.id} type="button" onMouseDown={e => e.preventDefault()}
              onClick={() => { onChange(p.id); setOpen(false); setQ('') }}
              className="w-full text-left px-3 py-1.5 text-sm hover:bg-slate-50 text-slate-700">{p.first_name} {p.last_name}</button>
          ))}
          {list.length === 0 && <div className="px-3 py-2 text-sm text-slate-400">Няма съвпадение</div>}
        </div>
      )}
    </div>
  )
}

export default function SubstitutionsClient({ rows: initial, staff }: { rows: SubRow[]; staff: Staff[] }) {
  const supabase = createClient()
  const { toast } = useToast()
  const [rows, setRows] = useState<SubRow[]>(initial)
  const [search, setSearch] = useState('')

  const [showNew, setShowNew] = useState(false)
  const [absentId, setAbsentId] = useState('')
  const [subId, setSubId] = useState('')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [reason, setReason] = useState('sick')
  const [saving, setSaving] = useState(false)

  const today = new Date().toISOString().split('T')[0]

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return rows
    return rows.filter(r => r.absentName.toLowerCase().includes(q) || (r.substituteName || '').toLowerCase().includes(q))
  }, [rows, search])

  async function saveNew() {
    if (!absentId || !from || !to) { toast('Отсъстващ и срок са задължителни', 'error'); return }
    setSaving(true)
    const { data, error } = await supabase.from('substitutions').insert({
      absent_staff_id: absentId,
      substitute_staff_id: subId || null,
      date_from: from, date_to: to, reason,
    }).select(`id, date_from, date_to, reason, substitute_staff_id, substitution_order_id,
      absent:staff_profiles!substitutions_absent_staff_id_fkey(first_name, last_name),
      sub:staff_profiles!substitutions_substitute_staff_id_fkey(first_name, last_name)`).single()
    if (error || !data) { toast('Грешка при запис', 'error'); setSaving(false); return }
    const r: any = data
    setRows(prev => [{
      id: r.id, absentName: r.absent ? `${r.absent.first_name} ${r.absent.last_name}` : '—',
      substituteName: r.sub ? `${r.sub.first_name} ${r.sub.last_name}` : null,
      substituteId: r.substitute_staff_id, dateFrom: r.date_from, dateTo: r.date_to,
      reason: r.reason, hasOrder: false,
    }, ...prev])
    toast('Заместването е добавено')
    setAbsentId(''); setSubId(''); setFrom(''); setTo(''); setReason('sick'); setShowNew(false); setSaving(false)
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <div className="relative flex-1 max-w-sm">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Търсене по име…"
            className="w-full pl-9 pr-3 py-2 bg-white border border-slate-200 rounded-full text-sm focus:outline-none focus:border-slate-400" />
        </div>
        {!showNew && (
          <button onClick={() => setShowNew(true)}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-white text-sm font-medium hover:opacity-90 shrink-0"
            style={{ backgroundColor: '#0f2240' }}><Plus size={16} /> Ново заместване</button>
        )}
      </div>

      {showNew && (
        <div className="bg-white rounded-2xl border border-slate-200 p-4 space-y-3 shadow-sm">
          <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
            <h3 className="text-sm font-semibold text-slate-800">Ново заместване (болничен / друго)</h3>
            <button onClick={() => setShowNew(false)} className="p-1 rounded-lg text-slate-400 hover:text-slate-600"><X size={16} /></button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-slate-500 mb-1">Отсъстващ *</label>
              <PersonCombo people={staff} value={absentId} onChange={setAbsentId} placeholder="Търси по име…" excludeId={subId} />
            </div>
            <div>
              <label className="block text-xs text-slate-500 mb-1">Заместник</label>
              <PersonCombo people={staff} value={subId} onChange={setSubId} placeholder="Търси по име…" excludeId={absentId} />
            </div>
            <div>
              <label className="block text-xs text-slate-500 mb-1">От *</label>
              <input type="date" value={from} min={today} onChange={e => { setFrom(e.target.value); if (to && e.target.value > to) setTo('') }}
                className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-slate-400" />
            </div>
            <div>
              <label className="block text-xs text-slate-500 mb-1">До *</label>
              <input type="date" value={to} min={from || today} onChange={e => setTo(e.target.value)}
                className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-slate-400" />
            </div>
            <div>
              <label className="block text-xs text-slate-500 mb-1">Причина</label>
              <select value={reason} onChange={e => setReason(e.target.value)}
                className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-slate-400 cursor-pointer">
                <option value="sick">Болничен</option>
                <option value="vacation">Отпуск</option>
                <option value="other">Друго</option>
              </select>
            </div>
          </div>
          <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
            <button onClick={() => setShowNew(false)} className="px-4 py-2 rounded-xl text-sm bg-white border border-slate-200 hover:bg-slate-100 text-slate-700">Отказ</button>
            <button onClick={saveNew} disabled={saving || !absentId || !from || !to}
              className="inline-flex items-center gap-2 px-5 py-2 rounded-xl text-sm font-medium text-white disabled:opacity-50 hover:opacity-90" style={{ backgroundColor: '#0f2240' }}>
              {saving ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />} Запази
            </button>
          </div>
        </div>
      )}

      {/* Заглавен ред */}
      <div className="hidden md:grid grid-cols-[1fr_1fr_90px_90px_150px_170px] gap-3 px-4 py-2">
        {['Отсъстващ', 'Заместник', 'От', 'До', 'Статус', ''].map((h, i) => (
          <span key={i} className="text-[10px] font-medium uppercase tracking-wider text-slate-400">{h}</span>
        ))}
      </div>

      {/* Редове */}
      <div className="space-y-2">
        {filtered.length === 0 ? (
          <div className="bg-white border border-dashed border-slate-300 rounded-2xl p-14 text-center">
            <CalendarClock size={32} className="mx-auto mb-2 text-slate-300" />
            <p className="text-sm text-slate-400">Няма замествания</p>
          </div>
        ) : filtered.map((r, idx) => {
          const st = statusOf(r)
          return (
            <div key={r.id}
              className={`bg-white border border-slate-200 rounded-2xl px-4 py-3 grid grid-cols-1 md:grid-cols-[1fr_1fr_90px_90px_150px_170px] gap-2 md:gap-3 md:items-center shadow-[0_1px_4px_rgba(15,34,64,0.06)] ${idx % 2 === 1 ? 'bg-slate-50/40' : ''}`}>
              <span className="text-sm text-slate-800">{r.absentName}</span>
              <span className="text-sm text-slate-600">
                {r.substituteName || <span className="inline-flex items-center gap-1 text-amber-500 text-xs"><UserX size={13} /> няма</span>}
              </span>
              <span className="text-xs text-slate-500">{fmt(r.dateFrom)}</span>
              <span className="text-xs text-slate-500">{fmt(r.dateTo)}</span>
              <span><span className={`inline-flex items-center text-[11px] px-2 py-0.5 rounded-full ${st.cls}`}>{st.label}</span></span>
              <div className="flex items-center justify-end">
                {r.substituteId && !r.hasOrder && (
                  <button className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-white text-xs font-medium hover:opacity-90" style={{ backgroundColor: '#0f2240' }}>
                    Генерирай заповед <ArrowRight size={13} />
                  </button>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
