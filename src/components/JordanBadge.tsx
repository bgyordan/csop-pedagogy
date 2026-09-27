// Логото на системата (public/jordan-logo.png) + версията от src/lib/version.ts
// Версията не е в картинката, за да се сменя само от кода.
import { APP_VERSION } from '@/lib/version'

export default function JordanBadge({ height = 40 }: { height?: number }) {
  return (
    <div className="relative inline-block select-none" style={{ height }}>
      <img src="/jordan-logo.png" alt="JORDAN" style={{ height }} className="w-auto" />
      <span className="absolute top-0 right-0 translate-x-1 -translate-y-1/2 text-[#0f2240] font-semibold"
        style={{ fontSize: Math.max(9, Math.round(height * 0.16)) }}>
        v{APP_VERSION}
      </span>
    </div>
  )
}
