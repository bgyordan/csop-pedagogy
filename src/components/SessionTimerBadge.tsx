'use client'

import { useEffect, useState } from 'react'
import { Clock } from 'lucide-react'

export function SessionTimerBadge() {
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
    <div className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
      isWarning
        ? 'bg-rose-500/20 border border-rose-400/40 text-rose-200 animate-pulse'
        : 'bg-white/10 border border-white/10 text-sky-100/70'
    }`}>
      <Clock size={12} />
      <span className="font-mono tabular-nums tracking-wider">
        {String(minutes).padStart(2, '0')}:{String(seconds).padStart(2, '0')}
      </span>
      {isWarning && <span className="text-[10px]">Сесията изтича!</span>}
    </div>
  )
}
