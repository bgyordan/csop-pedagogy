// Малкото лого на системата + версията (вход, табло)
import { APP_VERSION } from '@/lib/version'

export default function JordanBadge({ subtitle = true }: { subtitle?: boolean }) {
  return (
    <div className="flex items-center justify-center gap-3 select-none">
      <img src="/jordan-emblem.png" alt="" className="w-11 h-11 rounded-full shadow-sm transition-transform duration-500 hover:rotate-[360deg]" />
      <div className="text-left leading-tight">
        <div className="flex items-center gap-1.5">
          <span className="text-sm font-bold tracking-[0.18em] text-[#4a7fb0]">JORDAN</span>
          <span className="text-[10px] font-semibold px-1.5 py-px rounded-full bg-amber-100 text-amber-700">v{APP_VERSION}</span>
        </div>
        {subtitle && <div className="text-[11px] text-slate-400">система за образователна подкрепа</div>}
      </div>
    </div>
  )
}
