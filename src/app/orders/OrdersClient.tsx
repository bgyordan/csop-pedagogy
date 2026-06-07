'use client'

import { useState } from 'react'
import NewOrderForm from './NewOrderForm'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Plus, Search, ChevronLeft, ChevronRight, ClipboardList, FileText } from 'lucide-react'
import ViewOrderModal from './ViewOrderModal'

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
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <p className="text-sm text-slate-500">
          Общо <span className="font-semibold text-slate-800">{totalCount}</span> заповеди
          <span className="ml-2 text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded-md font-semibold">
            Уч. год. {schoolYear}/{schoolYear + 1}
          </span>
        </p>
        {canEdit && (
          <button onClick={() => setShowForm(true)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white shadow-md"
            style={{ backgroundColor: '#0f2240' }}>
            <Plus size={16} /> Нова заповед
          </button>
        )}
      </div>

      {/* Търсене */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-4">
        <form onSubmit={handleSearch} className="flex items-center gap-2">
          <div className="relative">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input placeholder="Търсене по №, заглавие..." value={search}
              onChange={e => setSearch(e.target.value)} className="input pl-9 w-72" />
          </div>
          <button type="submit" className="px-4 py-2 bg-slate-100 hover:bg-slate-200 rounded-xl text-xs font-bold text-slate-700">Търси</button>
        </form>
      </div>

      {/* Таблица */}
      <div className="bg-white rounded-2xl border border-slate-200/80 overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50/80 border-b border-slate-100">
              <tr>
                <th className="text-left px-5 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-widest">№</th>
                <th className="text-left px-4 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Дата</th>
                <th className="text-left px-4 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Заглавие</th>
                <th className="text-left px-4 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Файл</th>
              </tr>
            </thead>
            <tbody>
              {orders.length === 0 ? (
                <tr><td colSpan={4} className="px-5 py-16 text-center">
                  <ClipboardList size={32} className="mx-auto mb-3 text-slate-300" />
                  <p className="text-slate-400 text-sm">Няма регистрирани заповеди</p>
                </td></tr>
              ) : orders.map((item, idx) => (
                <tr key={item.id}
                  onClick={() => setViewItem(item)}
                  className={`cursor-pointer border-b border-slate-50 transition-colors ${idx % 2 === 0 ? 'bg-white hover:bg-blue-50/20' : 'bg-slate-50/40 hover:bg-blue-50/20'}`}>
                  <td className="px-5 py-2.5">
                    <span className="font-mono font-bold text-orange-700 text-xs">{item.number}</span>
                  </td>
                  <td className="px-4 py-2.5 text-xs text-slate-500 font-mono whitespace-nowrap">
                    {item.date ? new Date(item.date).toLocaleDateString('bg-BG') : '—'}
                  </td>
                  <td className="px-4 py-2.5">
                    <div className="text-xs font-semibold text-slate-800">{item.title}</div>
                  </td>
                  <td className="px-4 py-2.5" onClick={e => e.stopPropagation()}>
                    {item.file_url ? (
                      <button type="button"
                        onClick={async () => {
                          const win = window.open('', '_blank')
                          const { data } = await supabase.storage.from('documents').createSignedUrl(item.file_url, 120)
                          if (data?.signedUrl && win) win.location.href = data.signedUrl
                          else if (win) win.close()
                        }}
                        className="inline-flex items-center gap-1 text-[10px] font-bold text-[#0f2240] hover:underline">
                        <FileText size={12} />PDF
                      </button>
                    ) : <span className="text-slate-300 text-[10px]">—</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between pt-2">
          <p className="text-xs text-slate-400">Страница <span className="font-semibold text-slate-700">{page}</span> от <span className="font-semibold text-slate-700">{totalPages}</span></p>
          <div className="flex gap-2">
            <button disabled={page <= 1} onClick={() => handlePageChange(page - 1)}
              className="flex items-center gap-1 px-3 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-50 disabled:opacity-40">
              <ChevronLeft size={14} /> Назад
            </button>
            <button disabled={page >= totalPages} onClick={() => handlePageChange(page + 1)}
              className="flex items-center gap-1 px-3 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-50 disabled:opacity-40">
              Напред <ChevronRight size={14} />
            </button>
          </div>
        </div>
      )}

      {viewItem && <ViewOrderModal item={viewItem} onClose={() => setViewItem(null)} />}

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
