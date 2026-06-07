'use client'

import React from 'react'
import { X, FolderOpen, GraduationCap, User, Download, FileText } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

const DIRECTION_CONFIG = {
  incoming: { label: 'Входящ', badge: 'bg-blue-100 text-blue-800 border-blue-200', icon: '↙' },
  outgoing: { label: 'Изходящ', badge: 'bg-emerald-100 text-emerald-800 border-emerald-200', icon: '↗' },
  internal: { label: 'Вътрешен', badge: 'bg-purple-100 text-purple-800 border-purple-200', icon: '⇄' },
}

function FolderPosition({ number }: { number: string }) {
  const supabase = createClient()
  const [pos, setPos] = React.useState<number | null>(null)

  React.useEffect(() => {
    const parts = number.split('-')
    if (parts.length < 2) return
    const folderCode = parts.slice(0, 2).join('-')
    supabase
      .from('correspondence')
      .select('number')
      .like('number', `${folderCode}-%`)
      .order('created_at', { ascending: true })
      .then(({ data }: any) => {
        if (!data) return
        const idx = data.findIndex((d: any) => d.number === number)
        setPos(idx >= 0 ? idx + 1 : null)
      })
  }, [number])

  if (!pos) return null
  return (
    <span className="text-[10px] font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md">
      №{pos} в папката
    </span>
  )
}

interface Props {
  item: any
  students: { id: string; first_name: string; last_name: string }[]
  staff: { id: string; first_name: string; last_name: string }[]
  onClose: () => void
}

export default function ViewCorrespondenceModal({ item, students, staff, onClose }: Props) {
  const supabase = createClient()
  const cfg = DIRECTION_CONFIG[item.direction as keyof typeof DIRECTION_CONFIG] || DIRECTION_CONFIG.incoming
  const student = students.find(s => s.id === item.student_id)
  const staffMember = staff.find(s => s.id === item.staff_id)

  async function handleDownload() {
    const win = window.open('', '_blank')
    const { data } = await supabase.storage.from('documents').createSignedUrl(item.file_url, 120)
    if (data?.signedUrl && win) win.location.href = data.signedUrl
    else { if (win) win.close(); alert('Грешка при изтегляне') }
  }

  return (
    <div className="fixed inset-0 bg-slate-900/40 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
      <div className="bg-white rounded-3xl border max-w-2xl w-full p-6 shadow-2xl relative max-h-[90vh] overflow-y-auto animate-in fade-in zoom-in-95 duration-200">
        <button onClick={onClose} className="absolute right-4 top-4 p-1.5 hover:bg-slate-100 rounded-lg text-slate-400">
          <X size={18} />
        </button>

        <h3 className="font-bold text-slate-800 text-sm uppercase mb-4 flex items-center gap-2">
          <FolderOpen size={18} className="text-[#0f2240]" /> Детайли за документ
        </h3>

        <div className="space-y-5">
          {/* Хедър */}
          <div className="flex items-start justify-between border-b pb-4">
            <div>
              <div className="text-xl font-mono font-bold text-[#0f2240]">{item.number}</div>
              <div className="text-sm text-slate-500 mt-1">
                Регистриран: {item.date ? new Date(item.date).toLocaleDateString('bg-BG') : item.date}
              </div>
            </div>
            <span className={`inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-xl border ${cfg.badge}`}>
              {cfg.icon} {cfg.label}
            </span>
          </div>

          {/* От / До */}
          <div className="grid grid-cols-2 gap-5">
            <div>
              <div className="text-[10px] font-bold text-slate-400 uppercase mb-1">От кого</div>
              <div className="text-sm font-bold text-slate-800">{item.from_whom || '—'}</div>
            </div>
            <div>
              <div className="text-[10px] font-bold text-slate-400 uppercase mb-1">До кого</div>
              <div className="text-sm font-bold text-slate-800">{item.to_whom || '—'}</div>
            </div>
          </div>

          {/* Тема */}
          <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
            <div className="flex items-center justify-between mb-2">
              <div className="text-[10px] font-bold text-slate-400 uppercase">Тема / Относно</div>
              <FolderPosition number={item.number} />
            </div>
            <div className="text-sm font-bold text-slate-800 mb-3">{item.subject}</div>
            {item.description && (
              <>
                <div className="text-[10px] font-bold text-slate-400 uppercase mb-1">Бележки</div>
                <div className="text-xs text-slate-600">{item.description}</div>
              </>
            )}
          </div>

          {/* Свързано лице */}
          {(student || staffMember) && (
            <div>
              <div className="text-[10px] font-bold text-slate-400 uppercase mb-2">Свързано лице</div>
              {student && (
                <span className="inline-flex items-center gap-1.5 text-sm font-bold text-[#0f2240] bg-blue-50 border border-blue-100 px-3 py-1.5 rounded-xl">
                  <GraduationCap size={15} />{student.first_name} {student.last_name}
                </span>
              )}
              {staffMember && (
                <span className="inline-flex items-center gap-1.5 text-sm font-bold text-purple-700 bg-purple-50 border border-purple-100 px-3 py-1.5 rounded-xl">
                  <User size={15} />{staffMember.first_name} {staffMember.last_name}
                </span>
              )}
            </div>
          )}

          {/* Файл */}
          {item.file_url ? (
            <button type="button" onClick={handleDownload}
              className="w-full flex items-center justify-center gap-2 text-white font-bold py-3 rounded-xl shadow-md"
              style={{ backgroundColor: '#0f2240' }}>
              <Download size={18} /> Изтегли / Отвори файла
            </button>
          ) : (
            <div className="w-full flex items-center justify-center gap-2 bg-slate-100 text-slate-400 font-bold py-3 rounded-xl border">
              <FileText size={18} /> Няма прикачен файл
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
