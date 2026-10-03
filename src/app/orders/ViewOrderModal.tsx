'use client'

import { createClient } from '@/lib/supabase/client'
import { ExternalLink, Paperclip, Pencil } from 'lucide-react'
import { SidePanel, PanelField, FilePreview } from '@/components/registry/SidePanel'

interface Props {
  item: any
  onClose: () => void
  onPrev?: (() => void) | null
  onNext?: (() => void) | null
  canEdit?: boolean
  onEdit?: () => void
}

// Преглед на заповед — страничен панел (списъкът остава видим)
export default function ViewOrderModal({ item, onClose, onPrev, onNext, canEdit = false, onEdit }: Props) {
  const supabase = createClient()

  async function handleOpen() {
    const win = window.open('', '_blank')
    const { data } = await supabase.storage.from('documents').createSignedUrl(item.file_url, 120)
    if (data?.signedUrl && win) win.location.href = data.signedUrl
    else { if (win) win.close(); alert('Грешка при отваряне на файла') }
  }

  const badge = item.is_reserved
    ? <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-100 text-amber-800">резерв.</span>
    : item.without_hours
      ? <span className="text-[10px] px-1.5 py-0.5 rounded bg-violet-100 text-violet-700">без часове</span>
      : null

  return (
    <SidePanel kind="Заповед" number={item.number} date={item.date} badge={badge}
      onClose={onClose} onPrev={onPrev} onNext={onNext}
      footer={canEdit && onEdit ? (
        <button type="button" onClick={onEdit}
          className="ml-auto inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-medium border border-slate-300 text-slate-700 hover:bg-slate-50 transition-colors">
          <Pencil size={13} /> {item.is_reserved ? 'Попълни резервирания номер' : 'Редактирай'}
        </button>
      ) : undefined}>

      <PanelField label="Заглавие" strong>{item.title || '—'}</PanelField>

      {item.description && <PanelField label="Забележка">{item.description}</PanelField>}

      <PanelField label="Архивен индекс">{item.nomenclature_item || '—'}</PanelField>

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
        </>) : item.is_reserved ? (
          <div className="text-sm text-slate-400">—</div>
        ) : (
          <button type="button" onClick={canEdit && onEdit ? onEdit : undefined} disabled={!canEdit || !onEdit}
            className="w-full flex items-center gap-2 px-4 py-3 rounded-xl border border-amber-300 bg-amber-50 text-amber-800 text-sm text-left enabled:hover:bg-amber-100 transition-colors">
            <Paperclip size={15} /> Няма прикачен файл{canEdit && onEdit ? ' — натисни, за да го качиш' : ''}
          </button>
        )}
      </div>
    </SidePanel>
  )
}
