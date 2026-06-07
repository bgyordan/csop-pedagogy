'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Plus, Search, ChevronLeft, ChevronRight, Paperclip, ArrowDownLeft, ArrowUpRight, ArrowRightLeft } from 'lucide-react'
import NewCorrespondenceForm from './NewCorrespondenceForm'
import ViewCorrespondenceModal from './ViewCorrespondenceModal'

const DIRECTION_CONFIG = {
  incoming: { label: 'Вх.', badge: 'bg-blue-100 text-blue-800 border-blue-200', icon: <ArrowDownLeft size={10} />, row: 'border-l-2 border-l-blue-300' },
  outgoing: { label: 'Изх.', badge: 'bg-emerald-100 text-emerald-800 border-emerald-200', icon: <ArrowUpRight size={10} />, row: 'border-l-2 border-l-emerald-300' },
  internal: { label: 'Вътр.', badge: 'bg-purple-100 text-purple-800 border-purple-200', icon: <ArrowRightLeft size={10} />, row: 'border-l-2 border-l-purple-300' },
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
  const [viewItem, setViewItem] = useState<any | null>(null)

  const totalPages = Math.ceil(totalCount / pageSize)

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
    <div className="space-y-5">

      {/* Филтри и бутон */}
      <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-sm flex flex-col md:flex-row gap-4 items-center justify-between">
        <div className="flex flex-wrap gap-2">
          {[
            { key: 'all', label: 'Всички' },
            { key: 'incoming', label: 'Входящи', icon: <ArrowDownLeft size={13} /> },
            { key: 'outgoing', label: 'Изходящи', icon: <ArrowUpRight size={13} /> },
            { key: 'internal', label: 'Вътрешни', icon: <ArrowRightLeft size={13} /> },
          ].map(({ key, label, icon }) => (
            <button key={key} onClick={() => handleDirectionFilter(key)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                (directionValue || 'all') === key ? 'bg-[#0f2240] text-white shadow-sm' : 'text-slate-600 hover:bg-slate-50 border border-slate-200'
              }`}>
              {icon}{label}
            </button>
          ))}
        </div>
        <div className="flex gap-3 items-center w-full md:w-auto justify-end">
          <form onSubmit={handleSearch} className="relative">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <input type="text" placeholder="Търсене..." value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-9 pr-4 py-2 border border-slate-200 rounded-xl text-xs focus:outline-none w-48" />
          </form>
          {canEdit && (
            <button onClick={() => setShowForm(v => !v)}
              className="text-white text-xs font-bold px-4 py-2.5 rounded-xl shadow-sm flex items-center gap-1.5 whitespace-nowrap transition-all"
              style={{ backgroundColor: showForm ? '#374151' : '#0f2240' }}>
              <Plus size={15} className={showForm ? 'rotate-45 transition-transform' : 'transition-transform'} />
              {showForm ? 'Затвори' : 'Нов запис'}
            </button>
          )}
        </div>
      </div>

      {/* Форма за нов запис */}
      {showForm && (
        <NewCorrespondenceForm
          totalCount={totalCount}
          currentUserId={currentUserId}
          students={students}
          staff={staff}
          nomenclature={nomenclature}
          onClose={() => setShowForm(false)}
          onSaved={() => setShowForm(false)}
        />
      )}

      {/* Таблица */}
      <div className="bg-white border border-slate-200/80 rounded-2xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs min-w-[650px]">
            <thead className="bg-[#f0f7ff] text-[10px] uppercase font-bold text-slate-400 border-b border-slate-100">
              <tr>
                <th className="px-4 py-2.5 pl-5">Номер</th>
                <th className="px-3 py-2.5 w-[85px]">Вид</th>
                <th className="px-3 py-2.5">От / До</th>
                <th className="px-3 py-2.5">Относно</th>
                <th className="px-3 py-2.5 text-right pr-5">Файл</th>
              </tr>
            </thead>
            <tbody>
              {correspondence.length === 0 ? (
                <tr><td colSpan={6} className="p-12 text-center text-slate-400">Няма намерени документи.</td></tr>
              ) : correspondence.map((item, idx) => {
                const dir = item.direction as keyof typeof DIRECTION_CONFIG
                const cfg = DIRECTION_CONFIG[dir] || DIRECTION_CONFIG.incoming

                return (
                  <tr key={item.id}
                    onClick={() => setViewItem(item)}
                    className={`cursor-pointer transition-colors ${cfg.row} ${idx % 2 === 0 ? 'bg-white hover:bg-slate-50' : 'bg-slate-100/60 hover:bg-slate-100'}`}>
                    <td className="px-4 py-2 pl-5">
                      <span className="font-mono font-bold text-[#0f2240] text-[11px] whitespace-nowrap">{item.number}</span>
                    </td>
                    <td className="px-3 py-2">
                      <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-md border ${cfg.badge}`}>
                        {cfg.icon}{cfg.label}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-[11px] text-slate-600 max-w-[130px] truncate">
                      {dir === 'incoming' && item.from_whom && <span><span className="text-blue-600 font-bold">От:</span> {item.from_whom}</span>}
                      {dir === 'outgoing' && item.to_whom && <span><span className="text-emerald-600 font-bold">До:</span> {item.to_whom}</span>}
                      {dir === 'internal' && <span className="text-purple-500 font-bold">Вътр.</span>}
                    </td>
                    <td className="px-3 py-2 max-w-[220px]">
                      <div className="font-semibold text-slate-800 text-[11px] truncate">{item.subject}</div>
                    </td>

                    <td className="px-3 py-2 text-right pr-5" onClick={e => e.stopPropagation()}>
                      {item.file_url ? (
                        <button type="button"
                          onClick={async () => {
                            const win = window.open('', '_blank')
                            const { data } = await supabase.storage.from('documents').createSignedUrl(item.file_url, 120)
                            if (data?.signedUrl && win) win.location.href = data.signedUrl
                            else if (win) win.close()
                          }}
                          className="inline-flex items-center gap-1 text-[10px] font-bold text-[#0f2240] bg-slate-100 px-2 py-0.5 rounded hover:bg-slate-200">
                          <Paperclip size={10} />PDF
                        </button>
                      ) : <span className="text-slate-300 text-[10px]">—</span>}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        {totalPages > 1 && (
          <div className="flex items-center justify-between p-3 bg-slate-50 border-t border-slate-100 text-xs font-semibold text-slate-500">
            <span>{((page-1)*pageSize)+1}–{Math.min(page*pageSize, totalCount)} от {totalCount}</span>
            <div className="flex gap-2">
              <button disabled={page <= 1} onClick={() => handlePageChange(page-1)}
                className="p-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-100 disabled:opacity-40">
                <ChevronLeft size={14} />
              </button>
              <button disabled={page >= totalPages} onClick={() => handlePageChange(page+1)}
                className="p-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-100 disabled:opacity-40">
                <ChevronRight size={14} />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Модал за преглед */}
      {viewItem && (
        <ViewCorrespondenceModal
          item={viewItem}
          students={students}
          staff={staff}
          onClose={() => setViewItem(null)}
        />
      )}
    </div>
  )
}
