'use client'

import { useEffect, useState } from 'react'
import { Clock } from 'lucide-react'

export function Header() {
  const [secondsLeft, setSecondsLeft] = useState(30 * 60)

  useEffect(() => {
    let lastActivity = Date.now()

    function resetTimer() {
      lastActivity = Date.now()
    }

    const events = ['mousedown', 'mousemove', 'keydown', 'scroll', 'touchstart']
    events.forEach(e => window.addEventListener(e, resetTimer))

    const interval = setInterval(() => {
      const elapsed = Date.now() - lastActivity
      const remaining = Math.max(0, 30 * 60 * 1000 - elapsed)
      setSecondsLeft(Math.ceil(remaining / 1000))
    }, 1000)

    return () => {
      events.forEach(e => window.removeEventListener(e, resetTimer))
      clearInterval(interval)
    }
  }, [])

  const minutes = Math.floor(secondsLeft / 60)
  const seconds = secondsLeft % 60
  const isWarning = secondsLeft <= 5 * 60

  return (
    <header className="hidden md:flex items-center justify-end px-6 py-2.5 border-b border-slate-200/60 bg-white/80 backdrop-blur-sm sticky top-0 z-30">
      <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-medium transition-all ${
        isWarning
          ? 'bg-rose-50 border-rose-200 text-rose-700 animate-pulse'
          : 'bg-slate-50 border-slate-200 text-slate-500'
      }`}>
        <Clock size={13} className={isWarning ? 'text-rose-500' : 'text-slate-400'} />
        <span className="font-mono tabular-nums">
          Сесия: {String(minutes).padStart(2, '0')}:{String(seconds).padStart(2, '0')}
        </span>
      </div>
    </header>
  )
}
