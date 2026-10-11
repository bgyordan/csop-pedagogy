'use client'
import { useRouter } from 'next/navigation'
import { Plus } from 'lucide-react'

// „Започни за дете“ — води към досието на детето, таб PECS
export default function StartPicker({ candidates }: { candidates: { id: string; name: string }[] }) {
  const router = useRouter()
  return (
    <label className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-slate-300 bg-white text-[13px] text-slate-700">
      <Plus size={14} />
      <select defaultValue="" onChange={e => e.target.value && router.push(`/students/${e.target.value}?tab=pecs`)} className="bg-transparent focus:outline-none">
        <option value="">Започни за дете…</option>
        {candidates.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
      </select>
    </label>
  )
}
