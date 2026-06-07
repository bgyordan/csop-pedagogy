'use client'

import { useState } from 'react'
import NewContractForm from './NewContractForm'
import ViewContractModal from './ViewContractModal'
import EditContractModal from './EditContractModal'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Plus, Search, FileText, FileSignature, ChevronLeft, ChevronRight } from 'lucide-react'

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
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <p className="text-sm text-slate-500">Общо <span className="font-semibold text-slate-800">{totalCount}</span> договора</p>
        {canEdit && (
          <button onClick={() => setShowForm(true)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white shadow-md"
            style={{ backgroundColor: '#0f2240' }}>
            <Plus size={16} /> Нов договор
          </button>
        )}
      </div>

      {/* Търсене */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-4">
        <form onSubmit={handleSearch} className="flex items-center gap-2">
          <div className="relative">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input placeholder="Търсене по №, предмет, контрагент..." value={search}
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
                <th className="text-left px-4 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Контрагент</th>
                <th className="text-left px-4 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Предмет</th>
                <th className="text-left px-4 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Период</th>
                <th className="text-left px-4 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Файл</th>
              </tr>
            </thead>
            <tbody>
              {contracts.length === 0 ? (
                <tr><td colSpan={6} className="px-5 py-16 text-center">
                  <FileSignature size={32} className="mx-auto mb-3 text-slate-300" />
                  <p className="text-slate-400 text-sm">Няма регистрирани договори</p>
                </td></tr>
              ) : contracts.map((item, idx) => {
                const days = daysUntil(item.end_date)
                const isExpiring = days !== null && days < 30
                return (
                  <tr key={item.id}
                    onClick={() => setViewItem(item)}
                    className={`cursor-pointer border-b border-slate-50 transition-colors ${idx % 2 === 0 ? 'bg-white hover:bg-blue-50/20' : 'bg-slate-50/40 hover:bg-blue-50/20'} ${isExpiring ? 'border-l-2 border-l-amber-400' : ''}`}>
                    <td className="px-5 py-2.5">
                      <span className="font-mono font-bold text-purple-700 text-xs">{item.number}</span>
                    </td>
                    <td className="px-4 py-2.5 text-xs text-slate-500 font-mono whitespace-nowrap">
                      {item.date ? new Date(item.date).toLocaleDateString('bg-BG') : '—'}
                    </td>
                    <td className="px-4 py-2.5 text-xs font-semibold text-slate-800">{item.counterparty}</td>
                    <td className="px-4 py-2.5">
                      <div className="text-xs font-semibold text-slate-800 max-w-[180px] truncate">{item.subject}</div>
                    </td>
                    <td className="px-4 py-2.5 text-xs text-slate-500 whitespace-nowrap">
                      <div className="flex items-center gap-1.5">
                        {item.end_date ? new Date(item.end_date).toLocaleDateString('bg-BG') : '—'}
                        {isExpiring && days !== null && (
                          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${days < 0 ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'}`}>
                            {days < 0 ? 'Изтекъл' : `${days}д`}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-2.5" onClick={e => e.stopPropagation()}>
                      <div className="flex items-center gap-2">
                      {canEdit && (
                        <button type="button" onClick={() => setEditItem(item)}
                          className="p-1 rounded-lg text-slate-400 hover:text-[#0f2240] hover:bg-slate-100" title="Редакция">
                          ✏️
                        </button>
                      )}
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
                      </div>
                    </td>
                  </tr>
                )
              })}
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
