'use client'

import { Search, ChevronDown } from 'lucide-react'
import { useRouter } from 'next/navigation'

interface Props {
  classes: { id: string; name: string }[]
  currentSearch: string
  currentClass: string
}

export function StudentsFilter({ classes, currentSearch, currentClass }: Props) {
  const router = useRouter()

  function handleClassChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const classId = e.target.value
    const url = new URL(window.location.href)
    if (classId) {
      url.searchParams.set('class', classId)
    } else {
      url.searchParams.delete('class')
    }
    // Запазваме търсенето при смяна на паралелка, ако искаш, махни това долу
    router.push(url.pathname + url.search)
  }

  return (
    <div className="bg-white p-2 rounded-2xl border border-slate-200/70 shadow-sm flex flex-col sm:flex-row gap-2">
      <form method="get" className="flex flex-1 gap-2">
        <div className="flex-1 relative">
          <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            name="q"
            defaultValue={currentSearch}
            placeholder="Търси ученик по име..."
            className="w-full h-12 pl-12 pr-4 rounded-xl bg-slate-50 border-none text-sm font-medium text-slate-800 placeholder:text-slate-400 focus:ring-2 focus:ring-blue-500/20 outline-none transition-all"
          />
        </div>
        
        {classes.length > 0 && (
          <div className="relative sm:w-48">
            <select
              name="class"
              className="w-full h-12 pl-4 pr-10 rounded-xl bg-slate-50 border-none text-sm font-semibold text-slate-700 focus:ring-2 focus:ring-blue-500/20 outline-none appearance-none cursor-pointer transition-all hover:bg-slate-100"
              defaultValue={currentClass}
              onChange={handleClassChange}
            >
              <option value="">Всички паралелки</option>
              {classes.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
            <ChevronDown size={16} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
          </div>
        )}
      </form>
    </div>
  )
}
