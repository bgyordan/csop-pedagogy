'use client'

import { useState } from 'react'
import { X, Loader2 } from 'lucide-react'

export const ACCENT = '#0f2240'
export const SITE_URL = 'https://csop-varna.bg'
export const fmtDate = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString('bg-BG') : '')
export const fmtDateTime = (iso: string | null) => (iso ? new Date(iso).toLocaleString('bg-BG', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '')
export const MONTHS_SHORT = ['яну', 'фев', 'мар', 'апр', 'май', 'юни', 'юли', 'авг', 'сеп', 'окт', 'ное', 'дек']

/* ═══════════════ типове ═══════════════ */
export interface Doc { id: string; name: string; file_url: string; academic_year: string | null; section: string; category: string | null; on_site: boolean; sort_order: number; created_at?: string }
export interface News { id: string; title: string; excerpt: string | null; content: string | null; cover_url: string | null; gallery_images?: string[] | null; category: string; status: string; published_at: string | null; created_at: string }
export interface Ev { id: string; title: string; event_date: string; event_time: string | null; location: string | null; description: string | null }
export interface Album { id: string; title: string; cover_url: string | null; event_date: string | null; sort_order: number }
export interface Photo { id: string; album_id: string; photo_url: string; caption: string | null; sort_order: number }
export interface Job { id: string; title: string; employment: string | null; description: string | null; requirements: string | null; location: string | null; status: string; sort_order: number }
export interface Subscriber { id: string; email: string; created_at: string }

export const SECTIONS: { id: string; label: string; note: string; internalOnly?: boolean; path?: string }[] = [
  { id: 'internal', label: 'Вътрешни документи', note: 'Прозрачност → Вътрешни документи', path: '/za-nas/vatreshni-dokumenti' },
  { id: 'budget', label: 'Бюджет и финанси', note: 'Прозрачност → Бюджет и финанси', path: '/za-nas/byudzhet-i-finansi' },
  { id: 'admission', label: 'Бланки за прием', note: 'Родители → Как се записва дете', path: '/priem/proczedura' },
  { id: 'zdoi', label: 'Достъп до информация', note: 'Прозрачност → Достъп до информация', path: '/za-nas/dostap-do-obshtestvena-informatsiya' },
  { id: 'privacy', label: 'Лични данни', note: 'Прозрачност → Лични данни', path: '/za-nas/zashtita-na-lichnite-danni' },
  { id: 'signali', label: 'Сигнали', note: 'Прозрачност → Подаване на сигнали', path: '/podavane-na-signali' },
  { id: 'roditeli', label: 'Формуляри за родители', note: 'Родители → За родители', path: '/za-roditeli' },
  { id: 'eis', label: 'Само за деловодство', note: 'Не се показва на сайта', internalOnly: true },
]
export const RUBRICS = [
  { key: 'strategy', title: 'Стратегия и планове', color: '#7c3aed' },
  { key: 'rules', title: 'Правилници и вътрешни правила', color: '#0d9488' },
  { key: 'programs', title: 'Програми', color: '#2563eb' },
  { key: 'ethics', title: 'Етика и приобщаване', color: '#db2777' },
  { key: 'safety', title: 'Безопасност', color: '#ea580c' },
  { key: 'data', title: 'Защита на данните', color: '#475569' },
  { key: 'other', title: 'Общи', color: '#64748b' },
]
// Рубрики за ЗДОИ — всяка се показва в отделен блок на публичната ЗДОИ страница.
export const ZDOI_RUBRICS = [
  { key: 'pravila', title: 'Вътрешни правила', color: '#0d9488' },
  { key: 'obrazec', title: 'Образец / бланка', color: '#2563eb' },
  { key: 'normativ', title: 'Нормативи за разходите', color: '#ea580c' },
  { key: 'otchet', title: 'Годишен отчет', color: '#7c3aed' },
]
export const BUDGET_RUBRICS = [
  { key: 'approved', title: 'Утвърден бюджет', color: '#2f7d5e' },
  { key: 'report', title: 'Отчет', color: '#b0805a' },
]
export const rubricSet = (section: string) => (section === 'internal' ? RUBRICS : section === 'zdoi' ? ZDOI_RUBRICS : section === 'budget' ? BUDGET_RUBRICS : null)
export const rubricOf = (section: string, k: string | null) => { const s = rubricSet(section) || RUBRICS; return s.find((r) => r.key === k) || s[s.length - 1] }
// Страници на сайта, на които може да се сложат снимки (ключ = site_settings.page_photos)
export const SITE_PAGES: { key: string; label: string }[] = [
  { key: 'za-nas', label: 'За нас' },
  { key: 'istoriya', label: 'История' },
  { key: 'ekip', label: 'Екип' },
  { key: 'materialna-baza', label: 'Материална база (горе)' },
  { key: 'baza-kabineti', label: 'Материална база: учебни кабинети' },
  { key: 'baza-terapiya', label: 'Материална база: терапевтични зали' },
  { key: 'baza-kuhnya', label: 'Материална база: кулинарен кабинет' },
  { key: 'baza-dvor', label: 'Материална база: двор' },
  { key: 'proekti', label: 'Проекти' },
  { key: 'karieri', label: 'Кариери' },
  { key: 'za-roditeli', label: 'За родители' },
  { key: 'dneven-rezhim', label: 'Дневен режим' },
  { key: 'nastoyatelstvo', label: 'Училищно настоятелство' },
  { key: 'priem', label: 'Как се записва дете' },
  { key: 'poseshtenie', label: 'Елате на посещение' },
  { key: 'daritelstvo', label: 'Дарителство' },
]
export const NEWS_CATS = ['Новини', 'Събития', 'Публикации', 'Моменти']


/* ═══════════════ малки помощници за UI ═══════════════ */
export function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div><label className="block text-[12.5px] font-medium text-slate-600 mb-1.5">{label}</label>{children}</div>
}
export const INPUT = 'w-full border border-slate-200 rounded-xl px-3 py-2.5 text-[13.5px] bg-slate-50 focus:outline-none focus:border-slate-500 focus:bg-white'
export function suggestName(filename: string): string {
  const base = filename.replace(/\.[a-z0-9]+$/i, '').replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').trim()
  return base ? base.charAt(0).toUpperCase() + base.slice(1) : ''
}
export function Toast({ notice }: { notice: { msg: string; err?: boolean } | null }) {
  if (!notice) return null
  return <div className={`fixed bottom-5 left-1/2 -translate-x-1/2 z-[60] px-4 py-2.5 rounded-xl text-sm shadow-lg ${notice.err ? 'bg-rose-600 text-white' : 'bg-slate-800 text-white'}`}>{notice.msg}</div>
}
export function Drawer({ open, onClose, title, children, footer, width = 500 }: { open: boolean; onClose: () => void; title: string; children: React.ReactNode; footer: React.ReactNode; width?: number }) {
  return (
    <>
      {open && <div className="fixed inset-0 bg-[#0f2240]/25 backdrop-blur-[2px] z-40" onClick={onClose} />}
      <div className="fixed top-0 right-0 bottom-0 bg-white z-50 shadow-2xl flex flex-col transition-transform duration-200"
        style={{ width: `min(${width}px,94vw)`, transform: open ? 'translateX(0)' : 'translateX(100%)' }}>
        <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-3">
          <h3 className="text-base font-semibold flex-1" style={{ color: ACCENT }}>{title}</h3>
          <button onClick={onClose} className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:bg-slate-100"><X size={18} /></button>
        </div>
        <div className="p-5 overflow-y-auto flex-1 space-y-4">{children}</div>
        <div className="px-5 py-4 border-t border-slate-100 flex gap-2.5">{footer}</div>
      </div>
    </>
  )
}


