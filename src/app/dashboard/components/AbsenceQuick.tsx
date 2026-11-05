'use client'
// Бързо отразяване на отсъствия от таблото (без заповеди и заместници — те са в „Замествания“).
//  • mode="desk" — деловодството (Ванина, Марина — болничните): карта „Отсъствия“ с „+ Отсъствие“ за всеки колега;
//  • mode="self" — ръководството: бутон „Отсъствам“ в картата „Днес отсъстват“, само за себе си;
//    директорът посочва кой изпълнява функциите на директор (излиза на листчето „замества: …“).
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, Pencil, Trash2, X, Loader2, UserX } from 'lucide-react'
import { smartMatch } from '@/lib/search'
import { useToast, confirmDialog } from '@/components/ui/Toast'
import { saveQuickAbsence, deleteQuickAbsence, type QuickAbsence, type AbsenceKind } from '../absence-actions'

type Person = { id: string; first_name: string; last_name: string; role?: string | null }
const dm = (iso: string) => iso.split('-').reverse().slice(0, 2).join('.')
const period = (a: string, b: string) => (a === b ? dm(a) : `${dm(a)} – ${dm(b)}`)
const todayIso = () => {
  const n = new Date(new Date().toLocaleString('en-US', { timeZone: 'Europe/Sofia' }))
  return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}-${String(n.getDate()).padStart(2, '0')}`
}
const inp = 'w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-slate-400'

function PersonCombo({ people, value, onChange, placeholder, excludeId }: {
  people: Person[]; value: string; onChange: (id: string) => void; placeholder: string; excludeId?: string
}) {
  const [open, setOpen] = useState(false)
  const [q, setQ] = useState('')
  const selected = people.find(p => p.id === value)
  const list = people.filter(p => p.id !== excludeId).filter(p => smartMatch(`${p.first_name} ${p.last_name}`, q))
    .sort((a, b) => a.first_name.localeCompare(b.first_name, 'bg')).slice(0, 40)
  return (
    <div className="relative">
      <input type="text" value={selected ? `${selected.first_name} ${selected.last_name}` : q}
        onChange={e => { setQ(e.target.value); onChange(''); setOpen(true) }}
        onFocus={() => setOpen(true)} onBlur={() => setTimeout(() => setOpen(false), 150)}
        placeholder={placeholder} className={inp} />
      {selected && <button type="button" onMouseDown={e => e.preventDefault()} onClick={() => { onChange(''); setQ('') }}
        className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"><X size={14} /></button>}
      {open && !selected && (
        <div className="absolute z-30 mt-1 w-full max-h-52 overflow-y-auto bg-white border border-slate-200 rounded-xl shadow-lg">
          {list.map(p => (
            <button key={p.id} type="button" onMouseDown={e => e.preventDefault()} onClick={() => { onChange(p.id); setOpen(false); setQ('') }}
              className="w-full text-left px-3 py-1.5 text-sm hover:bg-slate-50 text-slate-700">{p.first_name} {p.last_name}</button>
          ))}
          {list.length === 0 && <div className="px-3 py-2 text-sm text-slate-400">Няма съвпадение</div>}
        </div>
      )}
    </div>
  )
}

export default function AbsenceQuick({ mode, me, people, rows }: {
  mode: 'desk' | 'self'
  me: { id: string; role: string }
  people: Person[]          // активните служители (за избора на колега / на изпълняващ функциите на директор)
  rows: QuickAbsence[]      // текущите и предстоящите (при self — само моите)
}) {
  const router = useRouter()
  const { toast } = useToast()
  const [open, setOpen] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [staffId, setStaffId] = useState(mode === 'self' ? me.id : '')
  const [from, setFrom] = useState(todayIso())
  const [to, setTo] = useState(todayIso())
  // причината не се показва никъде — записва се като „Друго“ (член от КТ, ако трябва — в „Замествания“)
  const kind: AbsenceKind = 'other'
  const [acting, setActing] = useState('')
  const [busy, setBusy] = useState(false)

  const roleOf = (id: string) => people.find(p => p.id === id)?.role || (id === me.id ? me.role : '')
  const isDirector = roleOf(staffId) === 'director'
  const editing = editId ? rows.find(r => r.id === editId) : null
  const locked = !!editing && !editing.editable   // със заместник/заповед — само „кой изпълнява функциите на директор“

  function reset() {
    setOpen(false); setEditId(null); setStaffId(mode === 'self' ? me.id : ''); setFrom(todayIso()); setTo(todayIso())
    setActing('')
  }
  function startEdit(r: QuickAbsence) {
    setEditId(r.id); setStaffId(r.staffId); setFrom(r.from); setTo(r.to); setActing(r.actingId || ''); setOpen(true)
  }
  async function save() {
    setBusy(true)
    const res: any = await saveQuickAbsence({ id: editId || undefined, staffId, from, to, kind, actingId: isDirector ? (acting || null) : null })
    setBusy(false)
    if (res.error) { toast(res.error, 'error'); return }
    toast(editId ? 'Записано' : 'Отсъствието е отразено')
    reset(); router.refresh()
  }
  async function del(r: QuickAbsence) {
    if (!await confirmDialog(`Да махна ли отсъствието на ${r.name} (${period(r.from, r.to)})?`)) return
    const res: any = await deleteQuickAbsence(r.id)
    if (res.error) { toast(res.error, 'error'); return }
    toast('Махнато'); router.refresh()
  }

  const form = open && (
    <div className="mt-3 p-3 rounded-xl border border-slate-200 bg-slate-50/50 space-y-2.5">
      {mode === 'desk' && (
        <div>
          <label className="block text-[11px] text-slate-500 mb-1">Колега</label>
          {editId
            ? <div className="px-3 py-2 text-sm text-slate-800">{editing?.name}</div>
            : <PersonCombo people={people} value={staffId} onChange={setStaffId} placeholder="Търси по име…" />}
        </div>
      )}
      <div className="grid grid-cols-2 gap-2">
        <div><label className="block text-[11px] text-slate-500 mb-1">От</label>
          <input type="date" value={from} disabled={locked} onChange={e => { setFrom(e.target.value); if (to < e.target.value) setTo(e.target.value) }} className={inp} /></div>
        <div><label className="block text-[11px] text-slate-500 mb-1">До</label>
          <input type="date" value={to} min={from} disabled={locked} onChange={e => setTo(e.target.value)} className={inp} /></div>
      </div>
      {isDirector && (
        <div>
          <label className="block text-[11px] text-slate-500 mb-1">Замества ме като директор (по заповедта за ролята)</label>
          <PersonCombo people={people} value={acting} onChange={setActing} placeholder="Търси по име…" excludeId={staffId} />
        </div>
      )}
      {locked && <p className="text-[11px] text-slate-400">Има заместник или заповед — датите се променят в „Замествания“.</p>}
      <div className="flex justify-end gap-2">
        <button type="button" onClick={reset} className="px-3 py-1.5 rounded-lg border border-slate-200 text-[13px] text-slate-600 bg-white">Отказ</button>
        <button type="button" onClick={save} disabled={busy || !staffId}
          className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-white text-[13px] disabled:opacity-50" style={{ backgroundColor: '#0f2240' }}>
          {busy && <Loader2 size={13} className="animate-spin" />} Запази
        </button>
      </div>
    </div>
  )

  const list = rows.length > 0 && (
    <div className="mt-2 divide-y divide-slate-100">
      {rows.map(r => (
        <div key={r.id} className="flex items-center gap-2 py-1.5 group">
          <div className="min-w-0 flex-1">
            <div className="text-[13px] text-slate-800 truncate">
              {mode === 'desk' ? r.name : 'Отсъствам'}
              <span className="text-slate-400"> · {period(r.from, r.to)}</span>
            </div>
            <div className="text-[11.5px] text-slate-400 truncate">
              {r.actingName && <>замества като директор: {r.actingName}</>}
              {!r.editable && <>{r.actingName ? ' · ' : ''}със заместник — в „Замествания“</>}
            </div>
          </div>
          {(r.editable || r.role === 'director') && (
            <button type="button" onClick={() => startEdit(r)} title="Промени" className="p-1 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-100"><Pencil size={13} /></button>
          )}
          {r.editable && (
            <button type="button" onClick={() => del(r)} title="Махни" className="p-1 rounded-md text-slate-400 hover:text-rose-600 hover:bg-rose-50"><Trash2 size={13} /></button>
          )}
        </div>
      ))}
    </div>
  )

  if (mode === 'self') {
    return (
      <div className="mt-3 pt-3 border-t border-slate-100">
        {!open && (
          <button type="button" onClick={() => { reset(); setOpen(true) }}
            className="inline-flex items-center gap-1.5 text-[12.5px] text-slate-600 hover:text-[#0f2240]"><UserX size={13} /> Отсъствам</button>
        )}
        {form}
        {list}
      </div>
    )
  }

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4">
      <div className="flex items-center gap-2">
        <UserX size={15} className="text-slate-400" />
        <span className="text-sm text-slate-700">Отсъствия</span>
        <span className="text-xs text-slate-400">{rows.length || ''}</span>
        {!open && (
          <button type="button" onClick={() => { reset(); setOpen(true) }}
            className="ml-auto inline-flex items-center gap-1 text-[12.5px] px-2.5 py-1 rounded-lg border border-slate-300 text-slate-700 hover:border-[#0f2240]">
            <Plus size={13} /> Отсъствие
          </button>
        )}
      </div>
      {form}
      {list || (!open && <p className="mt-2 text-[12.5px] text-slate-400">Няма текущи отсъствия.</p>)}
      <p className="mt-2 text-[11px] text-slate-400">Колегите виждат на листчето „Днес отсъстват“ кой го няма (без причината). Заместниците и заповедите — в „Замествания“.</p>
    </div>
  )
}
