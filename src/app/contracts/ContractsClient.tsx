'use client'

import { useState } from 'react'
import NewContractForm from './NewContractForm'
import ViewContractModal from './ViewContractModal'
import EditContractModal from './EditContractModal'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Plus, Search, FileSignature, ChevronLeft, ChevronRight, Pencil, Paperclip } from 'lucide-react'

function daysUntil(dateStr: string): number | null {
  if (!dateStr) return null
  return Math.ceil((new Date(dateStr).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
}

interface Props {
  contracts: any[]
  totalCount: number
  page: number
  pageSize: number
  searchValue: string
  canEdit: boolean
  currentUserId: string
  students: { id: string; first_name: string; last_name: string }[]
}

export default function ContractsClient({
  contracts, totalCount, page, pageSize,
  searchValue, canEdit, currentUserId, students
}: Props) {
  const router = useRouter()
  const supabase = createClient()

  const [search, setSearch] = useState(searchValue)
  const [showForm, setShowForm] = useState(false)
  const [viewItem, setViewItem] = useState<any | null>(null)
  const [editItem, setEditItem] = useState<any | null>(null)

  const totalPages = Math.ceil(totalCount / pageSize)

  function handleSearch(e: React.FormEvent) {
    e.preventDefault()
    const params = new URLSearchParams()
    if (search) params.set('q', search)
    params.set('page', '1')
    router.push(`/contracts?${params.toString()}`)
  }

  function handlePageChange(newPage: number) {
    const params = new URLSearchParams()
    if (searchValue) params.set('q', searchValue)
    params.set('page', String(newPage))
    router.push(`/contracts?${params.toString()}`)
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
              {showForm ? 'Затвори' : 'Нов договор'}
            </button>
          )}

          <form onSubmit={handleSearch} className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
            <input type="text" placeholder="Търсене по №, предмет, контрагент..." value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-8 pr-3 py-2 border border-slate-200 rounded-xl text-xs focus:outline-none focus:border-slate-400 w-full bg-white" />
          </form>
        </div>
      </div>

      {/* Заглавен ред */}
      <div className="hidden md:grid grid-cols-[120px_90px_1fr_1fr_110px_60px] gap-3 px-4 py-2">
        {['№', 'Дата', 'Контрагент', 'Предмет', 'Край', 'Файл'].map(h => (
          <span key={h} className="text-[10px] font-medium uppercase tracking-wider text-slate-400">{h}</span>
        ))}
      </div>

      {/* Редове */}
      <div className="space-y-2">
        {contracts.length === 0 ? (
          <div className="bg-white border border-slate-200 rounded-2xl p-16 text-center shadow-[0_1px_6px_rgba(15,34,64,0.08)]">
            <FileSignature size={28} className="mx-auto mb-2 text-slate-300" />
            <p className="text-slate-400 text-sm">Няма регистрирани договори</p>
          </div>
        ) : contracts.map((item) => {
          const days = daysUntil(item.end_date)
          const isExpired = days !== null && days < 0
          const isExpiring = days !== null && days >= 0 && days < 30

          return (
            <div key={item.id}
              onClick={() => setViewItem(item)}
              className="bg-white border border-slate-200 rounded-2xl px-4 py-3 cursor-pointer hover:border-slate-400 hover:shadow-[0_2px_8px_rgba(15,34,64,0.10)] transition-all group grid grid-cols-[120px_90px_1fr_1fr_110px_60px] gap-3 items-center shadow-[0_1px_4px_rgba(15,34,64,0.06)]">

              <span className="font-medium text-slate-800 text-xs whitespace-nowrap truncate">{item.number}</span>

              <span className="text-xs text-slate-800 whitespace-nowrap">
                {item.date ? new Date(item.date).toLocaleDateString('bg-BG') : '—'}
              </span>

              <span className="text-xs text-slate-800 truncate">{item.counterparty || '—'}</span>

              <span className="text-xs text-slate-800 truncate">{item.subject || '—'}</span>

              <div>
                {item.end_date ? (
                  <div className="flex items-center gap-1.5">
                    <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${
                      isExpired ? 'bg-red-400' : isExpiring ? 'bg-amber-400' : 'bg-emerald-400'
                    }`} />
                    <span className={`text-xs whitespace-nowrap ${
                      isExpired ? 'text-red-600' : isExpiring ? 'text-amber-600' : 'text-slate-800'
                    }`}>
                      {new Date(item.end_date).toLocaleDateString('bg-BG')}
                    </span>
                    {(isExpired || isExpiring) && (
                      <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-lg ${
                        isExpired ? 'bg-red-50 text-red-600 border border-red-100' : 'bg-amber-50 text-amber-600 border border-amber-100'
                      }`}>
                        {isExpired ? 'Изт.' : `${days}д`}
                      </span>
                    )}
                  </div>
                ) : <span className="text-slate-300 text-xs">—</span>}
              </div>

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
                    <Pencil size={13} />
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

      {viewItem && <ViewContractModal item={viewItem} onClose={() => setViewItem(null)} />}
      {editItem && <EditContractModal item={editItem} onClose={() => setEditItem(null)} />}
      {showForm && (
        <NewContractForm
          currentUserId={currentUserId}
          onClose={() => setShowForm(false)}
          onSaved={() => setShowForm(false)}
        />
      )}
    </div>
  )
}