/* ═══════════════ общи помощници ═══════════════ */
export function useFlash() {
  const [notice, setNotice] = useState<{ msg: string; err?: boolean } | null>(null)
  const flash = (msg: string, err = false) => { setNotice({ msg, err }); setTimeout(() => setNotice((p) => (p?.msg === msg ? null : p)), 3500) }
  return { notice, flash }
}

export function Switch({ on, onClick, label }: { on: boolean; onClick: () => void; label?: string }) {
  return (
    <button type="button" onClick={onClick} className="inline-flex items-center gap-2" role="switch" aria-checked={on} aria-label={label}>
      <span className={`w-[34px] h-[19px] rounded-full relative transition-colors ${on ? 'bg-emerald-500' : 'bg-slate-300'}`}><span className={`absolute top-0.5 w-[15px] h-[15px] rounded-full bg-white shadow transition-all ${on ? 'left-[17px]' : 'left-0.5'}`} /></span>
      {label && <span className="text-[12.5px] text-slate-600">{label}</span>}
    </button>
  )
}

export function Spinner({ size = 15 }: { size?: number }) { return <Loader2 size={size} className="animate-spin" /> }

// Смалява снимка до 2000px по дългата страна (снимките от телефон са по 5–8 MB)
export async function shrinkImage(file: File, max = 2000): Promise<Blob> {
  if (!file.type.startsWith('image/') || file.type === 'image/svg+xml' || file.type === 'image/gif') return file
  const bmp = await createImageBitmap(file)
  const k = Math.min(1, max / Math.max(bmp.width, bmp.height))
  if (k === 1 && file.size < 1_500_000) return file
  const c = document.createElement('canvas'); c.width = Math.round(bmp.width * k); c.height = Math.round(bmp.height * k)
  c.getContext('2d')!.drawImage(bmp, 0, 0, c.width, c.height)
  const png = file.type === 'image/png'
  return await new Promise<Blob>((res) => c.toBlob((b) => res(b || file), png ? 'image/png' : 'image/jpeg', 0.85))
}

