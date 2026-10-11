'use client'

// Под публикацията: три бутона с един клик + кратък въпрос. След изпращане страницата се опреснява.

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Check, HelpCircle, RotateCcw, Send, Loader2 } from 'lucide-react'
import { sendParentMessage } from './actions'

export default function ParentReply({ token, postId }: { token: string; postId: string }) {
  const router = useRouter()
  const [text, setText] = useState('')
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState<string | null>(null)
  const [msg, setMsg] = useState<{ ok: boolean; t: string } | null>(null)

  async function send(kind: string) {
    setBusy(kind); setMsg(null)
    const r: any = await sendParentMessage(token, postId, kind, kind === 'text' ? text : '')
    setBusy(null)
    if (r?.error) { setMsg({ ok: false, t: r.error }); return }
    setText(''); setOpen(false)
    setMsg({ ok: true, t: 'Изпратено — учителят ще го види.' })
    router.refresh()
  }

  const btn = 'inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border text-[14px] disabled:opacity-50'
  return (
    <div className="mt-3 pt-3 border-t border-slate-100">
      <div className="flex flex-wrap gap-2">
        <button type="button" disabled={!!busy} onClick={() => send('ok')} className={`${btn} border-emerald-200 bg-emerald-50 text-emerald-800`}>
          {busy === 'ok' ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} />} Разбрахме
        </button>
        <button type="button" disabled={!!busy} onClick={() => send('unclear')} className={`${btn} border-amber-200 bg-amber-50 text-amber-800`}>
          {busy === 'unclear' ? <Loader2 size={15} className="animate-spin" /> : <HelpCircle size={15} />} Не разбирам
        </button>
        <button type="button" disabled={!!busy} onClick={() => send('resend')} className={`${btn} border-slate-200 bg-white text-slate-700`}>
          {busy === 'resend' ? <Loader2 size={15} className="animate-spin" /> : <RotateCcw size={15} />} Пратете отново
        </button>
        {!open && <button type="button" onClick={() => setOpen(true)} className={`${btn} border-slate-200 bg-white text-slate-700`}>Напиши въпрос</button>}
      </div>
      {open && (
        <div className="flex gap-2 mt-2">
          <input value={text} onChange={e => setText(e.target.value.slice(0, 500))} placeholder="Кратък въпрос към учителя…"
            className="flex-1 min-w-0 px-3 py-2 border border-slate-200 rounded-xl text-[15px] focus:outline-none focus:border-[#0f2240]" />
          <button type="button" disabled={!!busy || !text.trim()} onClick={() => send('text')} className={`${btn} border-[#0f2240] text-white`} style={{ backgroundColor: '#0f2240' }}>
            {busy === 'text' ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />}
          </button>
        </div>
      )}
      {msg && <p className={`text-[13px] mt-2 ${msg.ok ? 'text-emerald-700' : 'text-rose-700'}`}>{msg.t}</p>}
    </div>
  )
}
