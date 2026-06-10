'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Plus, Search, ChevronLeft, ChevronRight, Paperclip, ArrowDownLeft, ArrowUpRight } from 'lucide-react'
import NewCorrespondenceForm from './NewCorrespondenceForm'
import ViewCorrespondenceModal from './ViewCorrespondenceModal'
import EditCorrespondenceModal from './EditCorrespondenceModal'

interface NomenclatureItem {
  id: string; section_code: string; item_code: string; name: string; retention_years: string
}

interface Props {
  correspondence: any[]
  totalCount: number
  page: number
  pageSize: number
  searchValue: string
  directionValue: string
  canEdit: boolean
  currentUserId: string
  students: { id: string; first_name: string; last_name: string }[]
  staff: { id: string; first_name: string; last_name: string }[]
  nomenclature: NomenclatureItem[]
}

export default function CorrespondenceClient({
  correspondence, totalCount, page, pageSize,
  searchValue, directionValue, canEdit, currentUserId, students, staff, nomenclature
}: Props) {
  const router = useRouter()
  const supabase = createClient()

  const [search, setSearch] = useState(searchValue || '')
  const [showForm, setShowForm] = useState(false)
  const [viewItem, setViewItem] = useState<any | null>(null)
  const [editItem, setEditItem] = useState<any | null>(null)

  const totalPages = Math.ceil(totalCount / pageSize)
  const activeDir = directionValue || 'incoming'

  function handleSearch(e: React.FormEvent) {
    e.preventDefault()
    const params = new URLSearchParams()
    if (search) params.set('q', search)
    params.set('direction', activeDir)
    params.set('page', '1')
    router.push(`/correspondence?${params.toString()}`)
  }

  function handleTabChange(d: string) {
    const params = new URLSearchParams()
    params.set('direction', d)
    params.set('page', '1')
    router.push(`/correspondence?${params.toString()}`)
  }

  function handlePageChange(newPage: number) {
    const params = new URLSearchParams()
    if (search) params.set('q', search)
    params.set('direction', activeDir)
    params.set('page', String(newPage))
    router.push(`/correspondence?${params.toString()}`)
  }

  return (
    <div className="space-y-4">

      {/* Табове */}
      <div className="flex gap-1 p-1 bg-white border border-slate-200 rounded-2xl shadow-[0_1px_6px_rgba(15,34,64,0.08)] w-fit">
        <button onClick={() => handleTabChange('incoming')}
          className={`flex items-center gap-2 px-5 py-2 rounded-xl text-sm font-medium transition-all ${
            activeDir === 'incoming' ? 'bg-[#0f2240] text-white shadow-sm' : 'text-slate-500 hover:text-slate-800'
          }`}>
          <ArrowDownLeft size={14} /> Входящи
        </button>
        <button onClick={() => handleTabChange('outgoing')}
          className={`flex items-center gap-2 px-5 py-2 rounded-xl text-sm font-medium transition-all ${
            activeDir === 'outgoing' ? 'bg-[#0f2240] text-white shadow-sm' : 'text-slate-500 hover:text-slate-800'
          }`}>
          <ArrowUpRight size={14} /> Изходящи
        </button>
      </div>

      {/* Лента с контроли */}
      <div className="bg-white border border-slate-200 rounded-2xl p-2 shadow-[0_1px_6px_rgba(15,34,64,0.08)]">
        <div className="flex items-center gap-2">
          {canEdit && (
            <button onClick={() => setShowForm(v => !v)}
              className={`flex items-center gap-1.5 text-xs font-medium px-4 py-2 rounded-xl border-2 transition-all whitespace-nowrap flex-shrink-0 ${
                showForm
                  ? 'bg-slate-100 text-slate-600 border-slate-300'
                  : 'border-[#0f2240] text-[#0f2240] bg-white animate-pulse hover:bg-[#0f2240] hover:text-white hover:[animation:none]'
              }`}>
              <Plus size={14} className={`transition-transform duration-200 ${showForm ? 'rotate-45' : ''}`} />
              {showForm ? 'Затвори' : activeDir === 'incoming' ? 'Нов входящ' : 'Нов изходящ'}
            </button>
          )}

          <form onSubmit={handleSearch} className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
            <input type="text" placeholder="Търсене..." value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-8 pr-3 py-2 border border-slate-200 rounded-xl text-xs focus:outline-none focus:border-slate-400 w-full bg-white" />
          </form>

          <span className="text-xs text-slate-400 px-3 py-2 whitespace-nowrap">{totalCount} записа</span>
        </div>
      </div>

      {showForm && (
        <NewCorrespondenceForm
          totalCount={totalCount}
          currentUserId={currentUserId}
          students={students}
          staff={staff}
          nomenclature={nomenclature}
          direction={activeDir as 'incoming' | 'outgoing'}
          onClose={() => setShowForm(false)}
          onSaved={() => { setShowForm(false); router.refresh() }}
        />
      )}

      {/* Заглавен ред */}
      <div className="hidden md:grid grid-cols-[160px_90px_80px_1fr_1fr_100px_60px] gap-3 px-4 py-2">
        {['№', 'Дата', 'Арх. индекс', activeDir === 'incoming' ? 'От кого' : 'До кого', 'Относно', 'Забележка', 'Файл'].map(h => (
          <span key={h} className="text-[10px] font-medium uppercase tracking-wider text-slate-400">{h}</span>
        ))}
      </div>

      {/* Редове */}
      <div className="space-y-2">
        {correspondence.length === 0 ? (
          <div className="bg-white border border-slate-200 rounded-2xl p-16 text-center text-slate-400 italic text-sm shadow-[0_1px_6px_rgba(15,34,64,0.08)]">
            Няма намерени документи.
          </div>
        ) : correspondence.map((item) => {
          const personLabel = activeDir === 'incoming' ? item.from_whom : item.to_whom

          return (
            <div key={item.id}
              onClick={() => setViewItem(item)}
              className="bg-white border border-slate-200 rounded-2xl px-3 py-1.5 cursor-pointer hover:border-slate-400 hover:shadow-[0_2px_8px_rgba(15,34,64,0.10)] transition-all group grid grid-cols-[160px_90px_80px_1fr_1fr_100px_60px] gap-3 items-center shadow-[0_1px_4px_rgba(15,34,64,0.06)]">

              <span className="font-medium text-slate-800 text-xs whitespace-nowrap truncate">{item.number}</span>

              <span className="text-xs text-slate-800 whitespace-nowrap">
                {item.date ? new Date(item.date).toLocaleDateString('bg-BG') : '—'}
              </span>

              <span className="text-xs text-slate-500 truncate">{item.nomenclature_item || '—'}</span>

              <span className="text-xs text-slate-800 truncate">{personLabel || '—'}</span>

              <span className="text-xs text-slate-800 truncate">{item.subject || '—'}</span>

              <span className="text-xs text-slate-800 truncate">{item.description || '—'}</span>

              <div className="flex items-center justify-end gap-1" onClick={e => e.stopPropagation()}>
                {item.file_url ? (
                  <button type="button" title="Отвори файл"
                    className="p-1.5 rounded-lg text-slate-400 hover:text-[#0f2240] hover:bg-slate-100 transition-colors"
                    onClick={async () => {
                      const win = window.open('', '_blank')
                      const { data } = await supabase.storage.from('documents').createSignedUrl(item.file_url, 120)
                      if (data?.signedUrl && win) win.location.href = data.signedUrl
                      else if (win) win.close()
                    }}>
                    <Paperclip size={14} />
                  </button>
                ) : (
                  <span className="text-slate-200 text-[10px]">—</span>
                )}
                {canEdit && (
                  <button type="button" onClick={() => setEditItem(item)}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-[#0f2240] hover:bg-slate-100 transition-colors opacity-0 group-hover:opacity-100"
                    title="Редакция">
                    ✏️
                  </button>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {/* Пагинация */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between px-2 py-2">
          <span className="text-[11px] text-slate-400">
            {((page-1)*pageSize)+1}–{Math.min(page*pageSize, totalCount)} от {totalCount} записа
          </span>
          <div className="flex gap-1.5">
            <button disabled={page <= 1} onClick={() => handlePageChange(page-1)}
              className="p-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-100 disabled:opacity-40 transition-colors">
              <ChevronLeft size={14} />
            </button>
            <button disabled={page >= totalPages} onClick={() => handlePageChange(page+1)}
              className="p-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-100 disabled:opacity-40 transition-colors">
              <ChevronRight size={14} />
            </button>
          </div>
        </div>
      )}

      {editItem && <EditCorrespondenceModal item={editItem} onClose={() => setEditItem(null)} />}
      {viewItem && <ViewCorrespondenceModal item={viewItem} students={students} staff={staff} onClose={() => setViewItem(null)} />}
    </div>
  )
}
