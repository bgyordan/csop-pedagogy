'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Plus, Search, ChevronLeft, ChevronRight, Paperclip, ArrowDownLeft, ArrowUpRight, ArrowRightLeft, SlidersHorizontal } from 'lucide-react'
import NewCorrespondenceForm from './NewCorrespondenceForm'
import ViewCorrespondenceModal from './ViewCorrespondenceModal'
import EditCorrespondenceModal from './EditCorrespondenceModal'

const DIRECTION_CONFIG = {
  incoming: { label: 'Входящ', icon: <ArrowDownLeft size={11} /> },
  outgoing: { label: 'Изходящ', icon: <ArrowUpRight size={11} /> },
  internal: { label: 'Вътрешен', icon: <ArrowRightLeft size={11} /> },
}

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
  const [showFilters, setShowFilters] = useState(false)
  const [viewItem, setViewItem] = useState<any | null>(null)
  const [editItem, setEditItem] = useState<any | null>(null)

  const totalPages = Math.ceil(totalCount / pageSize)
  const activeDir = directionValue || 'all'

  function handleSearch(e: React.FormEvent) {
    e.preventDefault()
    const params = new URLSearchParams()
    if (search) params.set('q', search)
    if (directionValue && directionValue !== 'all') params.set('direction', directionValue)
    params.set('page', '1')
    router.push(`/correspondence?${params.toString()}`)
  }

  function handleDirectionFilter(d: string) {
    const params = new URLSearchParams()
    if (search) params.set('q', search)
    if (d !== 'all') params.set('direction', d)
    params.set('page', '1')
    router.push(`/correspondence?${params.toString()}`)
  }

  function handlePageChange(newPage: number) {
    const params = new URLSearchParams()
    if (search) params.set('q', search)
    if (directionValue && directionValue !== 'all') params.set('direction', directionValue)
    params.set('page', String(newPage))
    router.push(`/correspondence?${params.toString()}`)
  }

  return (
    <div className="space-y-4">

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
              {showForm ? 'Затвори' : 'Нов документ'}
            </button>
          )}

          <form onSubmit={handleSearch} className={`relative transition-all duration-300 ${showFilters ? 'w-28' : 'flex-1'}`}>
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
            <input type="text" placeholder="Търсене..." value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-8 pr-3 py-2 border border-slate-200 rounded-xl text-xs focus:outline-none focus:border-slate-400 w-full bg-white" />
          </form>

          <div className={`flex items-center gap-1 transition-all duration-300 overflow-hidden ${showFilters ? 'flex-1 opacity-100' : 'w-0 opacity-0 pointer-events-none'}`}>
            {[
              { key: 'all', label: 'Всички' },
              { key: 'incoming', label: 'Входящи' },
              { key: 'outgoing', label: 'Изходящи' },
              { key: 'internal', label: 'Вътрешни' },
            ].map(({ key, label }) => (
              <button key={key} onClick={() => handleDirectionFilter(key)}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs transition-all whitespace-nowrap ${
                  activeDir === key ? 'text-[#0f2240] font-medium' : 'text-slate-400 hover:text-slate-600'
                }`}>
                <span className={`w-4 h-4 rounded border-2 flex items-center justify-center flex-shrink-0 transition-all ${
                  activeDir === key ? 'bg-[#0f2240] border-[#0f2240]' : 'border-slate-300'
                }`}>
                  {activeDir === key && <span className="text-white text-[9px] font-black">✓</span>}
                </span>
                {label}
              </button>
            ))}
          </div>

          <button onClick={() => setShowFilters(v => !v)}
            className={`flex items-center p-2 rounded-xl border transition-all flex-shrink-0 ${
              showFilters || activeDir !== 'all'
                ? 'bg-[#0f2240] text-white border-[#0f2240]'
                : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50'
            }`}>
            <SlidersHorizontal size={15} />
          </button>
        </div>
      </div>

      {showForm && (
        <NewCorrespondenceForm
          totalCount={totalCount}
          currentUserId={currentUserId}
          students={students}
          staff={staff}
          nomenclature={nomenclature}
          onClose={() => setShowForm(false)}
          onSaved={() => { setShowForm(false); router.refresh() }}
        />
      )}

      {/* Заглавен ред */}
      <div className="hidden md:grid grid-cols-[180px_90px_90px_1fr_1fr_100px_60px] gap-3 px-4 py-2">
        {['№', 'Вид', 'Дата', 'От кого / До кого', 'Относно', 'Забележка', 'Файл'].map(h => (
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
          const dir = item.direction as keyof typeof DIRECTION_CONFIG
          const cfg = DIRECTION_CONFIG[dir] || DIRECTION_CONFIG.incoming
          const personLabel = dir === 'incoming' ? item.from_whom : dir === 'outgoing' ? item.to_whom : item.from_whom ? `${item.from_whom} → ${item.to_whom || ''}` : item.to_whom

          return (
            <div key={item.id}
              onClick={() => setViewItem(item)}
              className="bg-white border border-slate-200 rounded-2xl px-2 py-1.5 cursor-pointer hover:border-slate-400 hover:shadow-[0_2px_8px_rgba(15,34,64,0.10)] transition-all group grid grid-cols-[180px_90px_90px_1fr_1fr_100px_60px] gap-3 items-center shadow-[0_1px_4px_rgba(15,34,64,0.06)]">

              <span className="font-medium text-slate-800 text-xs whitespace-nowrap truncate">{item.number}</span>

              <span className="inline-flex items-center gap-1 text-[10px] text-slate-700 border border-slate-200 px-2 py-0.5 rounded-lg bg-slate-50 w-fit">
                {cfg.icon}{cfg.label}
              </span>

              <span className="text-xs text-slate-800 whitespace-nowrap">
                {item.date ? new Date(item.date).toLocaleDateString('bg-BG') : '—'}
              </span>

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
