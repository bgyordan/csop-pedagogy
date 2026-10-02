'use client'

import React, { useState } from 'react'
import { GraduationCap, User, ClipboardList, Loader2, Paperclip, ExternalLink, Pencil } from 'lucide-react'
import { SidePanel, PanelField, FilePreview } from '@/components/registry/SidePanel'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

const DIRECTION_CONFIG = {
  incoming: { label: 'Входящ' },
  outgoing: { label: 'Изходящ' },
  internal: { label: 'Вътрешен' },
}

function FolderPosition({ number }: { number: string }) {
  const supabase = createClient()
  const [pos, setPos] = React.useState<number | null>(null)

  React.useEffect(() => {
    const parts = number.split('-')
    if (parts.length < 2) return
    const folderCode = parts.slice(0, 2).join('-')
    supabase.from('correspondence').select('number')
      .like('number', `${folderCode}-%`).order('created_at', { ascending: true })
      .then(({ data }: any) => {
        if (!data) return
        const idx = data.findIndex((d: any) => d.number === number)
        setPos(idx >= 0 ? idx + 1 : null)
      })
  }, [number])

  if (!pos) return null
  return (
    <span className="text-[10px] text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md normal-case tracking-normal">
      №{pos} в папката
    </span>
  )
}

interface Props {
  item: any
  students: { id: string; first_name: string; last_name: string }[]
  staff: { id: string; first_name: string; last_name: string }[]
  onClose: () => void
  onPrev?: (() => void) | null
  onNext?: (() => void) | null
  canEdit?: boolean
  onEdit?: () => void
}

