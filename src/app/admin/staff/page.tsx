'use client'

import { useState, useEffect } from 'react'
import { smartMatch } from '@/lib/search'
import { loginTime } from '@/lib/login-time'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { createStaffAccount, syncDriveAccess, removeDriveAccess } from './actions'
import { Plus, Pencil, ExternalLink, FolderSync } from 'lucide-react'
import { useToast } from '@/components/ui/Toast'
import { Modal } from '@/components/ui/Modal'
import { getFullName } from '@/lib/utils'
import { StaffProfile, UserRole, ROLE_LABELS } from '@/types'

// Защо служителят е неактивен (колоните идват от миграция 2026-09-29_staff_status.sql)
const INACTIVE_REASONS: { v: string; l: string }[] = [
  { v: 'long_leave', l: 'Дълъг отпуск (майчинство, дълъг болничен…)' },
  { v: 'left', l: 'Напуснал' },
  { v: 'retired', l: 'Пенсиониран' },
]
const fmtD = (d?: string | null) => d ? d.split('-').reverse().join('.') : ''
// „Мария  Петрова“ → „мария петрова“ (за сравнение при дубликати)
const norm = (v?: string | null) => (v || '').trim().toLowerCase().replace(/\s+/g, ' ')
const nameKey = (x: any) => `${norm(x.first_name)}|${norm(x.last_name)}`
const mailKey = (e?: string | null) => norm(e).split('@')[0]

const EMPTY_FORM = {
  first_name: '', middle_name: '', last_name: '',
  role: 'class_teacher' as UserRole,
  email: '', phone: '',
}

