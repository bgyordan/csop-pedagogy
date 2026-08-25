'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { RotateCcw, Loader2 } from 'lucide-react'
interface Row {
  id: string
  name: string
  externalClass: string
  school: string
  schoolCity: string
  reason: string
  archivedAt: string | null
}
function fmtDate(d: string | null) {
  if (!d) return ''
  return new Date(d).toLocaleDateString('bg-BG')
}
export default function ArchivedClient({ rows }: { rows: Row[] }) {
  const router = useRouter()
  const supabase = createClient()
  const [restoring, setRestoring] = useState<string | null>(null)

  async function handleRestore(id: string, name: string) {
    if (!confirm(`Върни "${name}" от архива? Ученикът ще стане активен, но трябва да го зачислиш в паралелка отново.`)) return
    setRestoring(id)
    const { error } = await supabase.from('students')
      .update({ status: 'active', archive_reason: null, archived_at: null })
      .eq('id', id)
    setRestoring(null)
    if (error) { alert('Грешка при връщане'); return }
    router.refresh()
  }

  if (rows.length === 0) {
    return (
      <div className="text-center py-12 text-slate-400 text-sm bg-slate-50/50 rounded-2xl border border-dashed border-slate-200">
        Няма архивирани ученици
      </div>
    )
  }

  return (
    <div className="space-y-2">
      {rows.map(r => (
        <div key={r.id} className="flex items-start justify-between gap-3 p-4 bg-white rounded-2xl border border-slate-200 shadow-sm">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm font-semibold text-slate-800">{r.name}</span>
              {r.externalClass && <span className="text-[10px] text-slate-400">({r.externalClass})</span>}
              {r.archivedAt && (
                <span className="text-[10px] text-slate-400">· архивиран {fmtDate(r.archivedAt)}</span>
              )}
            </div>
            {r.school && (
              <div className="text-xs text-slate-500 mt-0.5">
                {r.school}{r.schoolCity ? ` · ${r.schoolCity}` : ''}
              </div>
            )}
            {r.reason && (
              <div className="text-xs text-slate-600 mt-1.5 bg-slate-50 border border-slate-100 rounded-lg px-2.5 py-1.5">
                <span className="text-slate-400">Причина: </span>{r.reason}
              </div>
            )}
          </div>
          <button onClick={() => handleRestore(r.id, r.name)} disabled={restoring === r.id}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-50 transition-colors flex-shrink-0 disabled:opacity-60"
            title="Върни от архива">
            {restoring === r.id ? <Loader2 size={13} className="animate-spin" /> : <RotateCcw size={13} />}
            Върни
          </button>
        </div>
      ))}
    </div>
  )
}
