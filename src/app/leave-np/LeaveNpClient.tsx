'use client'

import { useMemo, useState } from 'react'
import { FileText, Loader2, Info } from 'lucide-react'
import { NP_LEAVE_KIND, leaveDaysInfo } from '@/lib/np-leave'

const KT: { v: string; l: string }[] = [
  { v: '155', l: 'чл. 155 – платен годишен отпуск' }, { v: '157', l: 'чл. 157 – при събития (брак, кръводаряване и др.)' },
  { v: '159', l: 'чл. 159 – за обучение' }, { v: '160', l: 'чл. 160 – неплатен отпуск' },
  { v: '168', l: 'чл. 168 – отглеждане на дете' }, { v: '169', l: 'чл. 169 – осиновяване' },
  { v: '170', l: 'чл. 170 – граждански/обществени задължения' }, { v: '176', l: 'чл. 176 – по други причини' },
]
const today = () => new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Sofia' })

export default function LeaveNpClient({ people, meId, forOthers }: { people: { id: string; name: string; position: string }[]; meId: string; forOthers: boolean }) {
  const [who, setWho] = useState(meId)
  const person = people.find(p => p.id === who) || people[0]
  const [position, setPosition] = useState<string | null>(null)
  const [kt, setKt] = useState('155')
  const [kind, setKind] = useState<string | null>(null)
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [days, setDays] = useState<string | null>(null)
  const [backOn, setBackOn] = useState<string | null>(null)
  const [forYear, setForYear] = useState(String(new Date().getFullYear()))
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)
  const auto = useMemo(() => leaveDaysInfo(from, to), [from, to])
  const inp = 'w-full px-3 py-2 rounded-xl border border-slate-300 text-sm focus:outline-none focus:border-[#0f2240]'

  async function gen() {
    setBusy(true)
    try {
      const { generateNpLeaveApplication } = await import('@/lib/docx-substitution')
      await generateNpLeaveApplication({
        name: person?.name || '', position: position ?? person?.position ?? '',
        leaveKind: kind ?? NP_LEAVE_KIND[kt] ?? '', days: days !== null ? (Number(days) || null) : (auto.days || null),
        forYear, dateFrom: from, dateTo: to, reason: reason.trim(), backOn: backOn ?? auto.backOn, signedOn: today(),
      })
    } finally { setBusy(false) }
  }

  return (
    <div className="p-4 md:p-8 max-w-3xl mx-auto">
      <div className="mb-6 flex items-center gap-3">
        <div className="p-2.5 rounded-xl" style={{ backgroundColor: '#0f2240' }}><FileText size={20} className="text-white" /></div>
        <div>
          <h1 className="text-xl md:text-2xl font-semibold text-slate-800">Заявление за отпуск по НП</h1>
          <p className="text-slate-500 text-sm mt-0.5">„Без свободен час“ — Приложение № 1: за ползване на отпуск по време на учебни занятия</p>
        </div>
      </div>

      <div className="mb-4 flex gap-2 px-4 py-3 rounded-xl bg-sky-50 border border-sky-200 text-[13px] text-sky-900">
        <Info size={16} className="shrink-0 mt-0.5" />
        <div>Различно е от общото заявление за отпуск — ползва се, когато отсъствате в учебни дни и часовете ви се заместват по НП. Не се качва в портала на НП, но се завежда в деловодството: по него се издават заповедта за отпуск и заповедта за заместване.</div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 space-y-4">
        <div className="grid md:grid-cols-2 gap-3">
          <label className="block">
            <span className="block text-xs text-slate-500 mb-1">Служител</span>
            {forOthers ? (
              <select value={who} onChange={e => { setWho(e.target.value); setPosition(null) }} className={inp}>
                {people.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            ) : <div className={inp + ' bg-slate-50'}>{person?.name}</div>}
          </label>
          <label className="block">
            <span className="block text-xs text-slate-500 mb-1">Длъжност</span>
            <input value={position ?? person?.position ?? ''} onChange={e => setPosition(e.target.value)} placeholder="учител" className={inp} />
          </label>
        </div>

        <div className="grid md:grid-cols-2 gap-3">
          <label className="block">
            <span className="block text-xs text-slate-500 mb-1">Вид отпуск / член от КТ</span>
            <select value={kt} onChange={e => { setKt(e.target.value); setKind(null) }} className={inp}>
              {KT.map(k => <option key={k.v} value={k.v}>{k.l}</option>)}
            </select>
          </label>
          <label className="block">
            <span className="block text-xs text-slate-500 mb-1">„Желая да ползвам … отпуск“</span>
            <input value={kind ?? NP_LEAVE_KIND[kt] ?? ''} onChange={e => setKind(e.target.value)} className={inp} />
          </label>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <label className="block"><span className="block text-xs text-slate-500 mb-1">От</span>
            <input type="date" value={from} onChange={e => { setFrom(e.target.value); if (!to || to < e.target.value) setTo(e.target.value); setDays(null); setBackOn(null) }} className={inp} /></label>
          <label className="block"><span className="block text-xs text-slate-500 mb-1">До (вкл.)</span>
            <input type="date" value={to} min={from} onChange={e => { setTo(e.target.value); setDays(null); setBackOn(null) }} className={inp} /></label>
          <label className="block"><span className="block text-xs text-slate-500 mb-1">Брой дни</span>
            <input inputMode="numeric" value={days ?? (auto.days ? String(auto.days) : '')} onChange={e => setDays(e.target.value)} className={inp} /></label>
          <label className="block"><span className="block text-xs text-slate-500 mb-1">За година</span>
            <input value={forYear} onChange={e => setForYear(e.target.value)} className={inp} /></label>
        </div>
        <p className="-mt-2 text-[11.5px] text-slate-400">Броят дни се смята по работните дни (пон–пет); поправете го при официален празник.</p>

        <div className="grid md:grid-cols-[1fr_200px] gap-3">
          <label className="block"><span className="block text-xs text-slate-500 mb-1">Поради</span>
            <input value={reason} onChange={e => setReason(e.target.value)} placeholder="семейни причини, лечение, …" className={inp} /></label>
          <label className="block"><span className="block text-xs text-slate-500 mb-1">Ще бъда на работа на</span>
            <input type="date" value={backOn ?? auto.backOn} onChange={e => setBackOn(e.target.value)} className={inp} /></label>
        </div>

        <div className="flex items-center gap-3 pt-1">
          <button type="button" onClick={gen} disabled={busy || !from || !to}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-white text-sm font-medium disabled:opacity-50" style={{ backgroundColor: '#0f2240' }}>
            {busy ? <Loader2 size={16} className="animate-spin" /> : <FileText size={16} />} Изтегли заявлението (Word)
          </button>
          <span className="text-[12px] text-slate-500">Разпечатайте, подпишете и го подайте в деловодството.</span>
        </div>
      </div>
    </div>
  )
}