// Преглед на входящ/изходящ — страничен панел (списъкът остава видим)
export default function ViewCorrespondenceModal({ item, students, staff, onClose, onPrev, onNext, canEdit = false, onEdit }: Props) {
  const supabase = createClient()
  const router = useRouter()
  const cfg = DIRECTION_CONFIG[item.direction as keyof typeof DIRECTION_CONFIG] || DIRECTION_CONFIG.incoming
  const student = students.find(s => s.id === item.student_id)
  const staffMember = staff.find(s => s.id === item.staff_id)
  const [issuingOrder, setIssuingOrder] = useState(false)
  const [orderIssued, setOrderIssued] = useState<string | null>(null)
  const [existingOrder, setExistingOrder] = React.useState<string | null>(null)

  const isLS02 = item.nomenclature_item === 'ЛС-02' || item.number?.startsWith('ЛС-02')

  // Проверяваме дали вече има заповед за този документ
  // При смяна на записа (↑/↓ или клик на друг ред) — изчисти състоянието от предишния
  React.useEffect(() => { setOrderIssued(null); setExistingOrder(null) }, [item.id])

  React.useEffect(() => {
    if (!isLS02) return
    supabase.from('orders')
      .select('number')
      .like('description', `%${item.number}%`)
      .maybeSingle()
      .then(({ data }) => {
        if (data) setExistingOrder(data.number)
      })
  }, [item.number])

  async function handleDownload() {
    const win = window.open('', '_blank')
    const { data } = await supabase.storage.from('documents').createSignedUrl(item.file_url, 120)
    if (data?.signedUrl && win) win.location.href = data.signedUrl
    else { if (win) win.close(); alert('Грешка при изтегляне') }
  }

  async function handleIssueOrder() {
    setIssuingOrder(true)
    const today = new Date().toISOString().split('T')[0]
    const currentYear = new Date().getFullYear()
const { count } = await supabase.from('orders').select('id', { count: 'exact', head: true })
  .gte('date', `${currentYear}-01-01`).lte('date', `${currentYear}-12-31`)
const nextNum = String((count || 0) + 1).padStart(3, '0')
const formattedDate = today.split('-').reverse().join('.')
const orderNumber = `${nextNum}/${formattedDate}г.`
    const orderTitle = `Заповед за отпуск на ${item.from_whom || ''}`
    const { data: profile } = await supabase.from('staff_profiles').select('id').eq('user_id', (await supabase.auth.getUser()).data.user?.id!).single()
    const { error } = await supabase.from('orders').insert({
      number: orderNumber, date: today, title: orderTitle, nomenclature_item: 'РД-08',
      description: `Издадена въз основа на Вх. ${item.number}`,
      file_url: item.file_url || null,
      file_name: item.file_name || null,
      created_by: profile?.id,
    })
    if (error) { alert(`Грешка: ${error.message}`); setIssuingOrder(false); return }
    setOrderIssued(orderNumber)
    setIssuingOrder(false)
    router.refresh()
  }

  const finalOrder = orderIssued || existingOrder

  const person = item.direction === 'outgoing' ? item.to_whom : item.from_whom
  const personLabel = item.direction === 'outgoing' ? 'До кого' : 'От кого'
  const badge = item.is_reserved ? <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-100 text-amber-800">резерв.</span> : null

  return (
    <SidePanel kind={cfg.label} number={item.number} date={item.date} badge={badge}
      onClose={onClose} onPrev={onPrev} onNext={onNext}
      footer={canEdit && onEdit ? (
        <button type="button" onClick={onEdit}
          className="ml-auto inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-medium border border-slate-300 text-slate-700 hover:bg-slate-50 transition-colors">
          <Pencil size={13} /> Редактирай
        </button>
      ) : undefined}>

      {person && <PanelField label={personLabel}>{person}</PanelField>}

      <div>
        <div className="flex items-center justify-between mb-1">
          <div className="text-[11px] font-medium text-slate-500 uppercase tracking-wider">Относно</div>
          <FolderPosition number={item.number} />
        </div>
        <div className="text-[15px] text-slate-900 leading-snug">{item.subject || '—'}</div>
      </div>

      {item.description && <PanelField label="Забележка">{item.description}</PanelField>}

      <PanelField label="Архивен индекс">{item.nomenclature_item || '—'}</PanelField>

      {(student || staffMember) && (
        <div>
          <div className="text-[11px] font-medium text-slate-500 uppercase tracking-wider mb-1.5">Свързано лице</div>
          <div className="flex flex-wrap gap-1.5">
            {student && (
              <span className="inline-flex items-center gap-1.5 text-sm text-[#0f2240] bg-blue-50 border border-blue-100 px-3 py-1.5 rounded-xl">
                <GraduationCap size={15} />{student.first_name} {student.last_name}
              </span>
            )}
            {staffMember && (
              <span className="inline-flex items-center gap-1.5 text-sm text-purple-700 bg-purple-50 border border-purple-100 px-3 py-1.5 rounded-xl">
                <User size={15} />{staffMember.first_name} {staffMember.last_name}
              </span>
            )}
          </div>
        </div>
      )}

      <div>
        <div className="text-[11px] font-medium text-slate-500 uppercase tracking-wider mb-1.5">Файл</div>
        {item.file_url ? (<>
          <button type="button" onClick={handleDownload}
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

      {/* Регистрирай заповед — само за ЛС-02 */}
      {isLS02 && (
        <div className={`p-4 rounded-xl border ${finalOrder ? 'bg-emerald-50 border-emerald-200' : 'bg-orange-50 border-orange-200'}`}>
          {finalOrder ? (
            <div className="flex items-center gap-2 text-emerald-700">
              <ClipboardList size={16} />
              <div>
                <div className="text-xs font-medium">Заповедта е регистрирана</div>
                <div className="text-[12px] mt-0.5 tabular-nums">{finalOrder}</div>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-xs font-medium text-orange-800">Необходима е заповед за отпуск</div>
                <div className="text-[11px] text-orange-700 mt-0.5">Ще се регистрира РД-08 автоматично</div>
              </div>
              <button type="button" onClick={handleIssueOrder} disabled={issuingOrder}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-medium text-white shadow-sm disabled:opacity-60 whitespace-nowrap"
                style={{ backgroundColor: '#0f2240' }}>
                {issuingOrder ? <Loader2 size={13} className="animate-spin" /> : <ClipboardList size={13} />}
                {issuingOrder ? 'Регистриране…' : 'Регистрирай заповед'}
              </button>
            </div>
          )}
        </div>
      )}
    </SidePanel>
  )
}
