import Link from 'next/link'
import { CalendarDays, Users, Pencil, Check } from 'lucide-react'

// Обща лента на „Разписание“: две понятия — „Моите часове“ (какво водя аз) и
// „Паралелка X“ (какво имат децата — сглобено от часовете на всички учители, само за четене).
export default function ScheduleTabs({ current, classes = [], staffId, term = 1, editHref, doneHref }: {
  current: 'mine' | string          // 'mine' или id на паралелка
  classes?: { id: string; name: string }[]
  staffId?: string                  // при преглед на чужд профил (управа)
  term?: number
  editHref?: string                 // бутон „Редактирай“ (само на „Моите часове“ в режим преглед)
  doneHref?: string                 // бутон „Готово“ (в режим редакция)
}) {
  const q = (extra: string) => {
    const p = [staffId ? `staff=${staffId}` : '', term === 2 ? 'term=2' : '', extra].filter(Boolean).join('&')
    return p ? `?${p}` : ''
  }
  const tab = (active: boolean) => `inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm transition-all ${
    active ? 'bg-white shadow-sm text-[#0f2240] font-medium border border-slate-200' : 'text-slate-500 hover:text-slate-700'}`
  return (
    <div className="flex flex-wrap items-center gap-3 mb-6">
      <div className="inline-flex flex-wrap gap-1 p-1 rounded-2xl bg-slate-100/80 border border-slate-200">
        <Link href={`/my-schedule${q('')}`} className={tab(current === 'mine')}>
          <CalendarDays size={15} /> Моите часове
        </Link>
        {classes.map(c => (
          <Link key={c.id} href={`/my-schedule/class${q(`c=${c.id}`)}`} className={tab(current === c.id)}>
            <Users size={15} /> Паралелка {c.name}
          </Link>
        ))}
      </div>
      {editHref && (
        <Link href={editHref} className="ml-auto inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm text-white hover:opacity-90" style={{ backgroundColor: '#0f2240' }}>
          <Pencil size={14} /> Редактирай
        </Link>
      )}
      {doneHref && (
        <Link href={doneHref} className="ml-auto inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm text-slate-700 bg-white border border-slate-200 hover:bg-slate-50">
          <Check size={14} /> Готово — към прегледа
        </Link>
      )}
    </div>
  )
}
