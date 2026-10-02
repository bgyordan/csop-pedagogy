'use client'

import { useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { Megaphone, MapPin, Clock, Phone, HeartHandshake, ShieldAlert, Plus, Trash2, ChevronUp, ChevronDown, Check, AlertTriangle, ExternalLink, RotateCcw } from 'lucide-react'
import { ACCENT, SITE_URL, Switch, Toast, Spinner, useFlash } from './shared'
import type { SiteInfo } from './siteinfo'

// IBAN проверка (ISO 13616, mod 97) — хваща грешно преписана или измислена сметка
function ibanState(raw: string): 'empty' | 'ok' | 'bad' {
  const s = raw.replace(/\s+/g, '').toUpperCase()
  if (!s) return 'empty'
  if (!/^BG\d{2}[A-Z]{4}\d{6}[A-Z0-9]{8}$/.test(s)) return 'bad'
  const r = (s.slice(4) + s.slice(0, 4)).replace(/[A-Z]/g, (c) => String(c.charCodeAt(0) - 55))
  let m = 0; for (const ch of r) m = (m * 10 + Number(ch)) % 97
  return m === 1 ? 'ok' : 'bad'
}
const fmtIban = (raw: string) => raw.replace(/\s+/g, '').toUpperCase().replace(/(.{4})/g, '$1 ').trim()

const IN = 'w-full border border-slate-200 rounded-xl px-3 py-2 text-[13.5px] bg-slate-50 focus:outline-none focus:border-slate-500 focus:bg-white'
function F({ label, hint, children, wide }: { label: string; hint?: string; children: React.ReactNode; wide?: boolean }) {
  return (
    <label className={`block ${wide ? 'sm:col-span-2' : ''}`}>
      <span className="block text-[12.5px] font-medium text-slate-600 mb-1">{label}</span>
      {children}
      {hint && <span className="block text-[11.5px] text-slate-400 mt-1">{hint}</span>}
    </label>
  )
}
function Card({ icon: Icon, title, sub, where, children }: { icon: React.ElementType; title: string; sub?: string; where?: string; children: React.ReactNode }) {
  return (
    <section className="bg-white border border-slate-200 rounded-2xl shadow-sm">
      <div className="px-5 pt-4 pb-3 flex items-start gap-3">
        <span className="w-9 h-9 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-center text-slate-500 shrink-0"><Icon size={17} /></span>
        <div className="min-w-0 flex-1">
          <h3 className="text-[15px] font-semibold" style={{ color: ACCENT }}>{title}</h3>
          {sub && <p className="text-[12.5px] text-slate-500 mt-0.5">{sub}</p>}
        </div>
        {where && <a href={SITE_URL + where} target="_blank" rel="noopener noreferrer" className="text-[12px] text-sky-700 hover:underline inline-flex items-center gap-1 shrink-0">виж <ExternalLink size={11} /></a>}
      </div>
      <div className="px-5 pb-5">{children}</div>
    </section>
  )
}

/* ═══════════════ НАСТРОЙКИ НА САЙТА ═══════════════ */
export default function SettingsManager({ initial, ready }: { initial: SiteInfo; ready: boolean }) {
  const supabase = createClient(); const router = useRouter()
  const { notice, flash } = useFlash()
  const [saved, setSaved] = useState<SiteInfo>(initial)
  const [v, setV] = useState<SiteInfo>(initial)
  const [busy, setBusy] = useState(false)
  const dirty = useMemo(() => JSON.stringify(v) !== JSON.stringify(saved), [v, saved])
  const iban = ibanState(v.bank.iban)

  const set = <K extends keyof SiteInfo>(k: K, patch: Partial<SiteInfo[K]>) => setV((p) => ({ ...p, [k]: { ...(p[k] as object), ...patch } as SiteInfo[K] }))
  const setPhone = (i: number, patch: Partial<SiteInfo['phones'][number]>) => setV((p) => ({ ...p, phones: p.phones.map((x, j) => (j === i ? { ...x, ...patch } : x)) }))
  const movePhone = (i: number, d: number) => setV((p) => { const a = [...p.phones]; const j = i + d; if (j < 0 || j >= a.length) return p; [a[i], a[j]] = [a[j], a[i]]; return { ...p, phones: a } })

  async function save() {
    const clean: SiteInfo = { ...v, bank: { ...v.bank, iban: fmtIban(v.bank.iban) }, phones: v.phones.filter((p) => p.name.trim() || p.phone.trim()) }
    setBusy(true)
    const { error } = await supabase.from('site_settings').update({ value: clean, updated_at: new Date().toISOString() }).eq('key', 'site_info')
    setBusy(false)
    if (error) { flash('Не се запази: ' + error.message, true); return }
    setV(clean); setSaved(clean); flash('Запазено — сайтът вече показва новите данни.'); router.refresh()
  }

  const noticeExpired = v.notice.until && v.notice.until < new Date().toISOString().slice(0, 10)

  return (
    <div className="pb-24">
      <Toast notice={notice} />
      {!ready && (
        <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-[13px] text-amber-800">
          Настройките още не са създадени в базата — пуснете миграцията <code>2026-10-02_site_info_history.sql</code>, иначе промените няма да се запазват.
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
        {/* обява */}
        <div className="xl:col-span-2">
          <Card icon={Megaphone} title="Обява най-горе на сайта" sub="Кратко съобщение на всяка страница — напр. „На 6 май центърът не работи“. Може да се скрие само след дадена дата.">
            <div className="flex items-center gap-3 mb-3"><Switch on={v.notice.on} onClick={() => set('notice', { on: !v.notice.on })} label={v.notice.on ? 'Показва се' : 'Скрита'} />{noticeExpired && v.notice.on && <span className="text-[12px] text-amber-700">датата е минала — не се показва</span>}</div>
            <div className="grid sm:grid-cols-2 gap-3">
              <F label={`Текст (${v.notice.text.length}/160)`} wide><input value={v.notice.text} maxLength={160} onChange={(e) => set('notice', { text: e.target.value })} placeholder="напр. На 6 май центърът не работи." className={IN} /></F>
              <F label="Връзка (по избор)" hint="Ако има — обявата става връзка, напр. към новина"><input value={v.notice.link} onChange={(e) => set('notice', { link: e.target.value })} placeholder="https://csop-varna.bg/novini/…" className={IN} /></F>
              <F label="Показва се до (по избор)" hint="Включително. Празно = докато не я изключите"><input type="date" value={v.notice.until} onChange={(e) => set('notice', { until: e.target.value })} className={IN} /></F>
            </div>
            {v.notice.text.trim() && (
              <div className={`mt-4 rounded-xl px-4 py-2.5 text-center text-[13.5px] font-medium ${v.notice.on && !noticeExpired ? '' : 'opacity-40'}`} style={{ backgroundColor: '#F39A1E', color: '#15324A' }}>
                {v.notice.text}{v.notice.link && <span className="underline ml-1.5">Повече →</span>}
              </div>
            )}
          </Card>
        </div>

        <Card icon={MapPin} title="Адрес и контакти" sub="Долу на всяка страница, в „Контакти“ и на още места." where="/kontakti">
          <div className="grid sm:grid-cols-2 gap-3">
            <F label="Адрес"><input value={v.contact.address} onChange={(e) => set('contact', { address: e.target.value })} className={IN} /></F>
            <F label="Град"><input value={v.contact.city} onChange={(e) => set('contact', { city: e.target.value })} className={IN} /></F>
            <F label="Имейл"><input type="email" value={v.contact.email} onChange={(e) => set('contact', { email: e.target.value })} className={IN} /></F>
            <F label="Основен телефон"><input value={v.contact.phone} onChange={(e) => set('contact', { phone: e.target.value })} placeholder="+359 …" className={IN} /></F>
            <F label="Facebook страница" wide><input value={v.contact.facebook} onChange={(e) => set('contact', { facebook: e.target.value })} placeholder="https://www.facebook.com/…" className={IN} /></F>
          </div>
        </Card>

        <Card icon={Clock} title="Работно време" sub="Понеделник – петък." where="/kontakti">
          <div className="grid sm:grid-cols-2 gap-3">
            <F label="Център"><input value={v.hours.center} onChange={(e) => set('hours', { center: e.target.value })} placeholder="8:00 – 18:00" className={IN} /></F>
            <F label="Администрация и деловодство"><input value={v.hours.admin} onChange={(e) => set('hours', { admin: e.target.value })} placeholder="8:00 – 16:30" className={IN} /></F>
            <F label="Приемно време на директора" wide><input value={v.hours.director} onChange={(e) => set('hours', { director: e.target.value })} placeholder="вторник, 9:00 – 10:00" className={IN} /></F>
          </div>
        </Card>

        <div className="xl:col-span-2"><Card icon={Phone} title="Телефони" sub="Списъкът в страницата „Контакти“, в този ред." where="/kontakti">
          <div className="space-y-2">
            {v.phones.map((p, i) => (
              <div key={i} className="flex items-center gap-2">
                <div className="grid grid-cols-1 sm:grid-cols-[1.4fr_1.1fr_1fr] gap-2 flex-1">
                  <input value={p.name} onChange={(e) => setPhone(i, { name: e.target.value })} placeholder="Име" className={IN} />
                  <input value={p.role} onChange={(e) => setPhone(i, { role: e.target.value })} placeholder="Длъжност" className={IN} />
                  <input value={p.phone} onChange={(e) => setPhone(i, { phone: e.target.value })} placeholder="+359 …" className={IN} />
                </div>
                <div className="flex flex-col">
                  <button onClick={() => movePhone(i, -1)} disabled={i === 0} className="p-0.5 text-slate-400 hover:text-slate-700 disabled:opacity-20"><ChevronUp size={15} /></button>
                  <button onClick={() => movePhone(i, 1)} disabled={i === v.phones.length - 1} className="p-0.5 text-slate-400 hover:text-slate-700 disabled:opacity-20"><ChevronDown size={15} /></button>
                </div>
                <button onClick={() => setV((x) => ({ ...x, phones: x.phones.filter((_, j) => j !== i) }))} title="Махни" className="p-1.5 rounded-lg text-slate-300 hover:text-rose-600 hover:bg-rose-50"><Trash2 size={15} /></button>
              </div>
            ))}
            <button onClick={() => setV((x) => ({ ...x, phones: [...x.phones, { name: '', role: '', phone: '' }] }))} className="inline-flex items-center gap-1.5 text-[13px] text-slate-600 px-3 py-1.5 rounded-lg border border-dashed border-slate-300 hover:bg-slate-50"><Plus size={14} /> Добави телефон</button>
          </div>
        </Card></div>

        <Card icon={HeartHandshake} title="Дарения" sub="Банковата сметка в страница „Дарителство“." where="/daritelstvo">
          <div className="grid sm:grid-cols-2 gap-3">
            <F label="Получател" wide><input value={v.bank.to} onChange={(e) => set('bank', { to: e.target.value })} className={IN} /></F>
            <F label="IBAN" wide>
              <input value={v.bank.iban} onChange={(e) => set('bank', { iban: e.target.value })} onBlur={() => set('bank', { iban: fmtIban(v.bank.iban) })} className={`${IN} font-mono ${iban === 'bad' ? '!border-rose-300 !bg-rose-50' : ''}`} />
              {iban === 'ok' && <span className="mt-1 flex items-center gap-1 text-[11.5px] text-emerald-700"><Check size={12} /> IBAN е валиден</span>}
              {iban === 'bad' && <span className="mt-1 flex items-start gap-1 text-[11.5px] text-rose-700"><AlertTriangle size={12} className="shrink-0 mt-0.5" /> Този IBAN не е валиден — проверете го със счетоводството</span>}
            </F>
            <F label="BIC"><input value={v.bank.bic} onChange={(e) => set('bank', { bic: e.target.value.toUpperCase() })} className={`${IN} font-mono`} /></F>
            <F label="Основание за превода" wide><input value={v.bank.reason} onChange={(e) => set('bank', { reason: e.target.value })} className={IN} /></F>
          </div>
        </Card>

        <Card icon={ShieldAlert} title="Подаване на сигнали" sub="Отговорното лице по ЗЗЛПСПОИН." where="/podavane-na-signali">
          <div className="grid sm:grid-cols-2 gap-3">
            <F label="Отговорно лице" wide><input value={v.signali.person} onChange={(e) => set('signali', { person: e.target.value })} className={IN} /></F>
            <F label="Имейл за сигнали"><input value={v.signali.email} onChange={(e) => set('signali', { email: e.target.value })} className={IN} /></F>
            <F label="Телефон"><input value={v.signali.phone} onChange={(e) => set('signali', { phone: e.target.value })} placeholder="ако няма — остава празно" className={IN} /></F>
          </div>
        </Card>
      </div>

      {/* лента за запис */}
      <div className={`fixed bottom-5 left-1/2 -translate-x-1/2 z-30 transition-all ${dirty ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4 pointer-events-none'}`}>
        <div className="flex items-center gap-3 bg-white border border-slate-200 shadow-xl rounded-2xl pl-4 pr-2 py-2">
          <span className="text-[13px] text-slate-600 whitespace-nowrap">Има незапазени промени</span>
          <button onClick={() => setV(saved)} className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-[13px] text-slate-500 hover:bg-slate-50"><RotateCcw size={14} /> Откажи</button>
          <button onClick={save} disabled={busy} className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-white text-[13px] font-medium disabled:opacity-60" style={{ backgroundColor: ACCENT }}>{busy ? <Spinner /> : <Check size={15} />} Запази</button>
        </div>
      </div>
    </div>
  )
}
