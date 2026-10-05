'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

const TIMEOUT = 30 * 60 * 1000       // 30 минути → изход
const WARNING = 25 * 60 * 1000       // 25 минути → предупреждение
const REMAINING = TIMEOUT - WARNING  // 5 минути за реакция

// Активността е ОБЩА за всички табове на браузъра: ако работиш в един таб, другите не те изписват.
// (По-рано всеки таб броеше сам и неактивен таб изписваше човека и в таба, в който работи.)
const KEY = 'eis_last_activity'
const readShared = () => { try { return Number(localStorage.getItem(KEY)) || 0 } catch { return 0 } }
const writeShared = (t: number) => { try { localStorage.setItem(KEY, String(t)) } catch { /* без localStorage — само този таб */ } }
// Изход само от ТОЗИ браузър — не затваря сесиите на човека на други устройства (телефон, друг компютър)
const signOutHere = (supabase: ReturnType<typeof createClient>) => supabase.auth.signOut({ scope: 'local' })

export function AutoLogout() {
  const router = useRouter()
  const supabase = createClient()
  const [showWarning, setShowWarning] = useState(false)
  const [countdown, setCountdown] = useState(5 * 60) // секунди

  useEffect(() => {
    let warningTimer: ReturnType<typeof setTimeout>
    let logoutTimer: ReturnType<typeof setTimeout>
    let countdownInterval: ReturnType<typeof setInterval>

    let lastWrite = 0
    let lastLocal = Date.now()
    // колко време е минало от последната активност във ВСИЧКИ табове
    const sinceShared = () => Date.now() - Math.max(readShared(), lastLocal)

    function resetTimer() {
      lastLocal = Date.now()
      if (lastLocal - lastWrite > 10_000) { lastWrite = lastLocal; writeShared(lastLocal) }   // не пишем при всяко мърдане на мишката
      schedule(WARNING)
    }

    function schedule(wait: number) {
      clearTimeout(warningTimer)
      clearTimeout(logoutTimer)
      clearInterval(countdownInterval)
      setShowWarning(false)
      setCountdown(5 * 60)

      warningTimer = setTimeout(() => {
        // в друг таб е имало активност — не предупреждаваме, броим отначало от нея
        const idle = sinceShared()
        if (idle < WARNING - 1000) { schedule(WARNING - idle); return }
        setShowWarning(true)
        setCountdown(5 * 60)

        // Броене назад
        countdownInterval = setInterval(() => {
          setCountdown(prev => {
            if (prev <= 1) {
              clearInterval(countdownInterval)
              return 0
            }
            return prev - 1
          })
        }, 1000)

        // Изход след 5 минути
        logoutTimer = setTimeout(async () => {
          // последна проверка — ако междувременно е работено в друг таб, не изписваме
          if (sinceShared() < TIMEOUT - 1000) { setShowWarning(false); schedule(WARNING - sinceShared()); return }
          setShowWarning(false)
          await signOutHere(supabase)
          router.push('/auth/login')
        }, REMAINING)
      }, Math.max(1000, wait))
    }

    // активност в друг таб → и тук броим отначало (и махаме предупреждението, ако е показано)
    function onStorage(e: StorageEvent) { if (e.key === KEY) { lastLocal = Number(e.newValue) || Date.now(); schedule(WARNING) } }
    window.addEventListener('storage', onStorage)

    const events = ['mousedown', 'mousemove', 'keydown', 'scroll', 'touchstart']
    events.forEach(e => window.addEventListener(e, resetTimer))
    resetTimer()

    return () => {
      events.forEach(e => window.removeEventListener(e, resetTimer))
      window.removeEventListener('storage', onStorage)
      clearTimeout(warningTimer)
      clearTimeout(logoutTimer)
      clearInterval(countdownInterval)
    }
  }, [])

  function handleContinue() {
    // Симулираме активност → resetTimer се извиква
    window.dispatchEvent(new Event('mousedown'))
    setShowWarning(false)
  }

  async function handleLogout() {
    setShowWarning(false)
    await signOutHere(supabase)
    router.push('/auth/login')
  }

  if (!showWarning) return null

  const minutes = Math.floor(countdown / 60)
  const seconds = countdown % 60

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white rounded-2xl shadow-2xl p-6 mx-4 max-w-sm w-full">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center flex-shrink-0">
            <span className="text-amber-600 text-lg">⏱</span>
          </div>
          <div>
            <h2 className="font-semibold text-slate-800">Сесията изтича</h2>
            <p className="text-xs text-slate-500">Поради неактивност</p>
          </div>
        </div>

        <p className="text-sm text-slate-600 mb-2">
          Ще бъдете изведени автоматично след:
        </p>
        <div className="text-3xl font-bold text-center text-amber-600 mb-4 tabular-nums">
          {String(minutes).padStart(2, '0')}:{String(seconds).padStart(2, '0')}
        </div>
        <p className="text-xs text-slate-400 text-center mb-5">
          Незапазените промени ще бъдат изгубени.
        </p>

        <div className="flex gap-3">
          <button
            onClick={handleLogout}
            className="flex-1 px-4 py-2.5 rounded-xl border border-slate-200 text-sm text-slate-600 hover:bg-slate-50 transition-colors"
          >
            Изход
          </button>
          <button
            onClick={handleContinue}
            className="flex-1 px-4 py-2.5 rounded-xl text-sm font-medium text-white transition-colors"
            style={{ backgroundColor: '#0f2240' }}
          >
            Продължи работа
          </button>
        </div>
      </div>
    </div>
  )
}