// Пренарежда масив: премества елемента от позиция from на позиция to
export function moveItem<T>(arr: T[], from: number, to: number): T[] {
  const a = [...arr]; const [x] = a.splice(from, 1); a.splice(to, 0, x); return a
}

// Сайтът и прегледът в ЕИС ползват един и същ прост формат на текста:
//   всеки ред = абзац · „## “ = подзаглавие · редове с „- “ = списък · **удебелен** · [текст](адрес)
export function renderRich(text: string) {
  const inline = (str: string, key: string) => {
    const parts: React.ReactNode[] = []
    const re = /\*\*([^*]+)\*\*|\[([^\]]+)\]\((https?:\/\/[^)\s]+|\/[^)\s]*)\)/g
    let last = 0; let m: RegExpExecArray | null; let i = 0
    while ((m = re.exec(str))) {
      if (m.index > last) parts.push(str.slice(last, m.index))
      if (m[1]) parts.push(<strong key={key + i++}>{m[1]}</strong>)
      else parts.push(<a key={key + i++} href={m[3]} target="_blank" rel="noopener noreferrer" className="text-sky-700 underline">{m[2]}</a>)
      last = m.index + m[0].length
    }
    if (last < str.length) parts.push(str.slice(last))
    return parts
  }
  const lines = text.replace(/\r/g, '').split('\n').map((l) => l.trim()).filter(Boolean)
  const out: React.ReactNode[] = []
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i]
    if (l.startsWith('## ')) { out.push(<h3 key={i} className="text-[17px] font-semibold mt-5 mb-2" style={{ color: ACCENT }}>{inline(l.slice(3), 'h' + i)}</h3>); continue }
    if (/^[-•] /.test(l)) {
      const items: string[] = []; const start = i
      while (i < lines.length && /^[-•] /.test(lines[i])) items.push(lines[i++].slice(2))
      i--
      out.push(<ul key={start} className="list-disc pl-5 my-3 space-y-1">{items.map((it, k) => <li key={k}>{inline(it, `l${start}-${k}`)}</li>)}</ul>)
      continue
    }
    out.push(<p key={i} className="my-3">{inline(l, 'p' + i)}</p>)
  }
  return out
}
