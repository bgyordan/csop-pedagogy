'use client'
// Карта „Инсталирай приложението“ на таблото — за помощниците (влизат с QR, ползват телефон с Android).
// Показва се само когато браузърът дава готов прозорец за инсталиране (Chrome на Android) и EIS още не е отворена като приложение.
// След инсталиране входът остава (приложението споделя входа с Chrome). „По-късно“ я скрива на това устройство.
import { useEffect, useState } from 'react'
import { Smartphone } from 'lucide-react'
import InstallApp, { useCanInstall } from '@/components/layout/InstallApp'

const KEY = 'eis_install_later'

export default function InstallCard() {
  const [show, setShow] = useState(false)
  const can = useCanInstall()
  useEffect(() => {
    const standalone = window.matchMedia('(display-mode: standalone)').matches || (navigator as any).standalone === true
    let later = false
    try { later = localStorage.getItem(KEY) === '1' } catch { /* */ }
    setShow(!standalone && !later)
  }, [])
  if (!show || !can) return null

  const hide = () => { try { localStorage.setItem(KEY, '1') } catch { /* */ } setShow(false) }

  return (
    <div className="rounded-2xl border border-teal-200 bg-gradient-to-r from-teal-50 to-cyan-50 px-4 py-3 flex items-center gap-3 empty:hidden">
      <Smartphone size={22} className="text-teal-600 shrink-0" />
      <div className="min-w-0 flex-1">
        <div className="text-[14px] text-[#0f2240]">Сложи EIS на телефона</div>
        <div className="text-xs text-slate-500">Иконка на началния екран — отваряш с едно докосване, без нов вход.</div>
      </div>
      <div className="flex flex-col items-end gap-1 shrink-0">
        <InstallApp onDone={() => setShow(false)}
          className="flex items-center gap-1.5 text-sm px-3 py-2 rounded-xl text-white bg-gradient-to-r from-teal-600 to-cyan-600 hover:opacity-90" />
        <button type="button" onClick={hide} className="text-[11px] text-slate-400 hover:text-slate-600">по-късно</button>
      </div>
    </div>
  )
}
