// Логото на системата (public/jordan-logo-v1.png) + версията от src/lib/version.ts
// Версията стои под „AN“, до D (позицията е в % от картинката, за да пасва при всеки размер).
import { APP_VERSION } from '@/lib/version'

export default function JordanBadge({ height = 40 }: { height?: number }) {
  return (
    <div className="relative inline-block select-none" style={{ height }}>
      <img src="/jordan-logo-v1.png" alt="JORDAN" style={{ height }} className="w-auto" />
      <span className="absolute font-semibold text-[#0f2240] leading-none"
        style={{ left: '83%', bottom: '23%', fontSize: Math.max(9, Math.round(height * 0.19)) }}>
        v{APP_VERSION}
      </span>
    </div>
  )
}
