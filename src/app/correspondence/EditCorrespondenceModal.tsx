'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { X, Loader2, Save, Upload, FileText, Paperclip } from 'lucide-react'

const EXTERNAL_SUGGESTIONS = [
  'МОН — Министерство на образованието и науката',
  'РУО — Варна', 'Община Варна', 'РЦПППО — Варна',
  'Агенция за социално подпомагане', 'РЗОК — Варна',
  'НОИ — Варна', 'Дирекция "Социално подпомагане"',
]

const INTERNAL_PERSONS = [
  'Светлана Иванова — Директор',
  'Йордан Йорданов — ЗДАСД',
  'Силвия Кьошкерян — ЗДУД',
  'Радка Георгиева — Счетоводство',
]

interface Props {
  item: any
  onClose: () => void
}

export default function EditCorrespondenceModal({ item, onClose }: Props) {
  const router = useRouter()
  const supabase = createClient()

  const [saving, setSaving] = useState(false)
  const [date, setDate] = useState(item.date || '')
  const [fromWhom, setFromWhom] = useState(item.from_whom || '')
  const [toWhom, setToWhom] = useState(item.to_whom || '')
  const [subject, setSubject] = useState(item.subject || '')
  const [description, setDescription] = useState(item.description || '')
  const [newFile, setNewFile] = useState<File | null>(null)

  const dir = item.direction

  async function handleSave() {
    if (!subject) return
    setSaving(true)

    let fileUrl = item.file_url
    let fileName = item.file_name

    if (newFile) {
      const currentYear = new Date().getFullYear()
      const ext = newFile.name.split('.').pop()
      const filePath = `correspondence/${currentYear}/${Date.now()}.${ext}`
      const { error: uploadError } = await supabase.storage.from('documents').upload(filePath, newFile, { upsert: true })
      if (!uploadError) { fileUrl = filePath; fileName = newFile.name }
    }

    const { error } = await supabase.from('correspondence').update({
      date,
      from_whom: fromWhom || null,
      to_whom: toWhom || null,
      subject,
      description: description || null,
      file_url: fileUrl || null,
      file_name: fileName || null,
    }).eq('id', item.id)

    if (error) { alert(`Грешка: ${error.message}`); setSaving(false); return }
    setSaving(false)
    onClose()
    router.refresh()
  }

  return (
    <div className="fixed inset-0 bg-slate-900/40 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
      <div className="bg-white rounded-3xl border max-w-lg w-full shadow-2xl animate-in fade-in zoom-in-95 duration-200">

        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <div>
            <h3 className="font-bold text-slate-800 text-sm uppercase tracking-wide">Редакция</h3>
            <p className="text-[11px] text-[#0f2240] font-bold mt-0.5">{item.number}</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-xl text-slate-400">
            <X size={18} />
          </button>
        </div>

        <div className="p-6 space-y-3">
          <div>
            <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Дата</label>
            <input type="date" value={date} onChange={e => setDate(e.target.value)} className="input w-44" />
          </div>

          {dir === 'incoming' && (
            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">От кого</label>
              <input type="text" list="from-list" value={fromWhom} onChange={e => setFromWhom(e.target.value)}
                placeholder="Институция / лице..." className="input w-full" />
              <datalist id="from-list">{EXTERNAL_SUGGESTIONS.map(s => <option key={s} value={s} />)}</datalist>
            </div>
          )}

          {dir === 'outgoing' && (
            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">До кого</label>
              <input type="text" list="to-list" value={toWhom} onChange={e => setToWhom(e.target.value)}
                placeholder="Институция / лице..." className="input w-full" />
              <datalist id="to-list">{EXTERNAL_SUGGESTIONS.map(s => <option key={s} value={s} />)}</datalist>
            </div>
          )}

          {dir === 'internal' && (
            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">От кого</label>
              <input type="text" list="internal-list" value={fromWhom} onChange={e => setFromWhom(e.target.value)}
                placeholder="Длъжностно лице..." className="input w-full" />
              <datalist id="internal-list">{INTERNAL_PERSONS.map(s => <option key={s} value={s} />)}</datalist>
            </div>
          )}

          <div>
            <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Тема / Относно *</label>
            <input type="text" value={subject} onChange={e => setSubject(e.target.value)}
              required placeholder="Относно..." className="input w-full" />
          </div>

          <div>
            <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Забележка</label>
            <textarea rows={2} value={description} onChange={e => setDescription(e.target.value)}
              placeholder="Допълнителна информация..." className="input w-full resize-none" />
          </div>

          {/* Файл */}
          <div>
            <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Прикачен файл</label>
            {item.file_name && !newFile && (
              <div className="flex items-center gap-2 p-2.5 bg-slate-50 border border-slate-200 rounded-xl mb-2">
                <Paperclip size={13} className="text-slate-400 flex-shrink-0" />
                <span className="text-xs text-slate-600 truncate flex-1">{item.file_name}</span>
                <span className="text-[10px] text-slate-400">текущ</span>
              </div>
            )}
            {newFile ? (
              <div className="flex items-center gap-3 p-3 bg-emerald-50 rounded-xl border border-emerald-200">
                <FileText size={15} className="text-emerald-600 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-bold text-slate-800 truncate">{newFile.name}</div>
                  <div className="text-[10px] text-slate-400">{(newFile.size / 1024).toFixed(0)} KB — нов файл</div>
                </div>
                <button type="button" onClick={() => setNewFile(null)} className="text-slate-400 hover:text-red-500 p-1"><X size={13} /></button>
              </div>
            ) : (
              <label className="flex items-center justify-center w-full h-9 border-2 border-dashed border-slate-200 rounded-xl cursor-pointer hover:border-[#0f2240] hover:bg-slate-50 transition-all">
                <div className="flex items-center gap-2 text-slate-400">
                  <Upload size={13} /><span className="text-xs font-semibold">{item.file_name ? 'Смени файла' : 'Прикачи файл'}</span>
                </div>
                <input type="file" className="hidden" accept=".pdf,.doc,.docx"
                  onChange={e => { const f = e.target.files?.[0]; if (f) setNewFile(f) }} />
              </label>
            )}
          </div>
        </div>

        <div className="flex gap-3 justify-end px-6 pb-6 pt-2 border-t border-slate-100">
          <button type="button" onClick={onClose}
            className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold">
            Отказ
          </button>
          <button type="button" onClick={handleSave} disabled={saving}
            className="px-5 py-2.5 text-white rounded-xl text-xs font-bold flex items-center gap-2 disabled:opacity-60 shadow-md"
            style={{ backgroundColor: '#0f2240' }}>
            {saving ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
            {saving ? 'Запазване...' : 'Запази'}
          </button>
        </div>
      </div>
    </div>
  )
}
