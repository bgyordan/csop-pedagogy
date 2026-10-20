'use client'

// Съобщенията до колегите — изскачат при влизане, по веднъж на човек, като листче от тетрадка
// (като „Днес заместват“ и съобщението на сайта). Показва активните с show_popup, които този потребител
// още не е потвърдил с „Видях“. Пишат ги управата и деловодството (Администрация / Деловодство → Съобщения).
import '@fontsource/caveat/500.css'
import '@fontsource/caveat/700.css'
import { useEffect, useState } from 'react'
import { Check, ArrowRight } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

type Ann = { id: string; title: string; body: string; created_at: string; expires_at: string | null; target_roles: string[] | null; author?: { first_name: string; last_name: string } | null }
const HAND = "'Caveat', cursive"
const dmy = (iso: string) => iso.slice(0, 10).split('-').reverse().join('.')

// Текст → абзаци и точки: редове с „-“, „•“ или „*“ стават списък
function Body({ text }: { text: string }) {
  const blocks: { type: 'p' | 'ul'; lines: string[] }[] = []
  for (const raw of text.split('\n')) {
    const line = raw.trim()
    if (!line) { blocks.push({ type: 'p', lines: [] }); continue }
    const bullet = /^[-•*]\s+/.test(line)
    const last = blocks[blocks.length - 1]
    const type = bullet ? 'ul' : 'p'
    const clean = bullet ? line.replace(/^[-•*]\s+/, '') : line
    if (last && last.type === type && (type === 'ul' || last.lines.length)) last.lines.push(clean)
    else blocks.push({ type, lines: [clean] })
  }
  return (
    <div className="space-y-2">
      {blocks.filter(b => b.lines.length).map((b, i) =>
        b.type === 'ul' ? (
          <ul key={i} className="space-y-2">
            {b.lines.map((l, j) => (
              <li key={j} className="flex gap-3">
                <span style={{ fontFamily: HAND }} className="text-[22px] leading-[28px] text-rose-500 shrink-0">–</span>
                <span>{l}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p key={i}>{b.lines.join(' ')}</p>
        )
      )}
    </div>
  )
}

export default function WhatsNewModal() {
  const supabase = createClient()
  const [queue, setQueue] = useState<Ann[]>([])
  const [idx, setIdx] = useState(0)
  const [closing, setClosing] = useState(false)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    let alive = true
    ;(async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data: me } = await supabase.from('staff_profiles')
        .select('role, therapy_role').eq('user_id', user.id).maybeSingle()
      const roles = [me?.role, me?.therapy_role].filter(Boolean) as string[]

      const today = new Date().toISOString().slice(0, 10)
      const [{ data: anns }, { data: reads }] = await Promise.all([
        supabase.from('announcements')
          .select('id, title, body, created_at, expires_at, target_roles, author:staff_profiles(first_name, last_name)')
          .eq('is_active', true).eq('show_popup', true)
          .order('created_at', { ascending: true }),
        supabase.from('announcement_reads').select('announcement_id').eq('user_id', user.id),
      ])
      const seen = new Set((reads || []).map(r => r.announcement_id))
      const mine = (anns || []).filter((a: any) =>
        !seen.has(a.id) &&
        (!a.expires_at || a.expires_at.slice(0, 10) >= today) &&
        (!a.target_roles?.length || a.target_roles.some((r: string) => roles.includes(r)))
      )
      if (alive) setQueue(mine.map((a: any) => ({ ...a, author: Array.isArray(a.author) ? a.author[0] : a.author })) as Ann[])
    })()
    return () => { alive = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const current = queue[idx]
  if (!current) return null
  const last = idx === queue.length - 1

  async function ok() {
    if (busy) return
    setBusy(true)
    await supabase.from('announcement_reads').insert({ announcement_id: current.id })
    setBusy(false)
    if (last) {
      setClosing(true)
      setTimeout(() => setQueue([]), 220)
    } else {
      setIdx(i => i + 1)
    }
  }

  return (
    <div className={`fixed inset-0 z-[70] flex items-center justify-center p-4 bg-slate-900/25 backdrop-blur-[3px] eis-fade ${closing ? 'eis-out' : ''}`}
         role="dialog" aria-modal="true" aria-labelledby="whatsnew-title">
      <style>{`
        @keyframes eisFade { from { opacity: 0 } to { opacity: 1 } }
        @keyframes eisPop { from { opacity: 0; transform: translateY(12px) scale(.97) } to { opacity: 1; transform: none } }
        .eis-fade { animation: eisFade .25s ease-out both }
        .eis-pop { animation: eisPop .35s cubic-bezier(.2,.8,.2,1) both }
        .eis-out { opacity: 0; transition: opacity .2s ease-in }
      `}</style>

      <div key={current.id} className="eis-pop w-full max-w-lg">
      <div className="relative -rotate-[0.8deg]" style={{ filter: 'drop-shadow(0 22px 34px rgba(60,40,10,0.22))' }}>
        {/* тиксо */}
        <span className="absolute -top-3 left-1/2 -translate-x-1/2 w-32 h-7 rotate-[-2deg] rounded-sm z-10"
          style={{ background: 'rgba(255,255,255,0.6)', boxShadow: '0 1px 2px rgba(0,0,0,0.08)' }} />
        <div className="rounded-[3px] pt-9 pb-6 pr-7 pl-16"
          style={{
            background: '#fffdf3',
            backgroundImage: 'linear-gradient(90deg, transparent 46px, rgba(239,68,68,0.35) 46px, rgba(239,68,68,0.35) 47.5px, transparent 47.5px), repeating-linear-gradient(transparent, transparent 27px, rgba(59,130,246,0.16) 27px, rgba(59,130,246,0.16) 28px)',
            backgroundPosition: '0 0, 0 22px',
          }}>
          <div className="flex items-center gap-2 text-[12px] text-slate-400">
            <span>{new Date(current.created_at).toLocaleDateString('bg-BG', { day: 'numeric', month: 'long' })}</span>
            {current.author && <span>· {current.author.first_name} {current.author.last_name}</span>}
            {queue.length > 1 && <span className="ml-auto">{idx + 1} от {queue.length}</span>}
          </div>
          <h2 id="whatsnew-title" style={{ fontFamily: HAND, color: '#0f2240' }} className="mt-1 text-[34px] leading-[36px] font-bold">
            {current.title}
          </h2>
          <div className="mt-3 text-[15px] leading-[28px] text-slate-700 max-h-[50vh] overflow-y-auto">
            <Body text={current.body} />
          </div>
          {current.expires_at && (
            <p style={{ fontFamily: HAND }} className="mt-3 text-[21px] text-rose-600 -rotate-1">важи до {dmy(current.expires_at)}</p>
          )}
          <div className="mt-5 flex justify-end">
            <button type="button" onClick={ok} disabled={busy} autoFocus
              className="inline-flex items-center gap-1.5 px-5 py-1.5 rounded-full border-2 border-[#0f2240]/70 text-[#0f2240] hover:bg-[#0f2240] hover:text-white transition-colors -rotate-[1deg] disabled:opacity-60"
              style={{ fontFamily: HAND, fontSize: 23 }}>
              {last ? <><Check size={16} /> Видях</> : <>Видях <ArrowRight size={16} /></>}
            </button>
          </div>
        </div>
      </div>
      </div>
    </div>
  )
}
