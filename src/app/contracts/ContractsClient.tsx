'use client'

import { useState } from 'react'
import NewContractForm from './NewContractForm'
import ViewContractModal from './ViewContractModal'
import EditContractModal from './EditContractModal'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Plus, Search, FileText, FileSignature, ChevronLeft, ChevronRight, Calendar, Building2, Hash, AlertCircle, Eye, Edit, Download } from 'lucide-react'

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
      {/* Header Section */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-gradient-to-br from-slate-900 to-slate-800 rounded-xl shadow-lg">
            <FileSignature size={20} className="text-white" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-800 tracking-tight">Договори</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              <span className="font-semibold text-slate-700">{totalCount}</span> активни договора
            </p>
          </div>
        </div>
        {canEdit && (
          <button 
            onClick={() => setShowForm(true)}
            className="group flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-white shadow-lg transition-all duration-200 hover:shadow-xl hover:scale-[1.02] active:scale-[0.98]"
            style={{ 
              background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)',
              boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
            }}>
            <Plus size={16} className="group-hover:rotate-90 transition-transform duration-200" /> 
            Нов договор
          </button>
        )}
      </div>

      {/* Search Section */}
      <div className="relative">
        <form onSubmit={handleSearch} className="relative">
          <div className="relative group">
            <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-slate-600 transition-colors z-10" />
            <input 
              placeholder="Търсене по номер, предмет, контрагент..." 
              value={search}
              onChange={e => setSearch(e.target.value)} 
              className="w-full pl-11 pr-28 py-3 bg-white border border-slate-200 rounded-xl text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none focus:border-slate-300 focus:ring-2 focus:ring-slate-100 transition-all"
            />
            <button 
              type="submit" 
              className="absolute right-1.5 top-1/2 -translate-y-1/2 px-4 py-1.5 bg-slate-50 hover:bg-slate-100 rounded-lg text-xs font-medium text-slate-600 transition-colors border border-slate-200">
              Търси
            </button>
          </div>
        </form>
      </div>

      {/* Table Section */}
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-gradient-to-r from-slate-50 to-white border-b border-slate-200">
                <th className="text-left px-5 py-3.5 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">№ Договор</th>
                <th className="text-left px-4 py-3.5 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Дата</th>
                <th className="text-left px-4 py-3.5 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Контрагент</th>
                <th className="text-left px-4 py-3.5 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Предмет</th>
                <th className="text-left px-4 py-3.5 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Срок</th>
                <th className="text-left px-4 py-3.5 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Действия</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {contracts.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-5 py-16 text-center">
                    <div className="flex flex-col items-center justify-center">
                      <div className="p-4 bg-slate-50 rounded-full mb-4">
                        <FileSignature size={40} className="text-slate-300" />
                      </div>
                      <p className="text-slate-500 font-medium mb-1">Няма регистрирани договори</p>
                      <p className="text-slate-400 text-sm">Натиснете "Нов договор" за да започнете</p>
                    </div>
                  </td>
                </tr>
              ) : contracts.map((item, idx) => {
                const days = daysUntil(item.end_date)
                const isExpiring = days !== null && days < 30 && days > 0
                const isExpired = days !== null && days < 0
                const statusColor = isExpired ? 'red' : isExpiring ? 'amber' : 'emerald'
                
                return (
                  <tr 
                    key={item.id}
                    onClick={() => setViewItem(item)}
                    className="group cursor-pointer transition-all duration-150 hover:bg-slate-50/80"
                  >
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-2">
                        <Hash size={12} className="text-slate-400" />
                        <span className="font-mono font-semibold text-sm text-slate-700">{item.number}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3.5">
                      <div className="flex items-center gap-1.5">
                        <Calendar size={12} className="text-slate-400" />
                        <span className="text-sm text-slate-600">
                          {item.date ? new Date(item.date).toLocaleDateString('bg-BG') : '—'}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3.5">
                      <div className="flex items-center gap-1.5">
                        <Building2 size={12} className="text-slate-400" />
                        <span className="text-sm font-medium text-slate-700">{item.counterparty}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3.5">
                      <p className="text-sm text-slate-600 max-w-[200px] truncate">{item.subject}</p>
                    </td>
                    <td className="px-4 py-3.5">
                      {item.end_date ? (
                        <div className="flex items-center gap-2">
                          <div className={`w-1.5 h-1.5 rounded-full ${
                            isExpired ? 'bg-red-500' : isExpiring ? 'bg-amber-500' : 'bg-emerald-500'
                          }`} />
                          <span className={`text-sm ${
                            isExpired ? 'text-red-600' : isExpiring ? 'text-amber-600' : 'text-slate-600'
                          }`}>
                            {new Date(item.end_date).toLocaleDateString('bg-BG')}
                          </span>
                          {days !== null && days < 60 && (
                            <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-medium ${
                              isExpired ? 'bg-red-50 text-red-700' : 
                              isExpiring ? 'bg-amber-50 text-amber-700' : 
                              'bg-emerald-50 text-emerald-700'
                            }`}>
                              <AlertCircle size={10} />
                              {days < 0 ? 'Изтекъл' : `${days} дни`}
                            </span>
                          )}
                        </div>
                      ) : (
                        <span className="text-sm text-slate-400">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3.5" onClick={e => e.stopPropagation()}>
                      <div className="flex items-center gap-1.5">
                        <button 
                          onClick={() => setViewItem(item)}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-all duration-150"
                          title="Преглед">
                          <Eye size={14} />
                        </button>
                        {canEdit && (
                          <button 
                            onClick={() => setEditItem(item)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-all duration-150"
                            title="Редакция">
                            <Edit size={14} />
                          </button>
                        )}
                        {item.file_url && (
                          <button
                            onClick={async () => {
                              const win = window.open('', '_blank')
                              const { data } = await supabase.storage.from('documents').createSignedUrl(item.file_url, 120)
                              if (data?.signedUrl && win) win.location.href = data.signedUrl
                              else if (win) win.close()
                            }}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-all duration-150"
                            title="Изтегли PDF">
                            <Download size={14} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between pt-2">
          <p className="text-sm text-slate-500">
            Страница <span className="font-semibold text-slate-700">{page}</span> от <span className="font-semibold text-slate-700">{totalPages}</span>
          </p>
          <div className="flex gap-2">
            <button 
              disabled={page <= 1} 
              onClick={() => handlePageChange(page - 1)}
              className="group flex items-center gap-2 px-4 py-2 rounded-xl border border-slate-200 text-sm font-medium text-slate-600 hover:bg-slate-50 hover:border-slate-300 disabled:opacity-40 disabled:cursor-not-allowed transition-all duration-150">
              <ChevronLeft size={14} className="group-hover:-translate-x-0.5 transition-transform" />
              Назад
            </button>
            <button 
              disabled={page >= totalPages} 
              onClick={() => handlePageChange(page + 1)}
              className="group flex items-center gap-2 px-4 py-2 rounded-xl border border-slate-200 text-sm font-medium text-slate-600 hover:bg-slate-50 hover:border-slate-300 disabled:opacity-40 disabled:cursor-not-allowed transition-all duration-150">
              Напред
              <ChevronRight size={14} className="group-hover:translate-x-0.5 transition-transform" />
            </button>
          </div>
        </div>
      )}

      {/* Modals */}
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
