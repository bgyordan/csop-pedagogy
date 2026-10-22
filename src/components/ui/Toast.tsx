'use client'

// Съобщения (toast) и потвърждения в стила на системата — вместо прозорците на браузъра (alert / confirm).
// В компонент: useToast().toast(...). Извън React или в стар код: notify(...) и await confirmDialog(...).
import { createContext, useContext, useState, useCallback, useEffect, useRef, ReactNode } from 'react'
import { CheckCircle2, AlertCircle, X, AlertTriangle } from 'lucide-react'
import { cn } from '@/lib/utils'

type ToastType = 'success' | 'error'

interface Toast {
  id: string
  message: string
  type: ToastType
}

interface ToastContextType {
  toast: (message: string, type?: ToastType) => void
}

type AskOptions = { title?: string; confirmLabel?: string; danger?: boolean }
type AskState = { message: string; opts: AskOptions; resolve: (ok: boolean) => void }

const ToastContext = createContext<ToastContextType>({ toast: () => {} })

let pushToast: ((message: string, type: ToastType) => void) | null = null
let pushAsk: ((s: AskState) => void) | null = null

/** Съобщение отдолу вдясно. По подразбиране — грешка/предупреждение (както досегашните alert). */
export function notify(message: string, type: ToastType = 'error') {
  if (pushToast) pushToast(String(message), type)
  else if (typeof window !== 'undefined') window.alert(message)
}

/** Потвърждение в прозорец на системата. Връща true при „Потвърди“. */
export function confirmDialog(message: string, opts: AskOptions = {}): Promise<boolean> {
  if (!pushAsk) return Promise.resolve(typeof window !== 'undefined' ? window.confirm(message) : false)
  return new Promise(resolve => pushAsk!({ message: String(message), opts, resolve }))
}

const looksDangerous = (m: string) => /изтри|изтрий|изтрие|изтриване|премахн|махне|изчист|необратим/i.test(m)

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])
  const [asking, setAsking] = useState<AskState | null>(null)
  const okRef = useRef<HTMLButtonElement>(null)

  const toast = useCallback((message: string, type: ToastType = 'success') => {
    const id = Math.random().toString(36).slice(2)
    setToasts(prev => [...prev, { id, message, type }])
    // дългите съобщения стоят по-дълго
    const ms = Math.min(10000, Math.max(3500, message.length * 60))
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id))
    }, ms)
  }, [])

  useEffect(() => {
    pushToast = toast
    pushAsk = s => setAsking(prev => { prev?.resolve(false); return s })
    return () => { pushToast = null; pushAsk = null }
  }, [toast])

  const answer = useCallback((ok: boolean) => {
    setAsking(prev => { prev?.resolve(ok); return null })
  }, [])

  useEffect(() => {
    if (!asking) return
    okRef.current?.focus()
    // захващаме Esc преди другите прозорци, за да не се затвори и формата отдолу
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.preventDefault(); e.stopImmediatePropagation(); answer(false) } }
    document.addEventListener('keydown', onKey, true)
    return () => document.removeEventListener('keydown', onKey, true)
  }, [asking, answer])

  const danger = asking ? (asking.opts.danger ?? looksDangerous(asking.message)) : false

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      <div className="fixed bottom-5 right-5 left-5 sm:left-auto z-[60] flex flex-col items-end gap-2 pointer-events-none">
        {toasts.map(t => (
          <div
            key={t.id}
            role={t.type === 'error' ? 'alert' : 'status'}
            className={cn(
              'pointer-events-auto flex items-start gap-3 px-4 py-3 rounded-xl shadow-lg text-sm font-medium max-w-md whitespace-pre-line animate-in slide-in-from-right-2',
              t.type === 'success' ? 'bg-green-600 text-white' : 'bg-red-600 text-white'
            )}
          >
            {t.type === 'success'
              ? <CheckCircle2 size={16} className="shrink-0 mt-0.5" />
              : <AlertCircle size={16} className="shrink-0 mt-0.5" />}
            <span className="flex-1">{t.message}</span>
            <button type="button" aria-label="Затвори" onClick={() => setToasts(prev => prev.filter(x => x.id !== t.id))} className="ml-2 opacity-70 hover:opacity-100">
              <X size={14} />
            </button>
          </div>
        ))}
      </div>
      {asking && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4" role="dialog" aria-modal="true">
          <div className="absolute inset-0 bg-slate-900/40" onClick={() => answer(false)} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md p-5">
            <div className="flex items-start gap-3">
              <span className={cn('shrink-0 w-9 h-9 rounded-full flex items-center justify-center', danger ? 'bg-rose-50 text-rose-600' : 'bg-indigo-50 text-indigo-600')}>
                <AlertTriangle size={18} />
              </span>
              <div className="flex-1 min-w-0">
                <h2 className="text-[15px] font-semibold text-slate-800">{asking.opts.title || (danger ? 'Сигурни ли сте?' : 'Потвърждение')}</h2>
                <p className="mt-1.5 text-sm text-slate-600 whitespace-pre-line break-words">{asking.message}</p>
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-5">
              <button type="button" onClick={() => answer(false)} className="btn-secondary">Отказ</button>
              <button ref={okRef} type="button" onClick={() => answer(true)} className={danger ? 'btn-danger' : 'btn-primary'}>
                {asking.opts.confirmLabel || (danger ? 'Да, продължи' : 'Потвърди')}
              </button>
            </div>
          </div>
        </div>
      )}
    </ToastContext.Provider>
  )
}

export function useToast() {
  return useContext(ToastContext)
}
