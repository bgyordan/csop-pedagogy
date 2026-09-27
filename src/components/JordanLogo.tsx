// Логото „JORDAN“ — буквата O е цветен пръстен от 4 части (ученици · екип · документи · график)
// Използва се на входната страница. v2 = малка наклонена лепенка.

export default function JordanLogo({ v2 = true, className = '' }: { v2?: boolean; className?: string }) {
  const letter = 'text-[44px] leading-none font-extrabold tracking-[0.04em] text-[#0f2240]'
  return (
    <div className={`group relative inline-flex items-end select-none ${className}`} aria-label="JORDAN">
      <span className={letter}>J</span>
      {/* O — пръстенът */}
      <svg viewBox="0 0 40 40" className="mx-[3px] mb-[3px] w-[38px] h-[38px] transition-transform duration-700 ease-out group-hover:rotate-[270deg]" aria-hidden="true">
        <g fill="none" strokeWidth="8" strokeLinecap="round">
          <path d="M20 4 A16 16 0 0 1 36 20" stroke="#0ea5e9" />
          <path d="M36 20 A16 16 0 0 1 20 36" stroke="#14b8a6" />
          <path d="M20 36 A16 16 0 0 1 4 20" stroke="#f59e0b" />
          <path d="M4 20 A16 16 0 0 1 20 4" stroke="#0f2240" />
        </g>
        <circle cx="20" cy="20" r="3" fill="#0f2240" className="transition-opacity duration-500 group-hover:opacity-0" />
      </svg>
      <span className={letter}>RDAN</span>
      {v2 && (
        <span className="absolute -top-3 -right-7 rotate-12 rounded-md bg-amber-400 px-1.5 py-0.5 text-[11px] font-extrabold text-[#0f2240] shadow-sm transition-transform duration-300 group-hover:rotate-0 group-hover:scale-110">
          v2
        </span>
      )}
    </div>
  )
}
