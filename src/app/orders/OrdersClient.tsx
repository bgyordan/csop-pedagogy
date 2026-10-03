'use client'

import { useState, useEffect, useRef } from 'react'
import NewOrderForm from './NewOrderForm'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Plus, Search, ChevronLeft, ChevronRight, ClipboardList, X } from 'lucide-react'
import ViewOrderModal from './ViewOrderModal'
import EditOrderModal from './EditOrderModal'
import { Hl, SortHeader, FileAndActions, FilterChips, EmptyState } from '@/components/registry/RegistryParts'
import { PANEL_WIDTH_CLS } from '@/components/registry/SidePanel'

interface NomenclatureItem {
  id: string; section_code: string; item_code: string; name: string; retention_years: string
}

interface Props {
  orders: any[]
  totalCount: number
  page: number
  pageSize: number
  searchValue: string
  filterIndex: string
  openNew?: boolean
  filterValue: string
  sortValue: string
  counts: { all: number; nofile: number }
  dyearValue: string
  dyearOptions: { value: string; label: string }[]
  canEdit: boolean
  canDelete: boolean
  currentUserId: string
  students: { id: string; first_name: string; last_name: string }[]
  staff: { id: string; first_name: string; last_name: string }[]
  nomenclature: NomenclatureItem[]
}

// № · Дата · Заглавие · Забележка · Индекс · Файл/действия
const GRID = 'md:grid-cols-[minmax(130px,170px)_92px_minmax(0,1.6fr)_minmax(0,1fr)_76px_170px]'

