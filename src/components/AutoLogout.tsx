'use client'

import { useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

const TIMEOUT = 30 * 60 * 1000 // 30 минути

export function AutoLogout() {
  const router = useRouter()
  const timer = useRef<NodeJS.Timeout | null>(null)
  const supabase = createClient()

  function resetTimer() {
    clearTimeout(timer.current)
    timer.current = setTimeout(async () => {
      await supabase.auth.signOut()
      router.push('/auth/login')
    }, TIMEOUT)
  }

  useEffect(() => {
    const events = ['mousedown', 'mousemove', 'keydown', 'scroll', 'touchstart']
    events.forEach(e => window.addEventListener(e, resetTimer))
    resetTimer()
    return () => {
      events.forEach(e => window.removeEventListener(e, resetTimer))
      clearTimeout(timer.current)
    }
  }, [])

  return null
}
