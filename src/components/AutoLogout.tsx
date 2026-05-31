'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

const TIMEOUT = 30 * 60 * 1000

export function AutoLogout() {
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>

    function resetTimer() {
      clearTimeout(timer)
      timer = setTimeout(async () => {
        await supabase.auth.signOut()
        router.push('/auth/login')
      }, TIMEOUT)
    }

    const events = ['mousedown', 'mousemove', 'keydown', 'scroll', 'touchstart']
    events.forEach(e => window.addEventListener(e, resetTimer))
    resetTimer()

    return () => {
      events.forEach(e => window.removeEventListener(e, resetTimer))
      clearTimeout(timer)
    }
  }, [])

  return null
}
