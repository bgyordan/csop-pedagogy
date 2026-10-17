// Лист с QR кодове за печат — по една карта за всяко дете: името, QR кодът към личния линк и кратко упътване.
// Класният изрязва картите и ги дава на родителите (или ги снима и праща лично). Спрените линкове не се печатат.

import { redirect, notFound } from 'next/navigation'
import QRCode from 'qrcode'
import { createClient } from '@/lib/supabase/server'
import { BackButton } from '@/components/ui/BackButton'
import { isManagerRole, myClassIds } from '@/lib/class-rooms'
import PrintButton from '@/app/passports/PrintButton'
export const dynamic = 'force-dynamic'

const PUBLIC_BASE = process.env.NEXT_PUBLIC_PUBLIC_URL || 'https://is.csop-varna.bg'
const fmt = (d: string) => d.split('-').reverse().join('.')

export default async function RoomPrintPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')
  const { data: profile } = await supabase.from('staff_profiles').select('id, role').eq('user_id', user.id).single()
  if (!profile || ['secretary', 'support'].includes(profile.role)) redirect('/dashboard')

  const { data: room } = await supabase.from('class_rooms')
    .select('id, class_id, academic_year_id, from_date, to_date, class:classes(name)').eq('id', id).maybeSingle()
  if (!room) notFound()
  if (!isManagerRole(profile.role)) {
    const mine = await myClassIds(supabase, profile.id, (room as any).academic_year_id || '')
    if (!mine.has(room.class_id)) redirect('/rooms')
  }
  const className = (room as any).class?.name || '—'

  const { data: mem } = await supabase.from('class_room_members')
    .select('id, token, revoked_at, student:students(first_name, last_name)').eq('room_id', id).is('revoked_at', null)
  const cards = await Promise.all(((mem || []) as any[])
    .map(m => ({ token: m.token as string, name: `${m.student?.first_name || ''} ${m.student?.last_name || ''}`.trim(), first: m.student?.first_name || '' }))
    .sort((a, b) => a.name.localeCompare(b.name, 'bg'))
    .map(async c => {
      const url = `${PUBLIC_BASE}/room/${c.token}`
      const svg = await QRCode.toString(url, { type: 'svg', margin: 0, errorCorrectionLevel: 'M', color: { dark: '#0f2240', light: '#ffffff' } })
      return { ...c, url, svg }
    }))

  return (
    <div className="p-4 md:p-8 max-w-4xl mx-auto print:p-0 print:max-w-none">
      <div className="print:hidden">
        <BackButton />
        <div className="flex flex-wrap items-center gap-3 mt-2 mb-6">
          <div className="flex-1">
            <h1 className="text-xl font-light text-[#0f2240]">QR кодове за родителите · паралелка {className}</h1>
            <p className="text-sm text-slate-500 font-light">По една карта за дете. Изрежете и дайте на родителя — или снимайте картата и я пратете лично.</p>
          </div>
          <PrintButton />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 print:gap-0">
        {cards.map(c => (
          <div key={c.token} className="bg-white border border-dashed border-slate-300 rounded-2xl print:rounded-none p-5 flex gap-4 items-center break-inside-avoid">
            <div className="w-32 h-32 shrink-0 [&>svg]:w-full [&>svg]:h-full" dangerouslySetInnerHTML={{ __html: c.svg }} />
            <div className="min-w-0">
              <div className="text-[10px] uppercase tracking-widest text-slate-500">ЦСОП Варна · онлайн стая</div>
              <div className="text-[17px] text-[#0f2240] mt-0.5 leading-tight">{c.name}</div>
              <div className="text-[12px] text-slate-600 mt-0.5">Паралелка {className} · {fmt(room.from_date)} – {fmt(room.to_date)}</div>
              <p className="text-[11.5px] text-slate-600 mt-2 leading-snug">
                Насочете камерата на телефона към кода. Запазете страницата — с нея влизате всеки път, без регистрация. Кодът е личен — не го споделяйте.
              </p>
            </div>
          </div>
        ))}
      </div>
      {!cards.length && <div className="text-center text-sm text-slate-400 py-10">Няма активни линкове.</div>}
    </div>
  )
}
