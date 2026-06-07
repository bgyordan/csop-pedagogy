'use client'

import { useState } from 'react'
import NewOrderForm from './NewOrderForm'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Plus, Search, ChevronLeft, ChevronRight, ClipboardList, FileText, Edit2 } from 'lucide-react'
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
    <div className="space-y-6">
      {/* Горен панел */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white/40 p-1 rounded-2xl">
        <div className="space-y-1">
          <p className="text-sm text-slate-500 flex items-center gap-2">
            Общо <span className="font-semibold text-slate-800">{totalCount}</span> заповеди
            <span className="inline-flex items-center bg-slate-100 text-slate-700 text-xs px-2.5 py-1 rounded-full font-medium border border-slate-200/60">
              Уч. год. {schoolYear}/{schoolYear + 1}
            </span>
          </p>
        </div>
        {canEdit && (
          <button 
            onClick={() => setShowForm(true)}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-white shadow-sm transition-all duration-200 hover:bg-[#1a355d] active:scale-[0.98] shadow-blue-900/10"
            style={{ backgroundColor: '#0f2240' }}
          >
            <Plus size={16} className="stroke-[2.5]" /> Нова заповед
          </button>
        )}
      </div>

      {/* Търсене */}
      <div className="bg-white rounded-2xl border border-slate-200/60 shadow-sm p-4 transition-all hover:shadow-md/5">
        <form onSubmit={handleSearch} className="flex items-center gap-3">
          <div className="relative flex-1 max-w-md rounded-xl transition-all focus-within:ring-4 focus-within:ring-slate-100">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input 
              placeholder="Търсене по №, заглавие..." 
              value={search}
              onChange={e => setSearch(e.target.value)} 
              className="w-full pl-10 pr-4 py-2 text-sm bg-slate-50/50 border border-slate-200 rounded-xl focus:outline-none focus:border-slate-400 focus:bg-white transition-all placeholder:text-slate-400" 
            />
          </div>
          <button 
            type="submit" 
            className="px-4 py-2 bg-slate-800 hover:bg-slate-900 rounded-xl text-xs font-semibold text-white transition-colors shadow-sm"
          >
            Търси
          </button>
        </form>
      </div>

      {/* Таблица */}
      <div className="bg-white rounded-2xl border border-slate-200/60 overflow-hidden shadow-sm transition-all hover:shadow-md/5">
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead className="bg-slate-50/70 border-b border-slate-100">
              <tr>
                <th className="text-left px-6 py-3.5 text-[10px] font-bold text-slate-500 uppercase tracking-wider w-24">№</th>
                <th className="text-left px-4 py-3.5 text-[10px] font-bold text-slate-500 uppercase tracking-wider w-32">Дата</th>
                <th className="text-left px-4 py-3.5 text-[10px] font-bold text-slate-500 uppercase tracking-wider">Заглавие</th>
                <th className="text-right px-6 py-3.5 text-[10px] font-bold text-slate-500 uppercase tracking-wider w-28">Действия</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100/60">
              {orders.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-6 py-20 text-center">
                    <ClipboardList size={36} className="mx-auto mb-3 text-slate-300 stroke-[1.5]" />
                    <p className="text-slate-400 text-sm font-medium">Няма регистрирани заповеди</p>
                  </td>
                </tr>
              ) : orders.map((item, idx) => (
                <tr 
                  key={item.id}
                  onClick={() => setViewItem(item)}
                  className={`group cursor-pointer transition-all duration-150 hover:bg-slate-50/80 hover:shadow-[inset_3px_0_0_0_#0f2240] ${idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/20'}`}
                >
                  <td className="px-6 py-3.5">
                    <span className="inline-flex font-mono font-bold text-orange-600 text-xs bg-orange-50/60 px-2 py-0.5 rounded-md border border-orange-100/50">
                      {item.number}
                    </span>
                  </td>
                  <td className="px-4 py-3.5 text-xs text-slate-500 font-mono whitespace-nowrap">
                    {item.date ? new Date(item.date).toLocaleDateString('bg-BG') : '—'}
                  </td>
                  <td className="px-4 py-3.5">
                    <div className="text-xs font-semibold text-slate-700 group-hover:text-slate-900 transition-colors line-clamp-2">
                      {item.title}
                    </div>
                  </td>
                  <td className="px-6 py-3.5 text-right" onClick={e => e.stopPropagation()}>
                    <div className="flex items-center justify-end gap-2">
                      {canEdit && (
                        <button 
                          type="button" 
                          onClick={() => setEditItem(item)}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-[#0f2240] hover:bg-slate-100 transition-colors" 
                          title="Редакция"
                        >
                          <Edit2 size={13} className="stroke-[2.5]" />
                        </button>
                      )}
                      {item.file_url ? (
                        <button 
                          type="button"
                          onClick={async () => {
                            const win = window.open('', '_blank')
                            const { data } = await supabase.storage.from('documents').createSignedUrl(item.file_url, 120)
                            if (data?.signedUrl && win) win.location.href = data.signedUrl
                            else if (win) win.close()
                          }}
                          className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-bold bg-slate-50 text-[#0f2240] hover:bg-blue-50 hover:text-blue-700 transition-colors border border-slate-200/40"
                        >
                          <FileText size={12} className="text-red-500" /> PDF
                        </button>
                      ) : (
                        <span className="text-slate-300 text-[10px] pr-2">—</span>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Пагинация */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between pt-2 px-1">
          <p className="text-xs text-slate-400 font-medium">
            Страница <span className="font-semibold text-slate-600">{page}</span> от <span className="font-semibold text-slate-600">{totalPages}</span>
          </p>
          <div className="flex gap-2">
            <button 
              disabled={page <= 1} 
              onClick={() => handlePageChange(page - 1)}
              className="flex items-center gap-1 px-3 py-1.5 rounded-xl border border-slate-200 text-xs font-semibold text-slate-600 bg-white hover:bg-slate-50 disabled:opacity-40 disabled:hover:bg-white transition-colors shadow-sm"
            >
              <ChevronLeft size={14} /> Назад
            </button>
            <button 
              disabled={page >= totalPages} 
              onClick={() => handlePageChange(page + 1)}
              className="flex items-center gap-1 px-3 py-1.5 rounded-xl border border-slate-200 text-xs font-semibold text-slate-600 bg-white hover:bg-slate-50 disabled:opacity-40 disabled:hover:bg-white transition-colors shadow-sm"
            >
              Напред <ChevronRight size={14} />
            </button>
          </div>
        </div>
      )}

      {viewItem && <ViewOrderModal item={viewItem} onClose={() => setViewItem(null)} />}
      {editItem && <EditOrderModal item={editItem} onClose={() => setEditItem(null)} />}

      {showForm && (
        <NewOrderForm
          currentUserId={currentUserId}
          students={students}
          nomenclature={nomenclature}
          onClose={() => setShowForm(false)}
          onSaved={() => setShowForm(false)}
        />
      )}
    </div>
  )
}
