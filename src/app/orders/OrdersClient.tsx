'use client'

import { useState } from 'react'
import NewOrderForm from './NewOrderForm'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Plus, Search, ChevronLeft, ChevronRight, ClipboardList, Paperclip, Pencil } from 'lucide-react'
import ViewOrderModal from './ViewOrderModal'
import EditOrderModal from './EditOrderModal'

function getSchoolYear(): number {
  const now = new Date()
  return now >= new Date(now.getFullYear(), 8, 15) ? now.getFullYear() : now.getFullYear() - 1
}

interface NomenclatureItem {
  id: string; section_code: string; item_code: string; name: string; retention_years: string
}

interface Props {
  orders: any[]
  totalCount: number
  page: number
  pageSize: number
  searchValue: string
  canEdit: boolean
  currentUserId: string
  students: { id: string; first_name: string; last_name: string }[]
  nomenclature: NomenclatureItem[]
}

export default function OrdersClient({
  orders, totalCount, page, pageSize,
  searchValue, canEdit, currentUserId, students, nomenclature
}: Props) {
  const router = useRouter()
  const supabase = createClient()
  const schoolYear = getSchoolYear()

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
    router.push(`/orders?${params.toString()}`)
  }

  function handlePageChange(newPage: number) {
    const params = new URLSearchParams()
    if (searchValue) params.set('q', searchValue)
    params.set('page', String(newPage))
    router.push(`/orders?${params.toString()}`)
  }

  return (
    <div className="space-y-4">

      {/* Лента с контроли */}
      <div className="bg-white border border-slate-300 rounded-2xl p-2 shadow-[0_1px_6px_rgba(15,34,64,0.10)] ring-1 ring-slate-100">
        <div className="flex items-center gap-2">

          {/* Нова заповед — outline + пулсира */}
          {canEdit && (
            <button onClick={() => setShowForm(v => !v)}
              className={`flex items-center gap-1.5 text-xs font-bold px-4 py-2 rounded-xl border-2 transition-all whitespace-nowrap flex-shrink-0 ${
                showForm
                  ? 'bg-slate-100 text-slate-600 border-slate-300'
                  : 'border-[#0f2240] text-[#0f2240] bg-white animate-pulse hover:bg-[#0f2240] hover:text-white hover:[animation:none]'
              }`}>
              <Plus size={14} className={`transition-transform duration-200 ${showForm ? 'rotate-45' : ''}`} />
              {showForm ? 'Затвори' : 'Нова заповед'}
            </button>
          )}

          {/* Търсене */}
          <form onSubmit={handleSearch} className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
            <input type="text" placeholder="Търсене по №, заглавие..." value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-8 pr-3 py-2 border border-slate-200 rounded-xl text-xs focus:outline-none focus:border-slate-400 w-full bg-white" />
          </form>

          {/* Учебна година badge */}
          <span className="text-xs bg-orange-50 text-orange-700 border border-orange-100 px-3 py-2 rounded-xl font-bold whitespace-nowrap flex-shrink-0">
            {schoolYear}/{schoolYear + 1}
          </span>
        </div>
      </div>

      {/* Таблица */}
      <div className="bg-white border border-slate-200/80 rounded-2xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs min-w-[500px]">
            <thead>
              <tr className="bg-slate-50/80 border-b border-slate-100">
                <th className="px-5 py-3 text-[10px] font-bold uppercase tracking-wider text-slate-400">№</th>
                <th className="px-3 py-3 text-[10px] font-bold uppercase tracking-wider text-slate-400">Дата</th>
                <th className="px-3 py-3 text-[10px] font-bold uppercase tracking-wider text-slate-400">Заглавие</th>
                <th className="px-3 py-3 text-[10px] font-bold uppercase tracking-wider text-slate-400 text-right pr-5">Файл</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {orders.length === 0 ? (
                <tr>
                  <td colSpan={4} className="p-16 text-center">
                    <ClipboardList size={28} className="mx-auto mb-2 text-slate-300" />
                    <p className="text-slate-400 text-sm italic">Няма регистрирани заповеди</p>
                  </td>
                </tr>
              ) : orders.map((item) => (
                <tr key={item.id} onClick={() => setViewItem(item)}
                  className="cursor-pointer hover:bg-slate-50/70 transition-colors group">
                  <td className="px-5 py-3">
                   <span className="font-bold text-slate-800 text-sm tracking-wide whitespace-nowrap">{item.number}</span>
                  </td>
                  <td className="px-3 py-3 text-xs text-slate-600 whitespace-nowrap">
                    {item.date ? new Date(item.date).toLocaleDateString('bg-BG') : '—'}
                  </td>
                  <td className="px-3 py-3 max-w-[300px]">
                    <span className="text-xs font-semibold text-slate-800 truncate block">{item.title}</span>
                  </td>
                  <td className="px-3 py-3 text-right pr-5" onClick={e => e.stopPropagation()}>
                    <div className="flex items-center justify-end gap-1.5">
                      {item.file_url ? (
                        <button type="button" title="Отвори файл"
                          className="p-1.5 rounded-lg text-slate-400 hover:text-orange-700 hover:bg-orange-50 transition-colors"
                          onClick={async () => {
                            const win = window.open('', '_blank')
                            const { data } = await supabase.storage.from('documents').createSignedUrl(item.file_url, 120)
                            if (data?.signedUrl && win) win.location.href = data.signedUrl
                            else if (win) win.close()
                          }}>
                          <Paperclip size={14} />
                        </button>
                      ) : (
                        <span className="text-slate-200 text-[10px] px-1.5">—</span>
                      )}
                      {canEdit && (
                        <button type="button" onClick={() => setEditItem(item)}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-[#0f2240] hover:bg-slate-100 transition-colors opacity-0 group-hover:opacity-100"
                          title="Редакция">
                          <Pencil size={13} />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {totalPages > 1 && (
          <div className="flex items-center justify-between px-5 py-3 bg-slate-50/50 border-t border-slate-100">
            <span className="text-[11px] font-semibold text-slate-400">
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
      </div>

      {viewItem && <ViewOrderModal item={viewItem} onClose={() => setViewItem(null)} />}
      {editItem && <EditOrderModal item={editItem} onClose={() => setEditItem(null)} />}

      {showForm && (
        <NewOrderForm
          currentUserId={currentUserId}
          students={students}
          nomenclature={nomenclature}
          onClose={() => setShowForm(false)}
          onSaved={() => { setShowForm(false); router.refresh() }}
        />
      )}
    </div>
  )
}
