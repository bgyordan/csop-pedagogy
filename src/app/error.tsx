'use client'
import { useEffect } from 'react'
import Link from 'next/link'
import { AlertTriangle, RotateCcw } from 'lucide-react'

// При неочаквана грешка — разбираемо съобщение на български и „Опитай пак“,
// вместо бял екран. Подробностите остават в конзолата за проверка.
export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => { console.error(error) }, [error])
  return (
    <div className="min-h-[70vh] flex items-center justify-center px-4">
      <div className="max-w-md w-full card text-center">
        <div className="mx-auto mb-4 w-14 h-14 rounded-2xl bg-amber-50 ring-1 ring-amber-100 flex items-center justify-center text-amber-600">
          <AlertTriangle size={26} />
        </div>
        <h1 className="text-lg font-semibold text-navy">Нещо се обърка</h1>
        <p className="mt-2 text-sm text-slate-600">
          Страницата не успя да се зареди. Опитай пак — обикновено помага. Ако се повтаря, кажи на администратора
          {error.digest ? <> и съобщи код <span className="font-mono text-slate-800">{error.digest}</span></> : null}.
        </p>
        <div className="mt-5 flex justify-center gap-2">
          <button onClick={reset} className="btn-primary inline-flex items-center gap-1.5"><RotateCcw size={14} /> Опитай пак</button>
          <Link href="/dashboard" className="btn-secondary">Към началото</Link>
        </div>
      </div>
    </div>
  )
}
