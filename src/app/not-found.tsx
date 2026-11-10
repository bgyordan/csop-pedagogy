import Link from 'next/link'
import { Compass } from 'lucide-react'

// Страница „Няма такава страница“ — вместо английското 404 на Next.js
export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-gradient-to-br from-sky-50 via-white to-teal-50">
      <div className="max-w-md w-full text-center">
        <div className="mx-auto mb-5 w-16 h-16 rounded-2xl bg-white shadow-sm ring-1 ring-sky-100 flex items-center justify-center text-sky-600">
          <Compass size={30} />
        </div>
        <div className="text-sm font-semibold tracking-widest text-sky-600">404</div>
        <h1 className="mt-1 text-2xl font-semibold text-navy">Няма такава страница</h1>
        <p className="mt-2 text-sm text-slate-600">
          Връзката е стара или страницата е преместена. Опитай от таблото или с търсенето (Ctrl + K).
        </p>
        <Link href="/dashboard" className="btn-primary inline-flex mt-6">Към началото</Link>
      </div>
    </div>
  )
}
