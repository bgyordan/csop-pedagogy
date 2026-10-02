'use client'

import { useState, useMemo, useEffect } from 'react'
import NewContractForm from './NewContractForm'
import ViewContractModal from './ViewContractModal'
import EditContractModal from './EditContractModal'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Plus, Search, FileSignature, ChevronLeft, ChevronRight, X } from 'lucide-react'
import { Hl, SortHeader, FileAndActions, ChipGroup, EmptyState } from '@/components/registry/RegistryParts'
import { PANEL_WIDTH_CLS } from '@/components/registry/SidePanel'

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

// № · Дата · Контрагент · Предмет · Край · Файл/действия
const GRID = 'md:grid-cols-[minmax(110px,130px)_92px_minmax(0,1fr)_minmax(0,1.4fr)_150px_150px]'

type SortKey = 'date' | 'counterparty' | 'end_date'

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
  const [filter, setFilter] = useState<'all' | 'active' | 'expiring' | 'expired'>('all')
  const [sortKey, setSortKey] = useState<SortKey>('date')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')

  // Сортиране от заглавието: „date_desc“ → „date_asc“ → по подразбиране
  const sortValue = `${sortKey}_${sortDir}`
  function onSort(next: string) {
    if (!next) { setSortKey('date'); setSortDir('desc'); return }
    const i = next.lastIndexOf('_')
    setSortKey(next.slice(0, i) as SortKey); setSortDir(next.slice(i + 1) as 'asc' | 'desc')
  }

  const view = useMemo(() => {
    let l = [...contracts]
    l = l.filter(c => {
      const days = daysUntil(c.end_date)
      if (filter === 'all') return true
      if (filter === 'active') return days === null || days >= 0
      if (filter === 'expiring') return days !== null && days >= 0 && days < 30
      if (filter === 'expired') return days !== null && days < 0
      return true
    })
    l.sort((a, b) => {
      let av: any = a[sortKey] || '', bv: any = b[sortKey] || ''
      if (sortKey === 'counterparty') { av = String(av).toLowerCase(); bv = String(bv).toLowerCase(); return sortDir === 'asc' ? av.localeCompare(bv, 'bg') : bv.localeCompare(av, 'bg') }
      const at = av ? new Date(av).getTime() : 0, bt = bv ? new Date(bv).getTime() : 0
      return sortDir === 'asc' ? at - bt : bt - at
    })
    return l
  }, [contracts, filter, sortKey, sortDir])

  const filterCounts = useMemo(() => {
    const c = { all: contracts.length, active: 0, expiring: 0, expired: 0 }
    contracts.forEach(x => { const d = daysUntil(x.end_date); if (d === null || d >= 0) c.active++; if (d !== null && d >= 0 && d < 30) c.expiring++; if (d !== null && d < 0) c.expired++ })
    return c
  }, [contracts])

  const totalPages = Math.ceil(totalCount / pageSize)

  function pushSearch(q: string) {
    const params = new URLSearchParams()
    if (q.trim()) params.set('q', q.trim())
    params.set('page', '1')
    router.push(`/contracts?${params.toString()}`)
  }

  function handlePageChange(newPage: number) {
    const params = new URLSearchParams()
    if (searchValue) params.set('q', searchValue)
    params.set('page', String(newPage))
    router.push(`/contracts?${params.toString()}`)
  }

  async function openFile(path: string) {
    const win = window.open('', '_blank')
    const { data } = await supabase.storage.from('documents').createSignedUrl(path, 120)
    if (data?.signedUrl && win) win.location.href = data.signedUrl
    else if (win) win.close()
  }

  // Страничен панел: ↑/↓ и Esc, свежи данни след редакция
  const viewIdx = viewItem ? view.findIndex(o => o.id === viewItem.id) : -1
  const goPrev = viewIdx > 0 ? () => setViewItem(view[viewIdx - 1]) : null
  const goNext = viewIdx >= 0 && viewIdx < view.length - 1 ? () => setViewItem(view[viewIdx + 1]) : null
  useEffect(() => {
    if (!viewItem) return
    const fresh = contracts.find(o => o.id === viewItem.id)
    if (fresh && fresh !== viewItem) setViewItem(fresh)
  }, [contracts])
  useEffect(() => {
    if (!viewItem) return
    document.querySelector(`[data-row-id="${viewItem.id}"]`)?.scrollIntoView({ block: 'nearest' })
    if (editItem || showForm) return
    function onKey(e: KeyboardEvent) {
      const t = e.target as HTMLElement | null
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT')) return
      if (e.key === 'Escape') setViewItem(null)
      else if (e.key === 'ArrowDown' && goNext) { e.preventDefault(); goNext() }
      else if (e.key === 'ArrowUp' && goPrev) { e.preventDefault(); goPrev() }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [viewItem, editItem, showForm, view])

  return (
    <div className={`space-y-4 transition-[padding] duration-200 ${viewItem ? PANEL_WIDTH_CLS : ''}`}>

      {/* Лента с контроли — всичко на едно място */}
      <div className="bg-white border border-slate-200 rounded-2xl p-2 shadow-[0_1px_6px_rgba(15,34,64,0.08)]">
        <div className="flex items-center gap-2 flex-wrap">
          {canEdit && (
            <button onClick={() => setShowForm(true)}
              className="flex items-center gap-1.5 text-xs font-medium px-4 py-2 rounded-xl border-2 border-[#0f2240] text-[#0f2240] bg-white hover:bg-[#0f2240] hover:text-white transition-all whitespace-nowrap flex-shrink-0">
              <Plus size={14} /> Нов договор
            </button>
          )}

          <div className="relative flex-1 min-w-[180px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
            <input type="text" placeholder="Търсене по №, предмет, контрагент… (Enter)" value={search}
              onChange={e => setSearch(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') pushSearch(search) }}
              className="pl-8 pr-8 py-2 border border-slate-200 rounded-xl text-xs focus:outline-none focus:border-slate-400 w-full bg-white" />
            {(search || searchValue) && (
              <button type="button" onClick={() => { setSearch(''); pushSearch('') }} title="Изчисти"
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded-md text-slate-400 hover:text-slate-700">
                <X size={13} />
              </button>
            )}
          </div>

          <ChipGroup value={filter} onChange={v => setFilter(v as any)} items={[
            { v: 'all', l: 'Всички', n: filterCounts.all },
            { v: 'active', l: 'Активни', n: filterCounts.active },
            { v: 'expiring', l: 'Скоро изтичат', n: filterCounts.expiring, tone: 'warn' },
            { v: 'expired', l: 'Изтекли', n: filterCounts.expired, tone: 'danger' },
          ]} />
        </div>
      </div>

      {/* Таблица: замразен заглавен ред + скролващи редове */}
      <div className="max-h-[calc(100vh-260px)] overflow-y-auto rounded-xl">
        <div className={`hidden md:grid ${GRID} gap-4 px-4 py-2.5 sticky top-0 z-10 bg-slate-100/95 backdrop-blur border-b border-slate-200`}>
          <SortHeader label="№" sort={sortValue} onSort={onSort} />
          <SortHeader label="Дата" sortKey="date" sort={sortValue} onSort={onSort} />
          <SortHeader label="Контрагент" sortKey="counterparty" sort={sortValue} onSort={onSort} />
          <SortHeader label="Предмет" sort={sortValue} onSort={onSort} />
          <SortHeader label="Край" sortKey="end_date" sort={sortValue} onSort={onSort} />
          <SortHeader label="Файл" sort={sortValue} onSort={onSort} align="right" />
        </div>

        <div className="space-y-1.5 pt-2">
          {view.length === 0 ? (
            filter !== 'all' && !searchValue ? (
              <EmptyState icon={<FileSignature size={20} />} search="" filter="nofile"
                newLabel="Нов договор" nofileText="Няма договори в тази група."
                onClearSearch={() => {}} onShowAll={() => setFilter('all')} />
            ) : (
              <EmptyState icon={<FileSignature size={20} />} search={searchValue} filter=""
                newLabel="Нов договор" nofileText=""
                onClearSearch={() => { setSearch(''); pushSearch('') }}
                onShowAll={() => setFilter('all')}
                onNew={canEdit ? () => setShowForm(true) : undefined} />
            )
          ) : view.map((item) => {
            const days = daysUntil(item.end_date)
            const isExpired = days !== null && days < 0
            const isExpiring = days !== null && days >= 0 && days < 30
            return (
              <div key={item.id}
                data-row-id={item.id}
                onClick={() => setViewItem(item)}
                className={`border rounded-xl px-4 py-2.5 min-h-[46px] cursor-pointer transition-all group grid grid-cols-1 ${GRID} ${viewItem?.id === item.id ? 'ring-2 ring-[#0f2240]/25 !border-[#0f2240]' : ''} gap-x-4 gap-y-1 items-center bg-white border-slate-200 hover:border-slate-400 hover:shadow-[0_2px_8px_rgba(15,34,64,0.10)]`}>

                <span className="text-[13px] font-medium text-[#0f2240] tabular-nums whitespace-nowrap truncate"><Hl text={item.number} q={searchValue} /></span>

                <span className="text-[13px] text-slate-600 tabular-nums whitespace-nowrap">
                  {item.date ? new Date(item.date).toLocaleDateString('bg-BG') : '—'}
                </span>

                <span className="text-sm text-slate-800 truncate" title={item.counterparty || ''}><Hl text={item.counterparty} q={searchValue} /></span>
                <span className="text-sm text-slate-900 truncate" title={item.subject || ''}><Hl text={item.subject} q={searchValue} /></span>

                <div>
                  {item.end_date ? (
                    <div className="flex items-center gap-1.5">
                      <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${isExpired ? 'bg-red-400' : isExpiring ? 'bg-amber-400' : 'bg-emerald-400'}`} />
                      <span className={`text-[13px] tabular-nums whitespace-nowrap ${isExpired ? 'text-red-600' : isExpiring ? 'text-amber-700' : 'text-slate-700'}`}>
                        {new Date(item.end_date).toLocaleDateString('bg-BG')}
                      </span>
                      {(isExpired || isExpiring) && (
                        <span className={`text-[10px] px-1.5 py-0.5 rounded-md ${isExpired ? 'bg-red-50 text-red-600 border border-red-100' : 'bg-amber-50 text-amber-700 border border-amber-200'}`}>
                          {isExpired ? 'изтекъл' : `${days} д.`}
                        </span>
                      )}
                    </div>
                  ) : <span className="text-slate-300 text-xs">—</span>}
                </div>

                <FileAndActions item={item} canEdit={canEdit} canDelete={false}
                  onOpenFile={() => openFile(item.file_url)}
                  onEdit={() => setEditItem(item)}
                  onDelete={() => {}} />
              </div>
            )
          })}
        </div>
      </div>

      {/* Пагинация */}
      <div className="flex items-center justify-between px-2">
        <span className="text-[11px] text-slate-500 tabular-nums">
          {totalCount === 0 ? '0 записа' : `${((page-1)*pageSize)+1}–${Math.min(page*pageSize, totalCount)} от ${totalCount} записа`}
        </span>
        {totalPages > 1 && (
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] text-slate-500 mr-1 tabular-nums">стр. {page} / {totalPages}</span>
            <button disabled={page <= 1} onClick={() => handlePageChange(page-1)}
              className="p-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-100 disabled:opacity-40 transition-colors">
              <ChevronLeft size={14} />
            </button>
            <button disabled={page >= totalPages} onClick={() => handlePageChange(page+1)}
              className="p-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-100 disabled:opacity-40 transition-colors">
              <ChevronRight size={14} />
            </button>
          </div>
        )}
      </div>

      {viewItem && <ViewContractModal item={viewItem} onClose={() => setViewItem(null)} onPrev={goPrev} onNext={goNext} canEdit={canEdit} onEdit={() => setEditItem(viewItem)} />}
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
