'use client'
import { useState } from 'react'
import { Loader2, Check, ChevronDown, ChevronUp, Undo2, Search } from 'lucide-react'
import { useToast } from '@/components/ui/Toast'
import { verifyDeclaration, unverifyDeclaration, getDeclarationDetail } from './actions'

type Row = { id: string; staffName: string; periodFrom: string; periodTo: string; totalHours: number; status: string }
function fmt(d: string) { return d ? d.split('-').reverse().join('.') : '' }
const STATUS: Record<string, { l: string; c: string }> = {
  submitted: { l: 'Подадена', c: 'bg-blue-50 text-blue-600' },
  verified: { l: 'Проверена', c: 'bg-emerald-50 text-emerald-600' },
  paid: { l: 'Изплатена', c: 'bg-slate-100 text-slate-500' },
}

export default function ReviewClient({ rows: initial }: { rows: Row[] }) {
  const { toast } = useToast()
  const [rows, setRows] = useState<Row[]>(initial)
  const [search, setSearch] = useState('')
  const [openId, setOpenId] = useState<string | null>(null)
  const [detail, setDetail] = useState<any[] | null>(null)
  const [loadingDetail, setLoadingDetail] = useState(false)
  const [busy, setBusy] = useState<string | null>(null)

  const filtered = rows.filter(r => r.staffName.toLowerCase().includes(search.toLowerCase()))

  async function toggle(id: string) {
    if (openId === id) { setOpenId(null); setDetail(null); return }
    setOpenId(id); setLoadingDetail(true); setDetail(null)
    const res: any = await getDeclarationDetail(id)
    setDetail(res.rows || [])
    setLoadingDetail(false)
  }

  async function verify(id: string) {
    setBusy(id)
    const res: any = await verifyDeclaration(id)
    if (res.error) { toast(res.error, 'error'); setBusy(null); return }
    setRows(prev => prev.map(r => r.id === id ? { ...r, status: 'verified' } : r))
    toast('Потвърдена')
    setBusy(null)
  }
  async function unverify(id: string) {
    setBusy(id)
    const res: any = await unverifyDeclaration(id)
    if (res.error) { toast(res.error, 'error'); setBusy(null); return }
    setRows(prev => prev.map(r => r.id === id ? { ...r, status: 'submitted' } : r))
    toast('Върната за корекция')
    setBusy(null)
  }

  return (
    <div className="space-y-3">
      <div className="relative max-w-sm">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Търси учител…"
          className="w-full pl-9 pr-3 py-2 bg-white border border-slate-200 rounded-full text-sm focus:outline-none focus:border-slate-400" />
      </div>

      {filtered.length === 0 ? (
        <div className="bg-white border border-dashed border-slate-300 rounded-2xl p-14 text-center text-sm text-slate-400">Няма декларации.</div>
      ) : filtered.map(r => {
        const st = STATUS[r.status] || STATUS.submitted
        const open = openId === r.id
        return (
          <div key={r.id} className="bg-white border border-slate-200 rounded-2xl shadow-[0_1px_4px_rgba(15,34,64,0.06)] overflow-hidden">
            <div className="flex items-center gap-3 px-4 py-3">
              <button onClick={() => toggle(r.id)} className="flex-1 flex items-center gap-2 text-left">
                {open ? <ChevronUp size={15} className="text-slate-400" /> : <ChevronDown size={15} className="text-slate-400" />}
                <div>
                  <div className="text-sm text-slate-800">{r.staffName}</div>
                  <div className="text-xs text-slate-500">{fmt(r.periodFrom)} – {fmt(r.periodTo)} · <span className="font-medium">{r.totalHours} ч.</span></div>
                </div>
              </button>
              <span className={`text-[11px] px-2 py-0.5 rounded-full ${st.c}`}>{st.l}</span>
              {r.status === 'submitted' && (
                <button onClick={() => verify(r.id)} disabled={busy === r.id}
                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-white text-xs font-medium hover:opacity-90 disabled:opacity-50" style={{ backgroundColor: '#0f2240' }}>
                  {busy === r.id ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />} Потвърди
                </button>
              )}
              {r.status === 'verified' && (
                <button onClick={() => unverify(r.id)} disabled={busy === r.id}
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs text-slate-500 hover:bg-slate-100" title="Върни за корекция">
                  <Undo2 size={13} />
                </button>
              )}
            </div>
            {open && (
              <div className="px-4 pb-3 border-t border-slate-100 pt-3 bg-slate-50/40">
                {loadingDetail ? (
                  <div className="text-center py-3"><Loader2 size={16} className="animate-spin inline text-slate-400" /></div>
                ) : (detail || []).length === 0 ? (
                  <div className="text-xs text-slate-400">Няма данни.</div>
                ) : (
                  <div className="space-y-2">
                    {(detail || []).map((d: any, i: number) => (
                      <div key={i}>
                        <div className="text-xs font-medium text-slate-600">{d.label} <span className="text-slate-400">({d.count} ч.)</span></div>
                        <div className="text-[11px] text-slate-500 mt-0.5">{d.dates.join(' · ')}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
