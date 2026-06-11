'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'

interface NomenclatureItem {
  id: string
  item_code: string
  name: string
  section_code: string
  retention_years: string
  for_correspondence: boolean
  for_orders: boolean
  quick_incoming: boolean
  quick_outgoing: boolean
  quick_orders: boolean
}

interface Props {
  items: NomenclatureItem[]
}

const SECTION_LABELS: Record<string, string> = {
  АСД: 'АСД — Административно-стопанска дейност',
  БУТ: 'БУТ — Безопасност на условията на труд',
  ЗК: 'ЗК — Здравен кабинет',
  ЛС: 'ЛС — Личен състав',
  ОД: 'ОД — Одитна дейност',
  РД: 'РД — Ръководна дейност',
  СД: 'СД — Синдикална дейност',
  УА: 'УА — Учрежденски архив',
  УВД: 'УВД — Учебно-възпитателна дейност',
  УН: 'УН — Училищно настоятелство',
  ФСД: 'ФСД — Финансово-счетоводна дейност',
}

type ToggleField = 'for_correspondence' | 'for_orders' | 'quick_incoming' | 'quick_outgoing' | 'quick_orders'

function Toggle({ checked, onChange, disabled, color = 'slate' }: {
  checked: boolean
  onChange: (v: boolean) => void
  disabled: boolean
  color?: string
}) {
  return (
    <div className="relative inline-flex">
      <input type="checkbox" className="sr-only" checked={checked}
        onChange={e => onChange(e.target.checked)} disabled={disabled} />
      <div onClick={() => !disabled && onChange(!checked)}
        className={`w-8 h-4 rounded-full transition-colors cursor-pointer ${checked ? 'bg-[#0f2240]' : 'bg-slate-200'}`}>
        <div className={`absolute top-0.5 w-3 h-3 rounded-full bg-white shadow transition-transform ${checked ? 'translate-x-4' : 'translate-x-0.5'}`} />
      </div>
    </div>
  )
}

export default function NomenclatureSettings({ items }: Props) {
  const supabase = createClient()
  const [data, setData] = useState<NomenclatureItem[]>(items)
  const [saving, setSaving] = useState<string | null>(null)

  const sections = [...new Set(data.map(i => i.section_code))]

  async function handleToggle(id: string, field: ToggleField, value: boolean) {
    setSaving(`${id}-${field}`)
    setData(prev => prev.map(i => i.id === id ? { ...i, [field]: value } : i))
    await supabase.from('nomenclature_items').update({ [field]: value }).eq('id', id)
    setSaving(null)
  }

  const corrCount = data.filter(i => i.for_correspondence).length
  const ordersCount = data.filter(i => i.for_orders).length

  return (
    <div className="space-y-4">
      {/* Статистика */}
      <div className="flex gap-3">
        <div className="bg-white border border-slate-200 rounded-2xl flex-1 text-center py-4 shadow-[0_1px_6px_rgba(15,34,64,0.08)]">
          <div className="text-3xl font-light text-slate-800">{corrCount}</div>
          <div className="text-xs text-slate-500 mt-1">за кореспонденция</div>
        </div>
        <div className="bg-white border border-slate-200 rounded-2xl flex-1 text-center py-4 shadow-[0_1px_6px_rgba(15,34,64,0.08)]">
          <div className="text-3xl font-light text-slate-800">{ordersCount}</div>
          <div className="text-xs text-slate-500 mt-1">за заповеди</div>
        </div>
        <div className="bg-white border border-slate-200 rounded-2xl flex-1 text-center py-4 shadow-[0_1px_6px_rgba(15,34,64,0.08)]">
          <div className="text-3xl font-light text-slate-800">{data.length}</div>
          <div className="text-xs text-slate-500 mt-1">индекса общо</div>
        </div>
      </div>

      {/* Легенда */}
      <div className="bg-white border border-slate-200 rounded-2xl px-5 py-3 shadow-[0_1px_6px_rgba(15,34,64,0.08)] text-xs text-slate-500">
        <span className="font-medium text-slate-700">Колони:</span> Кореспонденция / Заповеди — индексът се показва в списъка ·
        Вх. / Изх. / Зап. — индексът е сред бързите бутони при ново вписване
      </div>

      {/* Таблица по раздели */}
      {sections.map(section => {
        const sectionItems = data.filter(i => i.section_code === section)
        return (
          <div key={section} className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-[0_1px_6px_rgba(15,34,64,0.08)]">
            <div className="px-4 py-3 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
              <h2 className="text-sm font-medium text-slate-700">{SECTION_LABELS[section] || section}</h2>
              <span className="text-xs text-slate-400">{sectionItems.length} дела</span>
            </div>

            {/* Заглавен ред на колоните */}
            <div className="hidden lg:flex items-center gap-3 px-4 py-2 border-b border-slate-100 bg-slate-50/50">
              <span className="w-16 flex-shrink-0"></span>
              <span className="flex-1"></span>
              <span className="w-10 flex-shrink-0"></span>
              <span className="text-[9px] font-medium text-slate-400 uppercase w-24 text-center flex-shrink-0">Кореспонд.</span>
              <span className="text-[9px] font-medium text-slate-400 uppercase w-20 text-center flex-shrink-0">Заповеди</span>
              <span className="text-[9px] font-medium text-slate-400 uppercase w-14 text-center flex-shrink-0">Вх.</span>
              <span className="text-[9px] font-medium text-slate-400 uppercase w-14 text-center flex-shrink-0">Изх.</span>
              <span className="text-[9px] font-medium text-slate-400 uppercase w-14 text-center flex-shrink-0">Зап.</span>
            </div>

            <div className="divide-y divide-slate-50">
              {sectionItems.map(item => (
                <div key={item.id} className="flex items-center gap-3 px-4 py-2 hover:bg-slate-50/50 transition-colors">
                  <span className="text-xs font-medium text-slate-600 w-16 flex-shrink-0">{item.item_code}</span>
                  <span className="text-sm text-slate-700 flex-1 min-w-0 truncate">{item.name}</span>
                  <span className="text-[10px] text-slate-400 w-10 text-center flex-shrink-0">{item.retention_years}г.</span>

                  <div className="w-24 flex justify-center flex-shrink-0">
                    <Toggle checked={item.for_correspondence} disabled={!!saving}
                      onChange={v => handleToggle(item.id, 'for_correspondence', v)} />
                  </div>
                  <div className="w-20 flex justify-center flex-shrink-0">
                    <Toggle checked={item.for_orders} disabled={!!saving}
                      onChange={v => handleToggle(item.id, 'for_orders', v)} />
                  </div>
                  <div className="w-14 flex justify-center flex-shrink-0">
                    <Toggle checked={item.quick_incoming} disabled={!!saving || !item.for_correspondence}
                      onChange={v => handleToggle(item.id, 'quick_incoming', v)} />
                  </div>
                  <div className="w-14 flex justify-center flex-shrink-0">
                    <Toggle checked={item.quick_outgoing} disabled={!!saving || !item.for_correspondence}
                      onChange={v => handleToggle(item.id, 'quick_outgoing', v)} />
                  </div>
                  <div className="w-14 flex justify-center flex-shrink-0">
                    <Toggle checked={item.quick_orders} disabled={!!saving || !item.for_orders}
                      onChange={v => handleToggle(item.id, 'quick_orders', v)} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}
