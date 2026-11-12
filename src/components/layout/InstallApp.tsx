'use client'
// „Инсталирай като приложение“ — системата се отваря от икона на работния плот/телефона, в собствен прозорец.
// Chrome/Edge/Android дават готов прозорец за инсталиране; на iPhone/iPad се прави ръчно от Safari — показваме как.
// Тук се включва и помощникът (sw.js), който при липса на интернет показва понятна страница.
import { useEffect, useState } from 'react'
import { Download } from 'lucide-react'
import { useToast } from '@/components/ui/Toast'

type PromptEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }> }

// събитието идва веднъж, често преди менюто да се е показало — пазим го общо
let saved: PromptEvent | null = null
const listeners = new Set<() => void>()
if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); saved = e as PromptEvent; listeners.forEach(f => f()) })
  window.addEventListener('appinstalled', () => { saved = null; listeners.forEach(f => f()) })
}

// за други компоненти (напр. картата на таблото): може ли сега да се инсталира с готовия прозорец на браузъра
export function useCanInstall() {
  const [can, setCan] = useState(false)
  useEffect(() => {
    const sync = () => setCan(!!saved)
    sync()
    listeners.add(sync)
    return () => { listeners.delete(sync) }
  }, [])
  return can
}

export default function InstallApp({ className, style, onDone }: { className?: string; style?: React.CSSProperties; onDone?: () => void }) {
  const { toast } = useToast()
  const [can, setCan] = useState(false)
  const [ios, setIos] = useState(false)

  useEffect(() => {
    if ('serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('/sw.js').catch(() => {})
    const standalone = window.matchMedia('(display-mode: standalone)').matches || (navigator as any).standalone === true
    const ua = navigator.userAgent
    const isIos = /iPad|iPhone|iPod/.test(ua) || (ua.includes('Macintosh') && navigator.maxTouchPoints > 1)
    setIos(isIos && !standalone)
    const sync = () => setCan(!!saved && !standalone)
    sync()
    listeners.add(sync)
    return () => { listeners.delete(sync) }
  }, [])

  if (!can && !ios) return null

  async function install() {
    onDone?.()
    if (saved) {
      const ev = saved
      await ev.prompt()
      const { outcome } = await ev.userChoice
      saved = null; setCan(false)
      if (outcome === 'accepted') toast('Приложението е инсталирано — търсете иконата „ЕИС ЦСОП“')
      return
    }
    toast('На iPhone/iPad: отворете системата в Safari, натиснете „Сподели“ и изберете „Добави към началния екран“.')
  }

  return (
    <button type="button" onClick={install} className={className} style={style}>
      <Download size={14} /> Инсталирай като приложение
    </button>
  )
}
