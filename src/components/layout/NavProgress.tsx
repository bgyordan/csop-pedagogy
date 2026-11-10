'use client'
// Тънка лента най-горе, докато се зарежда следващата страница —
// за да е ясно, че кликът е приет (някои страници зареждат по няколко секунди).
import { useEffect, useRef, useState } from 'react'
import { usePathname } from 'next/navigation'

export default function NavProgress() {
  const pathname = usePathname()
  const [width, setWidth] = useState(0)
  const [visible, setVisible] = useState(false)
  const timer = useRef<ReturnType<typeof setInterval> | null>(null)

  function start() {
    if (timer.current) return
    setVisible(true); setWidth(8)
    timer.current = setInterval(() => setWidth(w => (w < 85 ? w + (90 - w) * 0.08 : w)), 200)
  }
  function done() {
    if (timer.current) { clearInterval(timer.current); timer.current = null }
    setWidth(100)
    setTimeout(() => { setVisible(false); setWidth(0) }, 250)
  }

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return
      const a = (e.target as HTMLElement | null)?.closest('a') as HTMLAnchorElement | null
      if (!a || a.target === '_blank' || a.hasAttribute('download')) return
      const href = a.getAttribute('href') || ''
      if (!href || href.startsWith('#') || href.startsWith('mailto:') || href.startsWith('tel:')) return
      let url: URL
      try { url = new URL(a.href, location.href) } catch { return }
      if (url.origin !== location.origin || url.pathname === location.pathname) return
      start()
    }
    document.addEventListener('click', onClick, true)
    return () => document.removeEventListener('click', onClick, true)
  }, [])

  // страницата се смени → лентата стига до края
  useEffect(() => { if (timer.current) done() }, [pathname]) // eslint-disable-line react-hooks/exhaustive-deps
  // предпазно — ако навигацията е прекъсната, лентата не остава завинаги
  useEffect(() => {
    if (!visible) return
    const t = setTimeout(done, 15000)
    return () => clearTimeout(t)
  }, [visible]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!visible) return null
  return (
    <div className="fixed top-0 left-0 right-0 z-[80] h-[3px] pointer-events-none print:hidden" aria-hidden>
      <div className="h-full bg-gradient-to-r from-teal-400 via-cyan-500 to-sky-600 shadow-[0_0_8px_rgba(14,165,233,0.6)] transition-[width] duration-200 ease-out"
        style={{ width: `${width}%` }} />
    </div>
  )
}
