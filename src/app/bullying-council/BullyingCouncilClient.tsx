'use client'
import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { ShieldAlert, Crown, User, Plus, X, Loader2, UserPlus } from 'lucide-react'

interface Member { id: string; staff_id: string | null; name: string; position: string | null; is_chair: boolean; sort: number }
interface Staff { id: string; first_name: string; last_name: string; position: string | null }

function PersonCombo({ people, value, onChange, placeholder }: { people: Staff[]; value: string; onChange: (id: string) => void; placeholder: string }) {
  const [open, setOpen] = useState(false)
  const [q, setQ] = useState('')
  const selected = people.find(p => p.id === value)
  const list = people
    .filter(p => `${p.first_name} ${p.last_name}`.toLowerCase().includes(q.toLowerCase()))
    .sort((a, b) => `${a.first_name} ${a.last_name}`.localeCompare(`${b.first_name} ${b.last_name}`, 'bg')).slice(0, 40)
  return (
    <div className="relative">
      <input type="text" value={selected ? `${selected.first_name} ${selected.last_name}` : q}
        onChange={e => { setQ(e.target.value); onChange(''); setOpen(true) }}
        onFocus={() => setOpen(true)} onBlur={() => setTimeout(() => setOpen(false), 150)}
        placeholder={placeholder} className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-slate-400" />
      {selected && <button type="button" onMouseDown={e => e.preventDefault()} onClick={() => { onChange(''); setQ('') }}
        className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"><X size={14} /></button>}
      {open && !selected && (
        <div className="absolute z-30 mt-1 w-full max-h-52 overflow-y-auto bg-white border border-slate-200 rounded-xl shadow-lg">
          {list.map(p => (
            <button key={p.id} type="button" onMouseDown={e => e.preventDefault()} onClick={() => { onChange(p.id); setOpen(false); setQ('') }}
              className="w-full text-left px-3 py-1.5 text-sm hover:bg-slate-50 text-slate-700">{p.first_name} {p.last_name}{p.position ? ` · ${p.position}` : ''}</button>
          ))}
          {list.length === 0 && <div className="px-3 py-2 text-sm text-slate-400">Няма съвпадение</div>}
        </div>
      )}
    </div>
  )
}

export default function BullyingCouncilClient({ isManager, members, staff, academicYearId, yearName }: {
  isManager: boolean; members: Member[]; staff: Staff[]; academicYearId: string | null; yearName: string
}) {
  const supabase = createClient()
  const router = useRouter()
  const [list, setList] = useState<Member[]>(members)
  const [busy, setBusy] = useState(false)
  const [addStaffId, setAddStaffId] = useState('')
  const [extName, setExtName] = useState('')
  const [extPos, setExtPos] = useState('')

  const usedStaff = new Set(list.map(m => m.staff_id).filter(Boolean))
  const freeStaff = staff.filter(s => !usedStaff.has(s.id))

  async function reload() {
    const { data } = await supabase.from('bullying_council_members')
      .select('id, staff_id, name, position, is_chair, sort')
      .eq('academic_year_id', academicYearId).order('is_chair', { ascending: false }).order('sort').order('name')
    setList(data || [])
  }

  async function addStaff() {
    if (!addStaffId) return
    const s = staff.find(x => x.id === addStaffId); if (!s) return
    setBusy(true)
    await supabase.from('bullying_council_members').insert({
      academic_year_id: academicYearId, staff_id: s.id,
      name: `${s.first_name} ${s.last_name}`, position: s.position || '', is_chair: false, sort: list.length,
    })
    setAddStaffId(''); await reload(); setBusy(false); router.refresh()
  }
  async function addExternal() {
    if (!extName.trim()) return
    setBusy(true)
    await supabase.from('bullying_council_members').insert({
      academic_year_id: academicYearId, staff_id: null,
      name: extName.trim(), position: extPos.trim() || '', is_chair: false, sort: list.length,
    })
    setExtName(''); setExtPos(''); await reload(); setBusy(false); router.refresh()
  }
  async function remove(id: string) {
    setBusy(true)
    await supabase.from('bullying_council_members').delete().eq('id', id)
    await reload(); setBusy(false); router.refresh()
  }
  async function setChair(id: string) {
    setBusy(true)
    // само един председател
    await supabase.from('bullying_council_members').update({ is_chair: false }).eq('academic_year_id', academicYearId)
    await supabase.from('bullying_council_members').update({ is_chair: true }).eq('id', id)
    await reload(); setBusy(false); router.refresh()
  }

  const chair = list.find(m => m.is_chair)
  const others = list.filter(m => !m.is_chair)

  return (
    <div className="p-4 md:p-8 max-w-3xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <div className="p-2.5 rounded-xl" style={{ backgroundColor: '#0f2240' }}><ShieldAlert size={20} className="text-white" /></div>
        <div>
          <h1 className="text-xl md:text-2xl font-semibold text-slate-800">Координационен съвет</h1>
          <p className="text-slate-500 text-sm mt-0.5">{yearName} · противодействие на тормоза и насилието</p>
        </div>
      </div>

      {/* Състав */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 mb-4">
        <h3 className="text-sm font-semibold text-slate-800 mb-3">Състав</h3>
        {list.length === 0 && <p className="text-sm text-slate-400 mb-3">Още няма зададен състав.</p>}

        <div className="space-y-1.5">
          {chair && (
            <div className="flex items-center justify-between gap-3 px-3 py-2 rounded-xl bg-amber-50/60 border border-amber-200">
              <div className="flex items-center gap-2 min-w-0">
                <Crown size={15} className="text-amber-500 shrink-0" />
                <span className="text-sm font-medium text-slate-800 truncate">{chair.name}</span>
                {chair.position && <span className="text-xs text-slate-500 truncate">· {chair.position}</span>}
                <span className="text-[10px] text-amber-700 bg-amber-100 px-1.5 py-0.5 rounded shrink-0">председател</span>
              </div>
              {isManager && <button onClick={() => remove(chair.id)} disabled={busy} className="text-slate-400 hover:text-rose-500 p-1"><X size={14} /></button>}
            </div>
          )}
          {others.map(m => (
            <div key={m.id} className="flex items-center justify-between gap-3 px-3 py-2 rounded-xl bg-slate-50 border border-slate-100">
              <div className="flex items-center gap-2 min-w-0">
                <User size={14} className="text-slate-400 shrink-0" />
                <span className="text-sm text-slate-700 truncate">{m.name}</span>
                {m.position && <span className="text-xs text-slate-400 truncate">· {m.position}</span>}
                {!m.staff_id && <span className="text-[10px] text-slate-400 bg-white border border-slate-200 px-1.5 py-0.5 rounded shrink-0">външен</span>}
              </div>
              {isManager && (
                <div className="flex items-center gap-1 shrink-0">
                  <button onClick={() => setChair(m.id)} disabled={busy} title="Направи председател" className="text-slate-400 hover:text-amber-500 p-1"><Crown size={13} /></button>
                  <button onClick={() => remove(m.id)} disabled={busy} title="Премахни" className="text-slate-400 hover:text-rose-500 p-1"><X size={14} /></button>
                </div>
              )}
            </div>
          ))}
        </div>

        {isManager && (
          <div className="mt-4 pt-3 border-t border-slate-100 space-y-3">
            <div className="flex flex-wrap items-end gap-2">
              <div className="flex-1 min-w-[200px]">
                <label className="block text-[10px] font-medium text-slate-400 uppercase tracking-wide mb-1">Добави служител</label>
                <PersonCombo people={freeStaff} value={addStaffId} onChange={setAddStaffId} placeholder="Търси колега по име..." />
              </div>
              <button onClick={addStaff} disabled={busy || !addStaffId}
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm font-medium text-white disabled:opacity-50" style={{ backgroundColor: '#0f2240' }}>
                {busy ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />} Добави
              </button>
            </div>
            <div className="flex flex-wrap items-end gap-2">
              <div className="flex-1 min-w-[140px]">
                <label className="block text-[10px] font-medium text-slate-400 uppercase tracking-wide mb-1">Външен член — име</label>
                <input value={extName} onChange={e => setExtName(e.target.value)} placeholder="напр. Ивелина Василева"
                  className="w-full text-sm rounded-lg border border-slate-200 px-2.5 py-1.5 bg-white" />
              </div>
              <div className="w-40">
                <label className="block text-[10px] font-medium text-slate-400 uppercase tracking-wide mb-1">Роля</label>
                <input value={extPos} onChange={e => setExtPos(e.target.value)} placeholder="родител / лекар"
                  className="w-full text-sm rounded-lg border border-slate-200 px-2.5 py-1.5 bg-white" />
              </div>
              <button onClick={addExternal} disabled={busy || !extName.trim()}
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm font-medium text-slate-600 bg-white border border-slate-200 hover:bg-slate-50 disabled:opacity-50">
                <UserPlus size={14} /> Външен
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Заседания и документи — предстои */}
      <div className="bg-white rounded-2xl border border-dashed border-slate-200 p-4 text-sm text-slate-400">
        Заседания (протоколи) и документи — предстои.
      </div>
    </div>
  )
}
