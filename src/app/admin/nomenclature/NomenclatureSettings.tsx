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
  allowed_directions: string | null
  default_direction: string | null
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

const DIRECTION_OPTIONS = [
  { value: '', label: '— свободен избор —' },
  { value: 'incoming', label: '↙ Само Входящ' },
  { value: 'outgoing', label: '↗ Само Изходящ' },
  { value: 'internal', label: '⇄ Само Вътрешен' },
  { value: 'incoming,outgoing', label: '↙↗ Входящ / Изходящ' },
]

export default function NomenclatureSettings({ items }: Props) {
  const supabase = createClient()
  const [data, setData] = useState<NomenclatureItem[]>(items)
  const [saving, setSaving] = useState<string | null>(null)

  const sections = [...new Set(data.map(i => i.section_code))]

  async function handleToggle(id: string, field: 'for_correspondence' | 'for_orders', value: boolean) {
    setSaving(`${id}-${field}`)
    setData(prev => prev.map(i => i.id === id ? { ...i, [field]: value } : i))
    await supabase.from('nomenclature_items').update({ [field]: value }).eq('id', id)
    setSaving(null)
  }

  async function handleDirectionChange(id: string, value: string) {
    setSaving(`${id}-direction`)
    const allowed = value || null
    // Ако е само една посока → задаваме и default
    const defaultDir = ['incoming', 'outgoing', 'internal'].includes(value) ? value : null
    setData(prev => prev.map(i => i.id === id ? { ...i, allowed_directions: allowed, default_direction: defaultDir } : i))
    await supabase.from('nomenclature_items').update({
      allowed_directions: allowed,
      default_direction: defaultDir,
    }).eq('id', id)
    setSaving(null)
  }

  const corrCount = data.filter(i => i.for_correspondence).length
  const ordersCount = data.filter(i => i.for_orders).length

  return (
    <div className="space-y-4">
      {/* Статистика */}
      <div className="flex gap-3">
        <div className="card flex-1 text-center py-3">
          <div className="text-2xl font-black text-blue-700">{corrCount}</div>
          <div className="text-xs text-slate-500 mt-0.5">дела за кореспонденция</div>
        </div>
        <div className="card flex-1 text-center py-3">
          <div className="text-2xl font-black text-orange-700">{ordersCount}</div>
          <div className="text-xs text-slate-500 mt-0.5">дела за заповеди</div>
        </div>
        <div className="card flex-1 text-center py-3">
          <div className="text-2xl font-black text-slate-700">{data.length}</div>
          <div className="text-xs text-slate-500 mt-0.5">дела общо</div>
        </div>
      </div>

      {/* Таблица по раздели */}
      {sections.map(section => {
        const sectionItems = data.filter(i => i.section_code === section)
        return (
          <div key={section} className="card overflow-hidden p-0">
            <div className="px-4 py-3 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-slate-700">{SECTION_LABELS[section] || section}</h2>
              <span className="text-xs text-slate-400">{sectionItems.length} дела</span>
            </div>
            <div className="divide-y divide-slate-50">
              {sectionItems.map(item => {
                const isSavingCorr = saving === `${item.id}-for_correspondence`
                const isSavingOrders = saving === `${item.id}-for_orders`
                const isSavingDir = saving === `${item.id}-direction`
                const currentDirection = item.allowed_directions || ''

                return (
                  <div key={item.id} className="flex items-center gap-3 px-4 py-2.5 hover:bg-slate-50/50 transition-colors">
                    <span className="font-mono text-xs font-bold text-slate-500 w-16 flex-shrink-0">{item.item_code}</span>
                    <span className="text-sm text-slate-700 flex-1 min-w-0 truncate">{item.name}</span>
                    <span className="text-[10px] text-slate-400 w-10 text-center flex-shrink-0">{item.retention_years} г.</span>

                    {/* Кореспонденция */}
                    <label className="flex items-center gap-1.5 cursor-pointer flex-shrink-0 w-28">
                      <div className="relative">
                        <input type="checkbox" className="sr-only"
                          checked={item.for_correspondence}
                          onChange={(e) => handleToggle(item.id, 'for_correspondence', e.target.checked)}
                          disabled={!!saving} />
                        <div className={`w-8 h-4 rounded-full transition-colors ${item.for_correspondence ? 'bg-blue-600' : 'bg-slate-200'} ${isSavingCorr ? 'opacity-50' : ''}`}>
                          <div className={`absolute top-0.5 w-3 h-3 rounded-full bg-white shadow transition-transform ${item.for_correspondence ? 'translate-x-4' : 'translate-x-0.5'}`} />
                        </div>
                      </div>
                      <span className={`text-xs font-medium ${item.for_correspondence ? 'text-blue-700' : 'text-slate-400'}`}>Кореспонд.</span>
                    </label>

                    {/* Заповеди */}
                    <label className="flex items-center gap-1.5 cursor-pointer flex-shrink-0 w-24">
                      <div className="relative">
                        <input type="checkbox" className="sr-only"
                          checked={item.for_orders}
                          onChange={(e) => handleToggle(item.id, 'for_orders', e.target.checked)}
                          disabled={!!saving} />
                        <div className={`w-8 h-4 rounded-full transition-colors ${item.for_orders ? 'bg-orange-500' : 'bg-slate-200'} ${isSavingOrders ? 'opacity-50' : ''}`}>
                          <div className={`absolute top-0.5 w-3 h-3 rounded-full bg-white shadow transition-transform ${item.for_orders ? 'translate-x-4' : 'translate-x-0.5'}`} />
                        </div>
                      </div>
                      <span className={`text-xs font-medium ${item.for_orders ? 'text-orange-700' : 'text-slate-400'}`}>Заповеди</span>
                    </label>

                    {/* Посока */}
                    <div className="flex-shrink-0 w-44">
                      <select
                        value={currentDirection}
                        onChange={e => handleDirectionChange(item.id, e.target.value)}
                        disabled={!!saving}
                        className={`w-full text-xs border rounded-lg px-2 py-1 transition-colors ${
                          isSavingDir ? 'opacity-50' : ''
                        } ${currentDirection ? 'border-slate-300 text-slate-700 bg-white' : 'border-slate-200 text-slate-400 bg-slate-50'}`}>
                        {DIRECTION_OPTIONS.map(o => (
                          <option key={o.value} value={o.value}>{o.label}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )
      })}
    </div>
  )
}
