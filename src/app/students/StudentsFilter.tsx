'use client'

import { Search } from 'lucide-react'
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
    url.searchParams.delete('q')
    router.push(url.pathname + url.search)
  }

  return (
    <div className="card mb-4 md:mb-6">
      <form method="get" className="flex flex-col sm:flex-row gap-3">
        <div className="flex-1 relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            name="q"
            defaultValue={currentSearch}
            placeholder="Търси по три имена..."
            className="input pl-9 w-full"
          />
        </div>
        {classes.length > 1 && (
          <select
            name="class"
            className="input sm:w-48"
            defaultValue={currentClass}
            onChange={handleClassChange}
          >
            <option value="">Всички паралелки</option>
            {classes.map(c => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        )}
      </form>
    </div>
  )
}
