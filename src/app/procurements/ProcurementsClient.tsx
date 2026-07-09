'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Plus, Search, Package, Paperclip, Pencil, FileText } from 'lucide-react'
import NewProcurementForm from './NewProcurementForm'
import ProcurementModal from './ProcurementModal'

const OBJECT_LABELS: Record<string, string> = {
  construction: 'Строителство',
  supply: 'Доставка',
  service: 'Услуга',
}

const PROCEDURE_LABELS: Record<string, string> = {
  direct: 'Директно възлагане',
  offers: 'Оферти с обява',
  negotiation: 'Пряко договаряне',
}

const STATUS_LABELS: Record<string, string> = {
  in_progress: 'В процес',
  awarded: 'Възложена',
  completed: 'Приключена',
  cancelled: 'Прекратена',
}

interface Props {
  procurements: any[]
  canEdit: boolean
  currentUserId: string
}

export default function ProcurementsClient({ procurements, canEdit, currentUserId }: Props) {
  const router = useRouter()

  const [search, setSearch] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [viewItem, setViewItem] = useState<any | null>(null)

  const filtered = procurements.filter(p =>
    !search ||
    p.subject?.toLowerCase().includes(search.toLowerCase()) ||
    p.number?.toLowerCase().includes(search.toLowerCase())
  )

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
              {showForm ? 'Затвори' : 'Нова поръчка'}
            </button>
          )}

          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
            <input type="text" placeholder="Търсене..." value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-8 pr-3 py-2 border border-slate-200 rounded-xl text-xs focus:outline-none focus:border-slate-400 w-full bg-white" />
          </div>

          <span className="text-xs text-slate-400 px-3 py-2 whitespace-nowrap">{procurements.length} поръчки</span>
        </div>
      </div>

      {/* Заглавен ред */}
      <div className="hidden md:grid grid-cols-[1fr_110px_140px_120px_100px_70px] gap-3 px-4 py-2">
        {['Предмет', 'Обект', 'Процедура', 'Стойност', 'Статус', 'Файлове'].map(h => (
          <span key={h} className="text-[10px] font-medium uppercase tracking-wider text-slate-400">{h}</span>
        ))}
      </div>

      {/* Редове */}
      <div className="space-y-2">
        {filtered.length === 0 ? (
          <div className="bg-white border border-slate-200 rounded-2xl p-16 text-center shadow-[0_1px_6px_rgba(15,34,64,0.08)]">
            <Package size={28} className="mx-auto mb-2 text-slate-300" />
            <p className="text-slate-400 text-sm italic">Няма регистрирани поръчки</p>
          </div>
        ) : filtered.map((item) => {
          const fileCount = item.files?.[0]?.count || 0
          return (
            <div key={item.id}
              onClick={() => setViewItem(item)}
              className="bg-white border border-slate-200 rounded-2xl px-4 py-3 cursor-pointer hover:border-slate-400 hover:shadow-[0_2px_8px_rgba(15,34,64,0.10)] transition-all grid grid-cols-[1fr_110px_140px_120px_100px_70px] gap-3 items-center shadow-[0_1px_4px_rgba(15,34,64,0.06)]">

              <div className="min-w-0">
                <div className="text-sm font-medium text-slate-800 truncate">{item.subject}</div>
                {item.number && <div className="text-[11px] text-slate-400 mt-0.5">{item.number}</div>}
              </div>

              <span className="text-xs text-slate-600">{OBJECT_LABELS[item.object_type] || '—'}</span>

              <span className="text-xs text-slate-600 truncate">{PROCEDURE_LABELS[item.procedure_type] || '—'}</span>

              <span className="text-xs text-slate-800 whitespace-nowrap">
                {item.estimated_value ? `${Number(item.estimated_value).toLocaleString('bg-BG')} EUR` : '—'}
              </span>

              <span className="text-xs text-slate-600">{STATUS_LABELS[item.status] || '—'}</span>

              <div className="flex items-center gap-1 text-xs text-slate-400">
                <Paperclip size={12} />{fileCount}
              </div>
            </div>
          )
        })}
      </div>

      {showForm && (
        <NewProcurementForm
          currentUserId={currentUserId}
          onClose={() => setShowForm(false)}
          onSaved={() => { setShowForm(false); router.refresh() }}
        />
      )}

      {viewItem && (
        <ProcurementModal
          item={viewItem}
          canEdit={canEdit}
          onClose={() => setViewItem(null)}
          onChanged={() => router.refresh()}
        />
      )}
    </div>
  )
}
