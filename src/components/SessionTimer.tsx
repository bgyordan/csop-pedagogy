'use client'

import { useEffect, useState } from 'react'
import { Clock } from 'lucide-react'

const WARNING = 25 * 60 * 1000 // 25 минути

export function SessionTimer() {
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
    <div className={`hidden md:flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-medium transition-all ${
      isWarning
        ? 'bg-rose-50 border-rose-200 text-rose-700 animate-pulse'
        : 'bg-slate-50 border-slate-200 text-slate-500'
    }`}>
      <Clock size={13} className={isWarning ? 'text-rose-500' : 'text-slate-400'} />
      <span className="font-mono tabular-nums">
        {String(minutes).padStart(2, '0')}:{String(seconds).padStart(2, '0')}
      </span>
    </div>
  )
}
