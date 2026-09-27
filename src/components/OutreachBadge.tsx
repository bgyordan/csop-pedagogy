// Етикет „изнесена група“ (classes.outreach_location) — Виница / Тополи
import { MapPin } from 'lucide-react'

export function outreachShort(loc?: string | null) {
  if (!loc) return null
  if (/виница/i.test(loc)) return 'Виница'
  if (/тополи/i.test(loc)) return 'Тополи'
  return loc.split(/[–-]/).pop()!.trim()
}

export default function OutreachBadge({ location, size = 'sm' }: { location?: string | null; size?: 'xs' | 'sm' }) {
  const short = outreachShort(location)
  if (!short) return null
  return (
    <span
      title={`Изнесена група: ${location}`}
      className={`inline-flex items-center gap-0.5 rounded-md border border-teal-200 bg-teal-50 text-teal-700 font-semibold whitespace-nowrap align-middle ${
        size === 'xs' ? 'text-[9px] px-1 py-px' : 'text-[11px] px-1.5 py-0.5'
      }`}
    >
      <MapPin size={size === 'xs' ? 9 : 11} />{short}
    </span>
  )
}
