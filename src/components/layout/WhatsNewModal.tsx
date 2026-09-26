'use client'

// „Какво ново в JORDAN“ — изскача при влизане, по веднъж на човек.
// Показва активните съобщения с show_popup, които този потребител още не е потвърдил с „Разбрах“.

import { useEffect, useState } from 'react'
import { Sparkles, Check, ArrowRight } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

type Ann = { id: string; title: string; body: string; created_at: string; target_roles: string[] | null }

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
    <div className="space-y-3">
      {blocks.filter(b => b.lines.length).map((b, i) =>
        b.type === 'ul' ? (
          <ul key={i} className="space-y-2">
            {b.lines.map((l, j) => (
              <li key={j} className="flex gap-3">
                <span className="mt-[9px] w-1.5 h-1.5 rounded-full bg-gradient-to-br from-teal-400 to-cyan-500 shrink-0" />
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
          .select('id, title, body, created_at, expires_at, target_roles')
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
      if (alive) setQueue(mine)
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

      <div key={current.id} className="eis-pop w-full max-w-lg bg-white rounded-3xl shadow-2xl shadow-slate-900/10 overflow-hidden border border-white">
        {/* горна част */}
        <div className="relative px-7 pt-7 pb-5 bg-gradient-to-br from-teal-50 via-cyan-50 to-sky-50 overflow-hidden">
          <div className="absolute -top-16 -right-10 w-48 h-48 rounded-full bg-cyan-200/40 blur-3xl" />
          <div className="absolute -bottom-20 -left-10 w-40 h-40 rounded-full bg-teal-200/40 blur-3xl" />
          <div className="relative flex items-center gap-3">
            <span className="w-11 h-11 rounded-2xl bg-white shadow-sm flex items-center justify-center">
              <Sparkles size={20} className="text-teal-500" />
            </span>
            <span className="px-2.5 py-1 rounded-full bg-white/70 text-[11px] uppercase tracking-wider text-teal-700">
              Ново в JORDAN
            </span>
            {queue.length > 1 && (
              <span className="ml-auto flex items-center gap-1.5" aria-label={`${idx + 1} от ${queue.length}`}>
                {queue.map((_, i) => (
                  <span key={i} className={`h-1.5 rounded-full transition-all ${i === idx ? 'w-5 bg-teal-500' : 'w-1.5 bg-teal-200'}`} />
                ))}
              </span>
            )}
          </div>
          <h2 id="whatsnew-title" className="relative mt-4 text-xl font-semibold leading-snug" style={{ color: '#0f2240' }}>
            {current.title}
          </h2>
          <p className="relative mt-1 text-xs text-slate-400 font-light">
            {new Date(current.created_at).toLocaleDateString('bg-BG', { day: 'numeric', month: 'long', year: 'numeric' })}
          </p>
        </div>

        {/* текст */}
        <div className="px-7 py-5 text-[15px] leading-relaxed text-slate-600 font-light max-h-[50vh] overflow-y-auto">
          <Body text={current.body} />
        </div>

        {/* бутон */}
        <div className="px-7 pb-6 pt-1 flex items-center justify-end gap-3">
          {queue.length > 1 && (
            <span className="mr-auto text-xs text-slate-400 font-light">{idx + 1} от {queue.length}</span>
          )}
          <button type="button" onClick={ok} disabled={busy} autoFocus
            className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-medium text-white bg-gradient-to-r from-teal-500 to-cyan-500 shadow-md shadow-cyan-500/20 hover:shadow-lg hover:shadow-cyan-500/30 hover:-translate-y-0.5 transition disabled:opacity-60">
            {last ? <><Check size={16} /> Разбрах</> : <>Разбрах <ArrowRight size={16} /></>}
          </button>
        </div>
      </div>
    </div>
  )
}
