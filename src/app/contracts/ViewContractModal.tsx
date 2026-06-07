'use client'

import { createClient } from '@/lib/supabase/client'
import { X, FileSignature, Download, FileText, Calendar, AlertTriangle } from 'lucide-react'

const CONTRACT_TYPE_LABELS: Record<string, string> = {
  delivery: 'Доставка', service: 'Услуга', rent: 'Наем',
  labor: 'Трудов', civil: 'Граждански', other: 'Друг',
}

interface Props {
  item: any
  onClose: () => void
}

export default function ViewContractModal({ item, onClose }: Props) {
  const supabase = createClient()

  const daysLeft = item.end_date
    ? Math.ceil((new Date(item.end_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
    : null

  async function handleDownload() {
    const win = window.open('', '_blank')
    const { data } = await supabase.storage.from('documents').createSignedUrl(item.file_url, 120)
    if (data?.signedUrl && win) win.location.href = data.signedUrl
    else { if (win) win.close(); alert('Грешка при изтегляне') }
  }

  return (
    <div className="fixed inset-0 bg-slate-900/40 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
      <div className="bg-white rounded-3xl border max-w-lg w-full p-6 shadow-2xl relative animate-in fade-in zoom-in-95 duration-200">
        <button onClick={onClose} className="absolute right-4 top-4 p-1.5 hover:bg-slate-100 rounded-lg text-slate-400">
          <X size={18} />
        </button>

        {/* Хедър */}
        <div className="flex items-center gap-3 mb-5 pb-4 border-b border-slate-100">
          <div className="w-10 h-10 rounded-xl bg-purple-50 flex items-center justify-center flex-shrink-0">
            <FileSignature size={18} className="text-purple-600" />
          </div>
          <div>
            <div className="font-mono font-bold text-purple-700 text-lg">{item.number}</div>
            <div className="text-xs text-slate-400 flex items-center gap-1 mt-0.5">
              <Calendar size={11} />
              {item.date ? new Date(item.date).toLocaleDateString('bg-BG', { day: 'numeric', month: 'long', year: 'numeric' }) : ''}
              {item.contract_type && (
                <span className="ml-2 bg-purple-50 text-purple-700 px-2 py-0.5 rounded font-bold text-[10px]">
                  {CONTRACT_TYPE_LABELS[item.contract_type] || item.contract_type}
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="space-y-4">
          {/* Контрагент */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <div className="text-[10px] font-bold text-slate-400 uppercase mb-1">Контрагент</div>
              <div className="text-sm font-bold text-slate-800">{item.counterparty}</div>
            </div>
            {item.internal_owner && (
              <div>
                <div className="text-[10px] font-bold text-slate-400 uppercase mb-1">Вътрешен титуляр</div>
                <div className="text-sm font-semibold text-slate-700">{item.internal_owner}</div>
              </div>
            )}
          </div>

          {/* Предмет */}
          <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
            <div className="text-[10px] font-bold text-slate-400 uppercase mb-1">Предмет</div>
            <div className="text-sm font-bold text-slate-800">{item.subject}</div>
          </div>

          {/* Период */}
          {(item.start_date || item.end_date) && (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <div className="text-[10px] font-bold text-slate-400 uppercase mb-1">Начална дата</div>
                <div className="text-sm font-semibold text-slate-700">
                  {item.start_date ? new Date(item.start_date).toLocaleDateString('bg-BG') : '—'}
                </div>
              </div>
              <div>
                <div className="text-[10px] font-bold text-slate-400 uppercase mb-1">Крайна дата</div>
                <div className="text-sm font-semibold text-slate-700">
                  {item.end_date ? new Date(item.end_date).toLocaleDateString('bg-BG') : '—'}
                </div>
              </div>
            </div>
          )}

          {/* Предупреждение за изтичане */}
          {daysLeft !== null && daysLeft < 30 && (
            <div className={`flex items-center gap-2 text-xs font-bold px-3 py-2.5 rounded-xl ${
              daysLeft < 0 ? 'bg-red-50 text-red-700 border border-red-200' : 'bg-amber-50 text-amber-700 border border-amber-200'
            }`}>
              <AlertTriangle size={14} />
              {daysLeft < 0 ? `Изтекъл преди ${Math.abs(daysLeft)} дни!` : `Изтича след ${daysLeft} дни`}
            </div>
          )}

          {/* Стойност */}
          {item.contract_value && (
            <div>
              <div className="text-[10px] font-bold text-slate-400 uppercase mb-1">Стойност</div>
              <div className="text-sm font-semibold text-slate-700">{Number(item.contract_value).toLocaleString('bg-BG')} EUR</div>
            </div>
          )}

          {/* Бележки */}
          {item.description && (
            <div>
              <div className="text-[10px] font-bold text-slate-400 uppercase mb-1">Бележки</div>
              <div className="text-xs text-slate-600">{item.description}</div>
            </div>
          )}

          {/* Файл */}
          {item.file_url ? (
            <button type="button" onClick={handleDownload}
              className="w-full flex items-center justify-center gap-2 text-white font-bold py-3 rounded-xl shadow-md hover:opacity-90 transition-opacity"
              style={{ backgroundColor: '#0f2240' }}>
              <Download size={16} /> Изтегли / Отвори файла
            </button>
          ) : (
            <div className="w-full flex items-center justify-center gap-2 bg-slate-100 text-slate-400 font-bold py-3 rounded-xl border text-sm">
              <FileText size={16} /> Няма прикачен файл
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
