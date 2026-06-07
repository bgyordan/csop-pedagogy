'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { X, ClipboardList, Download, FileText, Calendar } from 'lucide-react'

interface Props {
  item: any
  onClose: () => void
}

export default function ViewOrderModal({ item, onClose }: Props) {
  const supabase = createClient()

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

        <div className="flex items-center gap-3 mb-5 pb-4 border-b border-slate-100">
          <div className="w-10 h-10 rounded-xl bg-orange-50 flex items-center justify-center flex-shrink-0">
            <ClipboardList size={18} className="text-orange-600" />
          </div>
          <div>
            <div className="font-mono font-bold text-orange-700 text-lg">{item.number}</div>
            <div className="text-xs text-slate-400 flex items-center gap-1 mt-0.5">
              <Calendar size={11} />
              {item.date ? new Date(item.date).toLocaleDateString('bg-BG', { day: 'numeric', month: 'long', year: 'numeric' }) : ''}
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
            <div className="text-[10px] font-bold text-slate-400 uppercase mb-1">Заглавие</div>
            <div className="text-sm font-bold text-slate-800">{item.title}</div>
          </div>

          {item.description && (
            <div>
              <div className="text-[10px] font-bold text-slate-400 uppercase mb-1">Бележки</div>
              <div className="text-xs text-slate-600">{item.description}</div>
            </div>
          )}

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