export default function OrdersClient({
  orders, totalCount, page, pageSize,
  searchValue, filterIndex, openNew = false, filterValue, sortValue, counts, dyearValue, dyearOptions,
  canEdit, canDelete, currentUserId, students, staff, nomenclature
}: Props) {
  const router = useRouter()
  const supabase = createClient()

  async function handleDelete(id: string, e: React.MouseEvent) {
    e.stopPropagation()
    if (!confirm('Изтрий тази заповед? Действието е необратимо.')) return
    const { error } = await supabase.from('orders').delete().eq('id', id)
    if (error) { alert('Грешка при изтриване'); return }
    router.refresh()
  }

  async function openFile(path: string) {
    const win = window.open('', '_blank')
    const { data } = await supabase.storage.from('documents').createSignedUrl(path, 120)
    if (data?.signedUrl && win) win.location.href = data.signedUrl
    else if (win) win.close()
  }

  const [search, setSearch] = useState(searchValue)
  const [showForm, setShowForm] = useState(openNew)
  // Дошли от бърз бутон на таблото (?new=1) — махни го от адреса, за да не се отваря пак при презареждане
  useEffect(() => { if (openNew) router.replace(buildUrl({ page }), { scroll: false }) }, [])
  const [viewItem, setViewItem] = useState<any | null>(null)
  const [editItem, setEditItem] = useState<any | null>(null)

  // Страничен панел: предишен/следващ запис, ↑/↓ и Esc, свежи данни след редакция
  const viewIdx = viewItem ? orders.findIndex(o => o.id === viewItem.id) : -1
  const goPrev = viewIdx > 0 ? () => setViewItem(orders[viewIdx - 1]) : null
  const goNext = viewIdx >= 0 && viewIdx < orders.length - 1 ? () => setViewItem(orders[viewIdx + 1]) : null
  useEffect(() => {
    if (!viewItem) return
    const fresh = orders.find(o => o.id === viewItem.id)
    if (fresh && fresh !== viewItem) setViewItem(fresh)
  }, [orders])
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
  }, [viewItem, editItem, showForm, orders])

  const totalPages = Math.ceil(totalCount / pageSize)

  function buildUrl(opts: { q?: string; idx?: string; page?: number; dyear?: string; f?: string; sort?: string }) {
    const params = new URLSearchParams()
    const q = opts.q !== undefined ? opts.q : searchValue
    const idx = opts.idx !== undefined ? opts.idx : filterIndex
    const dy = opts.dyear !== undefined ? opts.dyear : dyearValue
    const f = opts.f !== undefined ? opts.f : filterValue
    const sort = opts.sort !== undefined ? opts.sort : sortValue
    if (q) params.set('q', q)
    if (idx) params.set('idx', idx)
    if (dy) params.set('dyear', dy)
    if (f) params.set('f', f)
    if (sort) params.set('sort', sort)
    params.set('page', String(opts.page || 1))
    return `/orders?${params.toString()}`
  }

  const firstSearch = useRef(true)
  useEffect(() => {
    if (firstSearch.current) { firstSearch.current = false; return }
    const t = setTimeout(() => { router.push(buildUrl({ q: search.trim(), page: 1 })) }, 300)
    return () => clearTimeout(t)
  }, [search])

  return (
    <div className={`space-y-4 transition-[padding] duration-200 ${viewItem ? PANEL_WIDTH_CLS : ''}`}>

      {/* Лента с контроли — всичко на едно място */}
      <div className="bg-white border border-slate-200 rounded-2xl p-2 shadow-[0_1px_6px_rgba(15,34,64,0.08)]">
        <div className="flex items-center gap-2 flex-wrap">
          {canEdit && (
            <button onClick={() => setShowForm(true)}
              className="flex items-center gap-1.5 text-xs font-medium px-4 py-2 rounded-xl border-2 border-[#0f2240] text-[#0f2240] bg-white hover:bg-[#0f2240] hover:text-white transition-all whitespace-nowrap flex-shrink-0">
              <Plus size={14} /> Нова заповед
            </button>
          )}

          <select value={dyearValue} onChange={e => router.push(buildUrl({ dyear: e.target.value, page: 1 }))}
            className="text-xs font-medium border border-slate-200 rounded-xl px-3 py-2 bg-slate-50 text-[#0f2240] focus:outline-none focus:border-slate-400 flex-shrink-0 cursor-pointer"
            title="Деловодна година">
            {dyearOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>

          <div className="relative flex-1 min-w-[180px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
            <input type="text" placeholder="Търсене по №, заглавие, забележка…" value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-8 pr-8 py-2 border border-slate-200 rounded-xl text-xs focus:outline-none focus:border-slate-400 w-full bg-white" />
            {search && (
              <button type="button" onClick={() => setSearch('')} title="Изчисти"
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded-md text-slate-400 hover:text-slate-700">
                <X size={13} />
              </button>
            )}
          </div>

          <select value={filterIndex} onChange={e => router.push(buildUrl({ idx: e.target.value, page: 1 }))}
            className="text-xs border border-slate-200 rounded-xl px-3 py-2 bg-white focus:outline-none focus:border-slate-400 max-w-[200px] flex-shrink-0 cursor-pointer"
            style={{ color: filterIndex ? '#0f2240' : '#64748b' }}>
            <option value="">Всички индекси</option>
            {nomenclature.map(n => (
              <option key={n.id} value={n.item_code}>{n.item_code} — {n.name}</option>
            ))}
          </select>

          <FilterChips value={filterValue} counts={counts} onChange={v => router.push(buildUrl({ f: v, page: 1 }))} />
        </div>
      </div>

      {/* Таблица: замразен заглавен ред + скролващи редове */}
      <div className="max-h-[calc(100vh-260px)] overflow-y-auto rounded-xl">
        <div className={`hidden md:grid ${GRID} gap-4 px-4 py-2.5 sticky top-0 z-10 bg-slate-100/95 backdrop-blur border-b border-slate-200`}>
          <SortHeader label="№" sortKey="num" sort={sortValue} onSort={s => router.push(buildUrl({ sort: s, page: 1 }))} />
          <SortHeader label="Дата" sortKey="date" sort={sortValue} onSort={s => router.push(buildUrl({ sort: s, page: 1 }))} />
          <SortHeader label="Заглавие" sort={sortValue} onSort={() => {}} />
          <SortHeader label="Забележка" sort={sortValue} onSort={() => {}} />
          <SortHeader label="Индекс" sort={sortValue} onSort={() => {}} />
          <SortHeader label="Файл" sort={sortValue} onSort={() => {}} align="right" />
        </div>

        <div className="space-y-1.5 pt-2 zebra">
          {orders.length === 0 ? (
            <EmptyState icon={<ClipboardList size={20} />} search={searchValue} filter={filterValue}
              newLabel="Нова заповед" nofileText="Всички заповеди имат прикачен файл."
              onClearSearch={() => { setSearch(''); router.push(buildUrl({ q: '', page: 1 })) }}
              onShowAll={() => router.push(buildUrl({ f: '', page: 1 }))}
              onNew={canEdit ? () => setShowForm(true) : undefined} />
          ) : orders.map((item) => (
            <div key={item.id}
              data-row-id={item.id}
              onClick={() => setViewItem(item)}
              className={`border rounded-xl px-4 py-2.5 min-h-[46px] cursor-pointer transition-all group grid grid-cols-1 ${GRID} ${viewItem?.id === item.id ? 'ring-2 ring-[#0f2240]/25 !border-[#0f2240]' : ''} gap-x-4 gap-y-1 items-center hover:shadow-[0_2px_8px_rgba(15,34,64,0.10)] ${
                item.is_reserved ? 'bg-amber-50 border-amber-200 hover:border-amber-300'
                : item.without_hours ? 'bg-violet-50 border-violet-200 hover:border-violet-300'
                : 'bg-white border-slate-200 hover:border-slate-400'}`}>

              <span className="text-[13px] font-medium text-[#0f2240] tabular-nums whitespace-nowrap truncate flex items-center gap-1.5">
                <Hl text={item.number} q={searchValue} />
                {item.is_reserved && <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 shrink-0 font-normal">резерв.</span>}
                {item.without_hours && <span title="Издадена без часове — генерирай я пак от Замествания, когато разписанието е пълно, и смени файла" className="text-[10px] px-1.5 py-0.5 rounded bg-violet-100 text-violet-700 shrink-0 font-normal">без часове</span>}
              </span>

              <span className="text-[13px] text-slate-600 tabular-nums whitespace-nowrap">
                {item.date ? new Date(item.date).toLocaleDateString('bg-BG') : '—'}
              </span>

              <span className="text-sm text-slate-900 truncate" title={item.title || ''}><Hl text={item.title} q={searchValue} /></span>

              <span className="text-xs text-slate-500 truncate" title={item.description || ''}><Hl text={item.description} q={searchValue} /></span>

              <span className="text-xs text-slate-500 truncate" title={item.nomenclature_item || ''}>{item.nomenclature_item || '—'}</span>

              <FileAndActions item={item} canEdit={canEdit} canDelete={canDelete}
                onOpenFile={() => openFile(item.file_url)}
                onEdit={() => setEditItem(item)}
                onDelete={(e) => handleDelete(item.id, e)} />
            </div>
          ))}
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
            <button disabled={page <= 1} onClick={() => router.push(buildUrl({ page: page - 1 }))}
              className="p-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-100 disabled:opacity-40 transition-colors">
              <ChevronLeft size={14} />
            </button>
            <button disabled={page >= totalPages} onClick={() => router.push(buildUrl({ page: page + 1 }))}
              className="p-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-100 disabled:opacity-40 transition-colors">
              <ChevronRight size={14} />
            </button>
          </div>
        )}
      </div>

      {viewItem && <ViewOrderModal item={viewItem} onClose={() => setViewItem(null)} onPrev={goPrev} onNext={goNext} canEdit={canEdit} onEdit={() => setEditItem(viewItem)} />}
      {/* Резервиран номер → пълната форма със сценариите (записът се обновява); иначе — редакция */}
      {editItem && (editItem.is_reserved
        ? <NewOrderForm reserved={editItem} currentUserId={currentUserId} students={students} staff={staff} nomenclature={nomenclature}
            onClose={() => setEditItem(null)} onSaved={() => { setEditItem(null); router.refresh() }} />
        : <EditOrderModal item={editItem} nomenclature={nomenclature} onClose={() => setEditItem(null)} />)}

      {showForm && (
        <NewOrderForm
          currentUserId={currentUserId}
          students={students}
          staff={staff}
          nomenclature={nomenclature}
          onClose={() => setShowForm(false)}
          onSaved={() => { setShowForm(false); router.refresh() }}
        />
      )}
    </div>
  )
}