export default function AdminStaffPage() {
  const supabase = createClient()
  const { toast } = useToast()
  const [staff, setStaff] = useState<StaffProfile[]>([])
  const [classesByStaff, setClassesByStaff] = useState<Record<string, string[]>>({})
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<StaffProfile | null>(null)
  const [cred, setCred] = useState<{ email: string; password: string } | null>(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [search, setSearch] = useState('')
  const [sortCol, setSortCol] = useState<'name' | 'role'>('name')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')
  const [show, setShow] = useState<'all' | 'active' | 'inactive'>('all')
  // Деактивиране: причина, до кога, кой замества
  const [deact, setDeact] = useState<StaffProfile | null>(null)
  const [dReason, setDReason] = useState('long_leave')
  const [dUntil, setDUntil] = useState('')
  const [dReplacedBy, setDReplacedBy] = useState('')

  useEffect(() => { load() }, [])

  async function load() {
    const { data } = await supabase.from('staff_profiles').select('*').order('first_name')
    setStaff(data || [])

    const { data: year } = await supabase.from('academic_years').select('id').eq('is_current', true).single()

    // Реалните назначения като класен ръководител
    const { data: assignments } = await supabase
      .from('class_teacher_assignments')
      .select('staff_id, class:classes(name)')
      .eq('academic_year_id', year?.id)

    const map: Record<string, string[]> = {}
    ;(assignments || []).forEach((a: any) => {
      const name = a.class?.name
      if (!name) return
      if (!map[a.staff_id]) map[a.staff_id] = []
      map[a.staff_id].push(name)
    })
    Object.values(map).forEach(list => list.sort((x, y) => x.localeCompare(y, 'bg', { numeric: true })))
    setClassesByStaff(map)
  }

  function toggleSort(col: 'name' | 'role') {
    if (sortCol === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortCol(col); setSortDir('asc') }
  }

  function sortIcon(col: 'name' | 'role') {
    if (sortCol !== col) return ' ↕'
    return sortDir === 'asc' ? ' ↑' : ' ↓'
  }

  function openNew() {
    setEditing(null)
    setForm(EMPTY_FORM)
    setOpen(true)
  }

  async function createAccess(s: any) {
    if (!confirm(`Създаване на достъп за ${getFullName(s)} (${s.email})?`)) return
    const res: any = await createStaffAccount(s.id)
    if (res.error) { alert(res.error); return }
    setCred({ email: res.email, password: res.password })
  }
  function openEdit(s: any) {
    setEditing(s)
    setForm({
      first_name: s.first_name,
      middle_name: s.middle_name || '',
      last_name: s.last_name,
      role: s.role,
      email: s.email,
      phone: s.phone || '',
    })
    setOpen(true)
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    if (!form.first_name || !form.last_name || !form.email) {
      toast('Попълни задължителните полета', 'error'); return
    }
    // Предупреждение за дублиран служител (същите име+фамилия или същият имейл преди @)
    const selfId = editing ? (editing as any).id : null
    const dups = staff.filter((x: any) => x.id !== selfId && (
      (!editing && nameKey(x) === nameKey(form)) ||
      (!!form.email && mailKey(x.email) === mailKey(form.email))
    ))
    if (dups.length > 0) {
      const list = dups.map((x: any) => `• ${getFullName(x)} (${ROLE_LABELS[x.role as UserRole] || x.role}${x.is_active ? '' : ', неактивен'}) – ${x.email || 'без имейл'}`).join('\n')
      if (!confirm(`Вече има подобен служител:\n${list}\n\nСъщият човек ли е? Натисни „Отказ“, за да не се дублира, или „OK“, ако е друг човек.`)) return
    }
    setSaving(true)

    const payload = {
      first_name: form.first_name,
      middle_name: form.middle_name || null,
      last_name: form.last_name,
      role: form.role,
      position: ROLE_LABELS[form.role],
      email: form.email,
      phone: form.phone || null,
    }

    let error
    if (editing) {
      ({ error } = await supabase.from('staff_profiles').update(payload).eq('id', (editing as any).id))
    } else {
      ({ error } = await supabase.from('staff_profiles').insert({ ...payload, is_active: true }))
    }

    if (error) { toast(`Грешка при запис: ${error.message}`, 'error'); setSaving(false); return }

    toast(editing ? 'Промените са запазени' : 'Служителят е добавен')
    setOpen(false)
    setSaving(false)
    load()
  }

  async function toggleActive(s: StaffProfile) {
    if (s.is_active) {
      // деактивиране → питаме защо (отделен прозорец)
      setDeact(s); setDReason('long_leave'); setDUntil(''); setDReplacedBy('')
      return
    }
    // активиране → чистим причината
    let { error } = await supabase.from('staff_profiles')
      .update({ is_active: true, inactive_reason: null, inactive_until: null, replaced_by: null }).eq('id', s.id)
    if (error) ({ error } = await supabase.from('staff_profiles').update({ is_active: true }).eq('id', s.id))   // колоните още ги няма
    if (error) { toast('Грешка при запис', 'error'); return }
    toast('Активиран')
    load()
  }

  // За вече неактивен: само сменяме причината / датата / заместника (без да го активираме)
  function editReason(s: any) {
    setDeact(s)
    setDReason(s.inactive_reason || 'long_leave')
    setDUntil(s.inactive_until || '')
    setDReplacedBy(s.replaced_by || '')
  }

  async function confirmDeactivate() {
    if (!deact) return
    const long = dReason === 'long_leave'
    let { error } = await supabase.from('staff_profiles').update({
      is_active: false,
      inactive_reason: dReason,
      inactive_until: long ? (dUntil || null) : null,
      replaced_by: long ? (dReplacedBy || null) : null,
    }).eq('id', deact.id)
    if (error) {
      // миграцията още не е пусната → само неактивен
      ({ error } = await supabase.from('staff_profiles').update({ is_active: false }).eq('id', deact.id))
      if (!error) toast('Деактивиран (причината ще се пази след обновяване на базата)')
    } else toast(deact.is_active ? 'Деактивиран' : 'Запазено')
    if (error) { toast('Грешка при запис', 'error'); return }
    const wasActive = deact.is_active
    const id = deact.id
    setDeact(null)
    load()
    // маха правата му в Drive (тече на заден план — може да отнеме минута)
    if (wasActive) removeDriveAccess(id).then(r => {
      if ('error' in r && r.error) toast('Drive: ' + r.error, 'error')
      else toast('Правата му в Drive са премахнати')
    })
  }

  const [syncing, setSyncing] = useState(false)
  async function syncDrive() {
    setSyncing(true)
    const r: any = await syncDriveAccess()
    setSyncing(false)
    if (r.error) toast('Drive: ' + r.error, 'error')
    else toast(`Drive ${r.year}: ${r.people} психолози/логопеди с права над всички деца` + (r.removed ? `, премахнати ${r.removed}` : ''))
  }

  // Етикет на статуса: „Активен“ / „В отпуск до 15.03 · зам. Мария И.“ / „Напуснал“ / „Пенсиониран“
  function statusText(s: any): string {
    if (s.is_active) {
      // заместник по договор → кого замества
      const whom = staff.filter((x: any) => !x.is_active && x.replaced_by === s.id)
      return whom.length ? `Активен · замества ${whom.map((x: any) => `${x.first_name} ${x.last_name[0]}.`).join(', ')}` : 'Активен'
    }
    if (s.inactive_reason === 'long_leave') {
      const rep = s.replaced_by ? staff.find((x: any) => x.id === s.replaced_by) : null
      return ['В отпуск' + (s.inactive_until ? ` до ${fmtD(s.inactive_until)}` : ''), rep ? `зам. ${rep.first_name} ${rep.last_name[0]}.` : ''].filter(Boolean).join(' · ')
    }
    if (s.inactive_reason === 'left') return 'Напуснал'
    if (s.inactive_reason === 'retired') return 'Пенсиониран'
    return 'Неактивен'
  }

  // Възможни дубликати (едни и същи име + фамилия)
  const dupGroups = Object.values(staff.reduce((m: Record<string, any[]>, x: any) => {
    const k = nameKey(x); (m[k] ||= []).push(x); return m
  }, {})).filter(g => g.length > 1)

  const filtered = staff
    .filter(s => show === 'all' || (show === 'active' ? s.is_active : !s.is_active))
    .filter(s => !search || smartMatch(getFullName(s), search))
    .sort((a, b) => {
      const valA = sortCol === 'name' ? getFullName(a) : ROLE_LABELS[a.role]
      const valB = sortCol === 'name' ? getFullName(b) : ROLE_LABELS[b.role]
      return sortDir === 'asc' ? valA.localeCompare(valB, 'bg') : valB.localeCompare(valA, 'bg')
    })

  return (
    <div className="p-4 md:p-8">
      {cred && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm" onClick={() => { setCred(null); window.location.reload() }}>
          <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full p-5" onClick={e => e.stopPropagation()}>
            <h3 className="text-sm font-semibold text-slate-800 mb-1">Достъпът е създаден</h3>
            <p className="text-xs text-slate-500 mb-3">Дай тези данни на служителя. Може да си смени паролата после.</p>
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2">
                <div className="min-w-0"><div className="text-[10px] text-slate-400 uppercase">Имейл</div><div className="text-sm font-mono text-slate-700 truncate">{cred.email}</div></div>
                <button onClick={() => navigator.clipboard.writeText(cred.email)} className="text-xs text-[#0f2240] hover:underline shrink-0">Копирай</button>
              </div>
              <div className="flex items-center justify-between gap-2 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2">
                <div className="min-w-0"><div className="text-[10px] text-slate-400 uppercase">Временна парола</div><div className="text-sm font-mono text-slate-700 truncate">{cred.password}</div></div>
                <button onClick={() => navigator.clipboard.writeText(cred.password)} className="text-xs text-[#0f2240] hover:underline shrink-0">Копирай</button>
              </div>
            </div>
            <button onClick={() => navigator.clipboard.writeText(`Имейл: ${cred.email}\nПарола: ${cred.password}`)} className="w-full mt-3 py-2 rounded-xl text-sm font-medium text-white" style={{ backgroundColor: '#0f2240' }}>Копирай двете</button>
            <button onClick={() => { setCred(null); window.location.reload() }} className="w-full mt-2 py-2 rounded-xl text-sm text-slate-500 hover:bg-slate-50">Затвори</button>
          </div>
        </div>
      )}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-slate-800">Управление на служители</h1>
          <p className="text-slate-500 text-sm mt-1">{filtered.length} служители</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={syncDrive} disabled={syncing} title="Психолозите и логопедите получават права над всички деца в Drive"
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-50">
            <FolderSync size={16} />
            {syncing ? 'Обновявам…' : 'Права в Drive'}
          </button>
          <button onClick={openNew} className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-white" style={{ backgroundColor: '#0f2240' }}>
            <Plus size={16} />
            Нов служител
          </button>
        </div>
      </div>

      {dupGroups.length > 0 && (
        <div className="mb-4 px-4 py-3 rounded-xl bg-amber-50 border border-amber-200 text-sm text-amber-800">
          <span className="font-medium">Възможни дубликати:</span>{' '}
          {dupGroups.map((g: any[]) => `${g[0].first_name} ${g[0].last_name} (${g.length})`).join(', ')}
          <span className="text-amber-700/80"> — ако е един и същ човек, остави един активен, а другия деактивирай.</span>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2 mb-4">
        <input
          className="input max-w-sm"
          placeholder="Търси по име..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        {([['all', 'Всички'], ['active', 'Активни'], ['inactive', 'Неактивни']] as const).map(([v, l]) => (
          <button key={v} type="button" onClick={() => setShow(v)}
            className={`px-3 py-1.5 rounded-full text-sm border transition-colors ${show === v ? 'bg-[#0f2240] text-white border-[#0f2240]' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'}`}>
            {l}
          </button>
        ))}
      </div>

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="text-left px-4 py-2.5 text-xs font-medium text-slate-500 uppercase tracking-wide cursor-pointer hover:text-slate-800" onClick={() => toggleSort('name')}>
                  Имена{sortIcon('name')}
                </th>
                <th className="text-left px-4 py-2.5 text-xs font-medium text-slate-500 uppercase tracking-wide cursor-pointer hover:text-slate-800" onClick={() => toggleSort('role')}>
                  Роля{sortIcon('role')}
                </th>
                <th className="text-left px-4 py-2.5 text-xs font-medium text-slate-500 uppercase tracking-wide">Класен на</th>
                <th className="text-left px-4 py-2.5 text-xs font-medium text-slate-500 uppercase tracking-wide">Имейл</th>
                <th className="text-left px-4 py-2.5 text-xs font-medium text-slate-500 uppercase tracking-wide">Статус</th>
                <th className="text-left px-4 py-2.5 text-xs font-medium text-slate-500 uppercase tracking-wide whitespace-nowrap">Последно влизане</th>
                <th className="px-4 py-2.5"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((s, idx) => {
                const myClasses = classesByStaff[s.id] || []
                return (
                  <tr key={s.id} className={`border-b border-slate-100 hover:bg-blue-50 transition-colors ${idx % 2 === 1 ? 'bg-slate-50/50' : 'bg-white'}`}>
                    <td className="px-4 py-2 font-medium text-slate-800">
                      <Link href={`/staff/${s.id}`} className="hover:underline hover:text-[#0f2240] inline-flex items-center gap-1">
                        {getFullName(s)}
                      </Link>
                    </td>
                    <td className="px-4 py-2 text-slate-600 whitespace-nowrap">{ROLE_LABELS[s.role]}</td>
                    <td className="px-4 py-2">
                      {myClasses.length > 0 ? (
                        <div className="flex flex-wrap gap-1">
                          {myClasses.map(name => (
                            <span key={name} className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 text-[11px] font-medium">
                              {name}
                            </span>
                          ))}
                        </div>
                      ) : <span className="text-slate-300">—</span>}
                    </td>
                    <td className="px-4 py-2 text-slate-600 font-mono text-xs">{s.email}</td>
                    <td className="px-4 py-2">
                      <span className={`${s.is_active ? 'badge-completed' : 'badge-empty'} whitespace-nowrap`}>
                        {statusText(s)}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-xs text-slate-500 whitespace-nowrap">
                      {(s as any).last_login_at ? loginTime((s as any).last_login_at) : <span className="text-slate-300">{s.user_id ? 'никога' : '—'}</span>}
                    </td>
                    <td className="px-4 py-2">
                      <div className="flex items-center gap-2">
                        <button onClick={() => openEdit(s)} className="text-xs font-medium px-2.5 py-1 rounded-lg border border-slate-200 hover:bg-slate-100 transition-colors flex items-center gap-1">
                          <Pencil size={12} />
                          Редактирай
                        </button>
                        {!s.user_id && (
                          <button onClick={() => createAccess(s)} className="text-xs font-medium px-2.5 py-1 rounded-lg text-white hover:opacity-90 whitespace-nowrap" style={{ backgroundColor: '#0f2240' }}>
                            Създай достъп
                          </button>
                        )}
                        {!s.is_active && (
                          <button onClick={() => editReason(s)} className="text-xs font-medium px-2.5 py-1 rounded-lg border border-slate-200 hover:bg-slate-100 transition-colors whitespace-nowrap">
                            Причина
                          </button>
                        )}
                        <button onClick={() => toggleActive(s)} className="text-xs text-slate-400 hover:text-slate-700 whitespace-nowrap">
                          {s.is_active ? 'Деактивирай' : 'Активирай'}
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      <p className="text-xs text-slate-400 mt-3">
        Паралелките се назначават от страницата на служителя или от самата паралелка.
      </p>

      <Modal open={!!deact} onClose={() => setDeact(null)} title={deact ? `${deact.is_active ? 'Деактивиране' : 'Причина за неактивен'}: ${getFullName(deact)}` : ''}>
        <div className="space-y-3">
          <p className="text-xs text-slate-500">Неактивният служител изчезва от списъците и не може да влиза в системата. Старите му данни (заповеди, документи) остават.</p>
          <div className="space-y-1.5">
            {INACTIVE_REASONS.map(o => (
              <label key={o.v} className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-sm cursor-pointer transition-colors ${dReason === o.v ? 'border-[#0f2240] bg-slate-50 text-slate-800' : 'border-slate-200 text-slate-600 hover:bg-slate-50'}`}>
                <input type="radio" name="dreason" checked={dReason === o.v} onChange={() => setDReason(o.v)} className="accent-[#0f2240]" />
                {o.l}
              </label>
            ))}
          </div>
          {dReason === 'long_leave' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="label">Очаквано завръщане</label>
                <input type="date" className="input" value={dUntil} onChange={e => setDUntil(e.target.value)} />
              </div>
              <div>
                <label className="label">Заместван от</label>
                <select className="input" value={dReplacedBy} onChange={e => setDReplacedBy(e.target.value)}>
                  <option value="">— няма / не е ясно —</option>
                  {staff.filter((x: any) => x.is_active && x.id !== deact?.id).sort((a, b) => getFullName(a).localeCompare(getFullName(b), 'bg'))
                    .map((x: any) => <option key={x.id} value={x.id}>{getFullName(x)}</option>)}
                </select>
              </div>
              <p className="sm:col-span-2 text-[11px] text-slate-400">Седмица преди датата на таблото ще излезе напомняне, че се връща.</p>
            </div>
          )}
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={confirmDeactivate} className="btn-primary" style={{ backgroundColor: '#0f2240' }}>{deact?.is_active ? 'Деактивирай' : 'Запази'}</button>
            <button type="button" onClick={() => setDeact(null)} className="btn-secondary">Отказ</button>
          </div>
        </div>
      </Modal>

      <Modal open={open} onClose={() => setOpen(false)} title={editing ? 'Редактирай служител' : 'Нов служител'}>
        <form onSubmit={handleSave} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Първо име <span className="text-red-500">*</span></label>
              <input className="input" value={form.first_name} onChange={e => setForm(p => ({ ...p, first_name: e.target.value }))} />
            </div>
            <div>
              <label className="label">Презиме</label>
              <input className="input" value={form.middle_name} onChange={e => setForm(p => ({ ...p, middle_name: e.target.value }))} />
            </div>
          </div>
          <div>
            <label className="label">Фамилия <span className="text-red-500">*</span></label>
            <input className="input" value={form.last_name} onChange={e => setForm(p => ({ ...p, last_name: e.target.value }))} />
          </div>
          <div>
            <label className="label">Роля</label>
            <select className="input" value={form.role} onChange={e => setForm(p => ({ ...p, role: e.target.value as UserRole }))}>
              {Object.entries(ROLE_LABELS).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
          </div>
          {editing && form.role === 'class_teacher' && (
            <div className="px-3 py-2 rounded-lg bg-slate-50 border border-slate-200">
              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Класен на</div>
              <div className="text-sm text-slate-700 mt-0.5">
                {(classesByStaff[(editing as any).id] || []).join(', ') || 'няма назначени паралелки'}
              </div>
              <Link href={`/staff/${(editing as any).id}`}
                className="text-[11px] text-slate-500 hover:text-[#0f2240] inline-flex items-center gap-1 mt-1">
                Управление на паралелките <ExternalLink size={10} />
              </Link>
            </div>
          )}
          <div>
            <label className="label">Имейл <span className="text-red-500">*</span></label>
            <input type="email" className="input" value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))} />
          </div>
          <div>
            <label className="label">Телефон</label>
            <input className="input" value={form.phone} onChange={e => setForm(p => ({ ...p, phone: e.target.value }))} />
          </div>
          <div className="flex gap-3 pt-2">
            <button type="submit" disabled={saving} className="btn-primary" style={{ backgroundColor: '#0f2240' }}>
              {saving ? 'Запазване...' : 'Запази'}
            </button>
            <button type="button" onClick={() => setOpen(false)} className="btn-secondary">Отказ</button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
