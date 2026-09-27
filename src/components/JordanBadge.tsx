// Малкото лого на системата + версията (вход, табло)
// JORDAN е с кръгъл шрифт (Comfortaa) в цветовете на емблемата; при посочване буквите „подскачат“.
import { APP_VERSION } from '@/lib/version'

const LETTERS = [
  ['J', '#4a7fb0'], ['O', '#5a93b8'], ['R', '#6aa9b0'], ['D', '#7fbf9e'], ['A', '#a3c77c'], ['N', '#e2b04e'],
]

export default function JordanBadge() {
  return (
    <div className="group flex items-center justify-center gap-2.5 select-none">
      <img src="/jordan-emblem.png" alt="" className="w-10 h-10 rounded-full shadow-sm transition-transform duration-700 group-hover:rotate-[360deg]" />
      <span className="flex items-baseline" style={{ fontFamily: 'Comfortaa, sans-serif' }} aria-label="JORDAN">
        {LETTERS.map(([ch, color], i) => (
          <span key={i} className="text-[19px] font-bold tracking-[0.08em] transition-transform duration-300 group-hover:-translate-y-1"
            style={{ color, transitionDelay: `${i * 45}ms` }}>{ch}</span>
        ))}
        <sup className="ml-1 text-[10px] font-bold text-slate-400">v{APP_VERSION}</sup>
      </span>
    </div>
  )
}
