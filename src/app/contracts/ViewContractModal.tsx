'use client'

import { createClient } from '@/lib/supabase/client'
import { AlertTriangle, ExternalLink, Paperclip, Pencil } from 'lucide-react'
import { SidePanel, PanelField, FilePreview } from '@/components/registry/SidePanel'

interface Props {
  item: any
  onClose: () => void
  onPrev?: (() => void) | null
  onNext?: (() => void) | null
  canEdit?: boolean
  onEdit?: () => void
}

// Преглед на договор — страничен панел (списъкът остава видим)
export default function ViewContractModal({ item, onClose, onPrev, onNext, canEdit = false, onEdit }: Props) {
  const supabase = createClient()

  const daysLeft = item.end_date
    ? Math.ceil((new Date(item.end_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
    : null

  async function handleOpen() {
    const win = window.open('', '_blank')
    const { data } = await supabase.storage.from('documents').createSignedUrl(item.file_url, 120)
    if (data?.signedUrl && win) win.location.href = data.signedUrl
    else { if (win) win.close(); alert('Грешка при отваряне на файла') }
  }

  const fmt = (d?: string | null) => d ? new Date(d).toLocaleDateString('bg-BG') : '—'

  return (
    <SidePanel kind="Договор" number={item.number} date={item.date}
      onClose={onClose} onPrev={onPrev} onNext={onNext}
      footer={canEdit && onEdit ? (
        <button type="button" onClick={onEdit}
          className="ml-auto inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-medium border border-slate-300 text-slate-700 hover:bg-slate-50 transition-colors">
          <Pencil size={13} /> Редактирай
        </button>
      ) : undefined}>

      <PanelField label="Контрагент">{item.counterparty || '—'}</PanelField>
      <PanelField label="Предмет" strong>{item.subject || '—'}</PanelField>

      <div className="grid grid-cols-2 gap-4">
        <PanelField label="Начало"><span className="tabular-nums">{fmt(item.start_date)}</span></PanelField>
        <PanelField label="Край"><span className="tabular-nums">{fmt(item.end_date)}</span></PanelField>
      </div>

      {daysLeft !== null && daysLeft < 30 && (
        <div className={`flex items-center gap-2 text-sm px-4 py-3 rounded-xl border ${
          daysLeft < 0 ? 'bg-red-50 text-red-700 border-red-200' : 'bg-amber-50 text-amber-800 border-amber-200'
        }`}>
          <AlertTriangle size={15} />
          {daysLeft < 0 ? `Изтекъл преди ${Math.abs(daysLeft)} дни` : `Изтича след ${daysLeft} дни`}
        </div>
      )}

      {item.description && <PanelField label="Бележки">{item.description}</PanelField>}

      <div>
        <div className="text-[11px] font-medium text-slate-500 uppercase tracking-wider mb-1.5">Файл</div>
        {item.file_url ? (<>
          <button type="button" onClick={handleOpen}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-xl border border-slate-300 hover:border-[#0f2240] hover:bg-slate-50 transition-colors text-left">
            <Paperclip size={16} className="text-[#0f2240] flex-shrink-0" />
            <span className="text-sm text-slate-800 truncate flex-1">{item.file_name || 'Прикачен файл'}</span>
            <ExternalLink size={14} className="text-slate-400 flex-shrink-0" />
          </button>
          <div className="mt-2"><FilePreview path={item.file_url} name={item.file_name} /></div>
        </>) : (
          <button type="button" onClick={canEdit && onEdit ? onEdit : undefined} disabled={!canEdit || !onEdit}
            className="w-full flex items-center gap-2 px-4 py-3 rounded-xl border border-amber-300 bg-amber-50 text-amber-800 text-sm text-left enabled:hover:bg-amber-100 transition-colors">
            <Paperclip size={15} /> Няма прикачен файл{canEdit && onEdit ? ' — натисни, за да го качиш' : ''}
          </button>
        )}
      </div>
    </SidePanel>
  )
}
