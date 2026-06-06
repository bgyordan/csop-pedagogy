"use client";

import React, { useState, useRef } from 'react';
import { 
  ArrowDownLeft, ArrowUpRight, Plus, X, 
  Paperclip, FileText, Search, Upload, Loader2, ArrowRightLeft
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';

// Дефинираме локални интерфейси (можеш да ги изнесеш в @/types/index.ts)
interface Student {
  id: string;
  first_name: string;
  last_name: string;
  status: string;
}

interface Correspondence {
  id: string;
  number: string;
  date: string;
  type: 'incoming' | 'outgoing' | 'internal';
  from_whom: string;
  to_whom: string;
  subject: string;
  description?: string;
  student_id?: string;
  file_url?: string;
  file_name?: string;
  created_at: string;
}

interface CorrespondenceClientProps {
  initialCorrespondence: Correspondence[];
  students: Student[];
  currentUserId: string;
}

const FROM_SUGGESTIONS = [
  'МОН — Министерство на образованието и науката',
  'РУО — Варна',
  'Община Варна',
  'Агенция за социално подпомагане',
  'РЗОК — Варна',
  'РЦПППО — Варна',
  'Национален осигурителен институт (НОИ)',
  'Инспекторат по образованието',
  'Дирекция "Социално подпомагане"',
  'ЦСОП — Варна',
];

const SUBJECT_SUGGESTIONS = [
  'Докладна записка',
  'Заявление за отпуск',
  'Протокол от ЕПЛР',
  'Служебна бележка',
  'Доклад',
  'Уведомление',
  'Покана',
  'Молба за записване',
  'Заповед за насочване',
  'Медицинска документация',
  'Оценка от РЦПППО',
];

export default function CorrespondenceClient({
  initialCorrespondence,
  students,
  currentUserId
}: CorrespondenceClientProps) {
  const router = useRouter();
  const supabase = createClient();

  const [correspondence, setCorrespondence] = useState<Correspondence[]>(initialCorrespondence);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [isOpeningForm, setIsOpeningForm] = useState(false);

  const [newType, setNewType] = useState<'incoming' | 'outgoing' | 'internal'>('incoming');
  const [newTitle, setNewTitle] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [newFromWhom, setNewFromWhom] = useState('');
  const [newToWhom, setNewToWhom] = useState('');
  const [newDate, setNewDate] = useState(new Date().toISOString().split('T')[0]);
  const [boundStudentId, setBoundStudentId] = useState('');
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const currentYear = new Date().getFullYear();
  
  const getNextDocumentNumber = () => {
    const totalThisYearCount = correspondence.filter(c => c.number.endsWith(String(currentYear))).length;
    return `${totalThisYearCount + 1}/${currentYear}`;
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      alert('Файлът е прекалено голям (макс. 10MB)');
      return;
    }
    const ext = file.name.split('.').pop()?.toLowerCase();
    if (!['pdf', 'doc', 'docx'].includes(ext || '')) {
      alert('Позволени са само PDF и Word файлове');
      return;
    }
    setUploadedFile(file);
  };

  const handleCreateDocument = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle) return;

    // Динамично определяне на подател/получател спрямо типа
    const finalFromWhom = newType === 'outgoing' ? 'ЦСОП Варна' : newFromWhom;
    const finalToWhom = newType === 'incoming' ? 'ЦСОП Варна' : newToWhom;

    setUploading(true);
    let fileUrl = '';
    let fileName = '';

    // Качване на файл в Supabase Storage (бъкет 'documents' или 'student-dossiers')
    if (uploadedFile) {
      const ext = uploadedFile.name.split('.').pop();
      const filePath = `correspondence/${currentYear}/${Date.now()}.${ext}`;
      const { error: uploadError } = await supabase.storage
        .from('student-dossiers') // Смени на 'documents' ако имаш отделен бъкет
        .upload(filePath, uploadedFile, { upsert: true });
      
      if (!uploadError) {
        const { data: urlData } = supabase.storage
          .from('student-dossiers')
          .getPublicUrl(filePath);
        fileUrl = urlData.publicUrl;
        fileName = uploadedFile.name;
      } else {
        console.error("Upload error:", uploadError);
        alert('Грешка при качване на файла.');
        setUploading(false);
        return;
      }
    }

    const docNumber = getNextDocumentNumber();
    
    // Подготовка на данните за запис в базата
    const newDocData = {
      number: docNumber,
      date: newDate,
      type: newType,
      from_whom: finalFromWhom,
      to_whom: finalToWhom,
      subject: newTitle,
      description: newDesc,
      student_id: boundStudentId || null,
      file_url: fileUrl || null,
      file_name: fileName || null,
      created_by: currentUserId,
    };

    // Запис в Supabase
    const { data: insertedData, error } = await supabase
      .from('correspondence')
      .insert(newDocData)
      .select()
      .single();

    setUploading(false);

    if (error) {
      console.error("DB Insert Error:", error);
      alert('Възникна грешка при запис в регистъра.');
      return;
    }

    // Обновяване на локалния стейт за моментална визуализация
    setCorrespondence(prev => [insertedData, ...prev]);
    
    // Зачистване на формата
    setNewTitle('');
    setNewDesc('');
    setNewFromWhom('');
    setNewToWhom('');
    setNewDate(new Date().toISOString().split('T')[0]);
    setBoundStudentId('');
    setUploadedFile(null);
    setIsOpeningForm(false);
    
    // Опресняване на рутера във фонов режим
    router.refresh();
  };

  const filteredCorr = correspondence.filter((item) => {
    const matchType = typeFilter === 'all' || item.type === typeFilter;
    const q = search.toLowerCase();
    const matchSearch = item.subject.toLowerCase().includes(q) || 
                        item.number.toLowerCase().includes(q) ||
                        (item.from_whom && item.from_whom.toLowerCase().includes(q)) ||
                        (item.description && item.description.toLowerCase().includes(q));
    return matchType && matchSearch;
  });

  return (
    <div className="space-y-6 font-sans">
      
      {/* Филтри и бутон */}
      <div className="bg-white border rounded-2xl p-4 shadow-sm flex flex-col md:flex-row gap-4 items-center justify-between">
        <div className="flex flex-wrap gap-2">
          {[
            { key: 'all', label: 'Всички' },
            { key: 'incoming', label: '↙ Входяща', icon: <ArrowDownLeft className="w-3 h-3 inline mr-1"/> },
            { key: 'outgoing', label: '↗ Изходяща', icon: <ArrowUpRight className="w-3 h-3 inline mr-1"/> },
            { key: 'internal', label: '⇄ Вътрешна', icon: <ArrowRightLeft className="w-3 h-3 inline mr-1"/> },
          ].map(({ key, label }) => (
            <button key={key} onClick={() => setTypeFilter(key)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                typeFilter === key ? 'bg-[#0f2240] text-white shadow-sm' : 'text-slate-600 hover:bg-slate-50 border border-slate-200'
              }`}>
              {label}
            </button>
          ))}
        </div>

        <div className="flex gap-3 items-center w-full md:w-auto justify-end">
          <div className="relative">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <input type="text" placeholder="Търсене..." value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 pr-4 py-2 border rounded-xl text-xs focus:outline-none w-52 border-slate-200" />
          </div>
          <button onClick={() => setIsOpeningForm(true)}
            className="bg-[#0f2240] hover:bg-slate-800 transition-colors text-white text-xs font-bold px-4 py-2.5 rounded-xl shadow-sm flex items-center gap-1.5">
            <Plus className="h-4 w-4" />
            Нов документ
          </button>
        </div>
      </div>

      {/* Таблица */}
      <div className="bg-white border rounded-2xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs font-semibold text-slate-700 min-w-[700px]">
            <thead className="bg-[#f0f7ff] text-[10px] uppercase font-bold text-slate-400">
              <tr>
                <th className="p-4 pl-6">№</th>
                <th className="p-4">Вид</th>
                <th className="p-4">Дата</th>
                <th className="p-4">От кого</th>
                <th className="p-4">До кого</th>
                <th className="p-4">Относно</th>
                <th className="p-4">Ученик</th>
                <th className="p-3">Файл</th>
              </tr>
            </thead>
            <tbody className="divide-y font-medium text-slate-800">
              {filteredCorr.length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-8 text-center text-slate-400">
                    Няма намерени документи в регистъра.
                  </td>
                </tr>
              ) : (
                filteredCorr.map((item) => {
                  const student = students.find(s => s.id === item.student_id);
                  return (
                    <tr key={item.id} className="hover:bg-slate-50/50">
                      <td className="p-4 pl-6">
                        <span className="font-mono font-bold text-[#0f2240]">№ {item.number}</span>
                      </td>
                      <td className="p-4">
                        {item.type === 'incoming' && <span className="bg-amber-100 text-amber-800 text-[10px] px-2.5 py-0.5 rounded-md font-bold uppercase">Входящ</span>}
                        {item.type === 'outgoing' && <span className="bg-blue-100 text-blue-800 text-[10px] px-2.5 py-0.5 rounded-md font-bold uppercase">Изходящ</span>}
                        {item.type === 'internal' && <span className="bg-purple-100 text-purple-800 text-[10px] px-2.5 py-0.5 rounded-md font-bold uppercase">Вътрешен</span>}
                      </td>
                      <td className="p-4 text-slate-500 font-mono">{item.date}</td>
                      <td className="p-4 font-bold text-slate-700">{item.from_whom}</td>
                      <td className="p-4 text-slate-600">{item.to_whom}</td>
                      <td className="p-4">
                        <div className="font-bold text-slate-800">{item.subject}</div>
                        {item.description && <p className="text-[10px] text-slate-400 mt-0.5 max-w-xs line-clamp-1">{item.description}</p>}
                      </td>
                      <td className="p-4">
                        {student ? (
                          <span className="text-[10px] font-bold text-[#0f2240]">{student.first_name} {student.last_name}</span>
                        ) : (
                          <span className="text-[10px] text-slate-300">—</span>
                        )}
                      </td>
                      <td className="p-3">
                        {item.file_url ? (
                          <a href={item.file_url} target="_blank" rel="noopener noreferrer"
                            className="text-[#0f2240] flex items-center gap-1.5 hover:underline text-[10px] font-bold">
                            <Paperclip className="h-3.5 w-3.5" />
                            Преглед
                          </a>
                        ) : (
                          <span className="text-[10px] text-slate-300">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Форма за нов документ */}
      {isOpeningForm && (
        <div className="fixed inset-0 bg-slate-900/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white rounded-3xl border max-w-lg w-full p-6 shadow-2xl relative max-h-[90vh] overflow-y-auto">
            <button onClick={() => setIsOpeningForm(false)}
              className="absolute right-4 top-4 p-1.5 hover:bg-slate-100 rounded-lg text-slate-400">
              <X className="h-5 w-5" />
            </button>
            
            <h3 className="font-bold text-slate-800 text-sm uppercase mb-1">Деловодно Вписване</h3>
            <p className="text-[10px] text-slate-500 mb-4 font-semibold">
              Следващ номер: <strong>{getNextDocumentNumber()}</strong>
            </p>

            <form onSubmit={handleCreateDocument} className="space-y-4">
              {/* Тип */}
              <div>
                <label className="block text-[10px] font-bold text-slate-400 mb-1.5 uppercase">Вид документ *</label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { key: 'incoming', label: 'Входяща' },
                    { key: 'outgoing', label: 'Изходяща' },
                    { key: 'internal', label: 'Вътрешна' },
                  ].map(({ key, label }) => (
                    <button key={key} type="button"
                      onClick={() => setNewType(key as 'incoming' | 'outgoing' | 'internal')}
                      className={`py-2 text-xs font-bold rounded-xl border transition-colors ${
                        newType === key
                          ? key === 'incoming' ? 'bg-amber-100 border-amber-300 text-amber-800'
                          : key === 'outgoing' ? 'bg-blue-100 border-blue-300 text-blue-800'
                          : 'bg-purple-100 border-purple-300 text-purple-800'
                          : 'bg-white hover:bg-slate-50 border-slate-200'
                      }`}>
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Дата */}
              <div>
                <label className="block text-[10px] font-bold text-slate-400 mb-1.5 uppercase">Дата на документа *</label>
                <input type="date" value={newDate} onChange={(e) => setNewDate(e.target.value)}
                  className="w-full border border-slate-200 rounded-xl p-2.5 text-xs focus:outline-none focus:ring-2 focus:ring-[#0f2240]/20" required />
              </div>

              {/* Динамични полета От кого / До кого */}
              <div className="grid grid-cols-1 gap-3">
                {newType !== 'outgoing' && (
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 mb-1.5 uppercase">
                      От кого (Подател) *
                    </label>
                    <input type="text" list="from-suggestions" required
                      placeholder="напр. РУО Варна"
                      value={newFromWhom} onChange={(e) => setNewFromWhom(e.target.value)}
                      className="w-full border border-slate-200 rounded-xl p-2.5 text-xs focus:outline-none focus:ring-2 focus:ring-[#0f2240]/20" />
                  </div>
                )}
                
                {newType !== 'incoming' && (
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 mb-1.5 uppercase">
                      До кого (Получател) *
                    </label>
                    <input type="text" list="to-suggestions" required
                      placeholder="напр. РЦПППО Варна"
                      value={newToWhom} onChange={(e) => setNewToWhom(e.target.value)}
                      className="w-full border border-slate-200 rounded-xl p-2.5 text-xs focus:outline-none focus:ring-2 focus:ring-[#0f2240]/20" />
                  </div>
                )}
                <datalist id="from-suggestions">
                  {FROM_SUGGESTIONS.map(s => <option key={s} value={s} />)}
                </datalist>
                <datalist id="to-suggestions">
                  {FROM_SUGGESTIONS.map(s => <option key={s} value={s} />)}
                </datalist>
              </div>

              {/* Тема */}
              <div>
                <label className="block text-[10px] font-bold text-slate-400 mb-1.5 uppercase">Тема / Относно *</label>
                <input type="text" list="subject-suggestions" required
                  placeholder="напр. Молба за записване"
                  value={newTitle} onChange={(e) => setNewTitle(e.target.value)}
                  className="w-full border border-slate-200 rounded-xl p-2.5 text-xs focus:outline-none focus:ring-2 focus:ring-[#0f2240]/20" />
                <datalist id="subject-suggestions">
                  {SUBJECT_SUGGESTIONS.map(s => <option key={s} value={s} />)}
                </datalist>
              </div>

              {/* Описание */}
              <div>
                <label className="block text-[10px] font-bold text-slate-400 mb-1.5 uppercase">Допълнителни бележки</label>
                <textarea rows={2} value={newDesc} onChange={(e) => setNewDesc(e.target.value)}
                  placeholder="Допълнителна информация..."
                  className="w-full border border-slate-200 rounded-xl p-2.5 text-xs focus:outline-none focus:ring-2 focus:ring-[#0f2240]/20 resize-none" />
              </div>

              {/* Ученик */}
              <div>
                <label className="block text-[10px] font-bold text-slate-400 mb-1.5 uppercase">Свързан ученик (опционално)</label>
                <select value={boundStudentId} onChange={(e) => setBoundStudentId(e.target.value)}
                  className="w-full border border-slate-200 rounded-xl p-2.5 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-[#0f2240]/20">
                  <option value="">Няма връзка към ученик</option>
                  {students.filter(s => s.status === 'active').sort((a, b) => a.last_name.localeCompare(b.last_name)).map(s => (
                    <option key={s.id} value={s.id}>{s.last_name} {s.first_name}</option>
                  ))}
                </select>
              </div>

              {/* Файл */}
              <div>
                <label className="block text-[10px] font-bold text-slate-400 mb-1.5 uppercase">Прикачен документ (PDF/Word, макс. 10MB)</label>
                {uploadedFile ? (
                  <div className="flex items-center gap-3 p-3 bg-emerald-50 rounded-xl border border-emerald-200">
                    <FileText className="h-5 w-5 text-emerald-600 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-bold text-slate-800 truncate">{uploadedFile.name}</div>
                      <div className="text-[10px] text-slate-400">{(uploadedFile.size / 1024).toFixed(0)} KB</div>
                    </div>
                    <button type="button" onClick={() => setUploadedFile(null)}
                      className="text-slate-400 hover:text-red-500 p-1">
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                ) : (
                  <label className="flex flex-col items-center justify-center w-full h-16 border-2 border-dashed border-slate-200 rounded-xl cursor-pointer hover:border-[#0f2240] hover:bg-slate-50 transition-all">
                    <div className="flex items-center gap-2 text-slate-400">
                      <Upload className="h-4 w-4" />
                      <span className="text-xs font-bold">Избери файл</span>
                    </div>
                    <input ref={fileInputRef} type="file" className="hidden"
                      accept=".pdf,.doc,.docx" onChange={handleFileChange} />
                  </label>
                )}
              </div>

              <div className="flex gap-3 justify-end border-t pt-3.5">
                <button type="button" onClick={() => setIsOpeningForm(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold">
                  Отказ
                </button>
                <button type="submit" disabled={uploading}
                  className="px-4 py-2 bg-[#0f2240] hover:bg-slate-800 text-white rounded-xl text-xs font-bold flex items-center gap-2 disabled:opacity-60">
                  {uploading && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                  {uploading ? 'Записване...' : 'Впиши в регистъра'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
