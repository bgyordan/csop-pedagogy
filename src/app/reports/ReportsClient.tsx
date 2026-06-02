'use client'

import { useState } from 'react'
import { 
  FileSpreadsheet, 
  AlertTriangle, 
  Users, 
  School, 
  BarChart3, 
  FileX, 
  FileText, 
  Printer, 
  Check, 
  ChevronDown, 
  ChevronUp, 
  Download 
} from 'lucide-react'
import { generateSchoolLetter } from '@/lib/docx-generator'

type ReportTab = 'delayed' | 'school' | 'specialist' | 'workload' | 'noteam' | 'annual'

const TAB_TITLES: Record<ReportTab, string> = {
  delayed: 'Мониторинг на забавени документи',
  school: 'Справка по изпращащо училище',
  specialist: 'Справка по специалист',
  workload: 'Натовареност на специалистите',
  noteam: 'Деца без ЕПЛР екип',
  annual: 'Обобщена годишна справка',
}

interface Props {
  allRows: any[]
  workloadRows: any[]
  delayedRows: any[]
  schools: { id: string; name: string; city: string }[]
  specialists: { id: string; name: string; role: string }[]
  yearName: string
}

export default function ReportsClient({ allRows, workloadRows, delayedRows, schools, specialists, yearName }: Props) {
  const [activeTab, setActiveTab] = useState<ReportTab>('delayed')
  const [selectedSpecialist, setSelectedSpecialist] = useState('')
  const [expandedSchoolId, setExpandedSchoolId] = useState<string | null>(null)

  const tabs = [
    { id: 'delayed' as ReportTab, label: 'Забавени документи', icon: <AlertTriangle size={15} />, color: 'text-red-500' },
    { id: 'school' as ReportTab, label: 'По училище', icon: <School size={15} />, color: 'text-blue-500' },
    { id: 'specialist' as ReportTab, label: 'По specialist', icon: <Users size={15} />, color: 'text-purple-500' },
    { id: 'workload' as ReportTab, label: 'Натовареност', icon: <BarChart3 size={15} />, color: 'text-emerald-500' },
    { id: 'noteam' as ReportTab, label: 'Без екип', icon: <FileX size={15} />, color: 'text-orange-500' },
    { id: 'annual' as ReportTab, label: 'Годишна', icon: <FileText size={15} />, color: 'text-slate-500' },
  ]

  const specialistRows = selectedSpecialist
    ? allRows.filter(r =>
        r.psychologistId === selectedSpecialist ||
        r.speechTherapistId === selectedSpecialist ||
        r.rehabilitatorId === selectedSpecialist
      )
    : []
  const noTeamRows = allRows.filter(r => r.missingPsychologist && r.missingSpeechTherapist)

  function handlePrint() {
    window.print()
  }

  // Масово генериране на писма за всички училища, които имат записани деца
  async function handleMassGenerateLetters() {
    const schoolsWithStudents = schools.filter(school => 
      allRows.some(r => r.sendingSchoolId === school.id)
    )

    if (schoolsWithStudents.length === 0) {
      alert('Няма записани деца в нито едно училище за текущата година.')
      return
    }

    if (confirm(`Сигурни ли сте, че искате да генерирате Word писма за всички училища (${schoolsWithStudents.length} бр.) наведнъж?`)) {
      for (const school of schoolsWithStudents) {
        const rows = allRows.filter(r => r.sendingSchoolId === school.id)
        await generateSchoolLetter(school.name, school.city, rows, yearName)
      }
    }
  }

  function StatusBadge({ status }: { status: string }) {
    if (status === 'Завършен' || status === '✓') {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium bg-green-50 text-green-700 border border-green-100/50">
          <span className="w-1.5 h-1.5 rounded-full bg-green-500 shadow-[0_0_5px_rgba(34,197,94,0.4)]"></span>
          Завършен
        </span>
      )
    }
    if (status === 'В процес' || status === '…') {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium bg-amber-50 text-amber-700 border border-amber-100/50">
          <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse"></span>
          В процес
        </span>
      )
    }
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium bg-slate-50 text-slate-400 border border-slate-100/50">
        <span className="w-1 h-1 rounded-full bg-slate-300"></span>
        Непопълнен
      </span>
    )
  }

  function ExportButtons({ onExcel }: { onExcel?: () => void }) {
    return (
      <div className="flex items-center gap-2 print:hidden">
        {onExcel && (
          <button onClick={onExcel}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-medium hover:bg-slate-50 transition-colors shadow-sm">
            <FileSpreadsheet size={13} className="text-emerald-600" />
            Excel
          </button>
        )}
        <button onClick={handlePrint}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-medium hover:bg-slate-50 transition-colors shadow-sm">
          <Printer size={13} className="text-slate-600" />
          PDF
        </button>
      </div>
    )
  }

  return (
    <div className="max-w-[1400px] mx-auto">
      {/* Заглавие за печат */}
      <div className="hidden print:block mb-6">
        <h2 className="text-xl font-bold text-slate-800">{TAB_TITLES[activeTab]}</h2>
        <p className="text-sm text-slate-500">{yearName} · ЦСОП Варна</p>
      </div>

      {/* Меню с табове */}
      <div className="inline-flex p-1 bg-slate-100/80 backdrop-blur-sm rounded-xl mb-8 print:hidden overflow-x-auto max-w-full border border-slate-200/50 shadow-inner">
        {tabs.map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-300 ease-out whitespace-nowrap ${
              activeTab === tab.id 
                ? 'bg-white text-slate-800 shadow-sm border border-slate-200/50' 
                : 'text-slate-500 hover:text-slate-700 hover:bg-slate-200/50 border border-transparent'
            }`}>
            <span className={activeTab === tab.id ? tab.color : 'opacity-60'}>{tab.icon}</span>
            {tab.label}
            {tab.id === 'delayed' && delayedRows.length > 0 && (
              <span className="ml-1.5 flex items-center justify-center min-w-[20px] h-5 px-1.5 bg-red-100 text-red-600 font-bold text-[10px] rounded-full">{delayedRows.length}</span>
            )}
            {tab.id === 'noteam' && noTeamRows.length > 0 && (
              <span className="ml-1.5 flex items-center justify-center min-w-[20px] h-5 px-1.5 bg-orange-100 text-orange-600 font-bold text-[10px] rounded-full">{noTeamRows.length}</span>
            )}
          </button>
        ))}
      </div>

      {/* ── ТАБ: ЗАБАВЕНИ ДОКУМЕНТИ ── */}
      {activeTab === 'delayed' && (
        <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
          <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
            <div>
              <h2 className="text-lg font-semibold text-slate-800">Мониторинг на забавени документи</h2>
              <p className="text-sm text-slate-500 mt-0.5 print:hidden">Документи с изтекъл или наближаващ краен срок (до 3 дни)</p>
            </div>
            {delayedRows.length > 0 && <ExportButtons onExcel={() => {}} />}
          </div>
          {delayedRows.length === 0 ? (
            <div className="relative overflow-hidden bg-gradient-to-b from-emerald-50/50 to-white border border-emerald-100 rounded-2xl p-12 text-center shadow-sm">
              <div className="absolute top-0 left-1/2 -translate-x-1/2 w-32 h-32 bg-emerald-400/10 blur-3xl rounded-full"></div>
              <div className="relative w-16 h-16 bg-white border border-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4 shadow-sm text-emerald-500">
                <Check size={28} strokeWidth={2.5} />
              </div>
              <h3 className="text-lg font-semibold text-slate-800 mb-1">Всичко е под контрол</h3>
              <p className="text-sm text-slate-500">Няма нито един забавен документ. Екипът работи перфектно в срок.</p>
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-slate-200/80 overflow-hidden shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50/50 border-b border-slate-100">
                    <tr>
                      <th className="text-left px-5 py-4 text-[11px] font-bold text-slate-400 uppercase tracking-widest">Документ</th>
                      <th className="text-left px-5 py-4 text-[11px] font-bold text-slate-400 uppercase tracking-widest">Ученик</th>
                      <th className="text-left px-5 py-4 text-[11px] font-bold text-slate-400 uppercase tracking-widest">Паралелка</th>
                      <th className="text-left px-5 py-4 text-[11px] font-bold text-slate-400 uppercase tracking-widest">Специалист</th>
                      <th className="text-left px-5 py-4 text-[11px] font-bold text-slate-400 uppercase tracking-widest">Статус</th>
                      <th className="text-center px-5 py-4 text-[11px] font-bold text-slate-400 uppercase tracking-widest">Срок</th>
                    </tr>
                  </thead>
                  <tbody>
                    {delayedRows.map((row, idx) => (
                      <tr key={idx} className={`border-b border-slate-50 hover:bg-slate-50/80 transition-colors duration-200 ${row.isOverdue ? 'bg-red-50/30 hover:bg-red-50/50' : ''}`}>
                        <td className="px-5 py-4 font-medium text-slate-700">{row.docType}</td>
                        <td className="px-5 py-4 font-medium text-slate-800 whitespace-nowrap">{row.studentName}</td>
                        <td className="px-5 py-4 text-slate-500">{row.className}</td>
                        <td className="px-5 py-4 text-slate-500">{row.specialist}</td>
                        <td className="px-5 py-4"><StatusBadge status={row.status} /></td>
                        <td className="px-5 py-4 text-center">
                          <span className={`inline-flex items-center text-[11px] font-bold px-2.5 py-1 rounded-md ${row.isOverdue ? 'bg-red-100 text-red-700 border border-red-200/50' : 'bg-amber-100 text-amber-700 border border-amber-200/50'}`}>
                            {row.isOverdue ? `+${row.daysOverdue} дни` : 'Скоро'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── ТАБ: ПО УЧИЛИЩЕ (КАРТИ) ── */}
      {activeTab === 'school' && (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
          <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200/60 flex flex-col sm:flex-row items-center justify-between gap-4 shadow-inner print:hidden">
            <div>
              <h3 className="text-sm font-bold text-slate-700 uppercase tracking-wide">Масово генериране на документи</h3>
              <p className="text-xs text-slate-500 mt-0.5">Едновременно изтегляне на официалните Word писма за всички изпращащи училища.</p>
            </div>
            <button 
              onClick={handleMassGenerateLetters}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-[#0f2240] text-white text-xs font-bold uppercase tracking-widest hover:bg-[#19325c] shadow-md transition-all active:scale-98"
            >
              <Download size={14} />
              Генерирай писма за всички
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {schools.map(school => {
              const currentSchoolRows = allRows.filter(r => r.sendingSchoolId === school.id)
              const count = currentSchoolRows.length
              const isExpanded = expandedSchoolId === school.id

              return (
                <div 
                  key={school.id} 
                  className={`bg-white rounded-2xl border transition-all duration-200 overflow-hidden shadow-sm ${
                    isExpanded ? 'border-blue-500 ring-4 ring-blue-500/5 md:col-span-2' : 'border-slate-200/80 hover:border-slate-300 hover:shadow-md'
                  }`}
                >
                  <div 
                    onClick={() => setExpandedSchoolId(isExpanded ? null : school.id)}
                    className="p-5 flex items-center justify-between cursor-pointer select-none"
                  >
                    <div className="flex items-center gap-4 min-w-0">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 border font-bold transition-colors ${
                        isExpanded ? 'bg-blue-50 text-blue-600 border-blue-200' : 'bg-slate-50 text-slate-500 border-slate-200/60'
                      }`}>
                        <School size={18} />
                      </div>
                      <div className="min-w-0">
                        <h4 className="font-bold text-slate-800 text-sm md:text-base truncate tracking-tight">{school.name}</h4>
                        <p className="text-xs text-slate-400 font-medium mt-0.5">{school.city}</p>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-3 flex-shrink-0">
                      <span className={`px-2.5 py-1 rounded-xl text-xs font-bold transition-colors border ${
                        count === 0 
                          ? 'bg-slate-50 text-slate-400 border-slate-200/40' 
                          : 'bg-blue-50/60 text-blue-700 border-blue-100'
                      }`}>
                        {count} деца
                      </span>
                      <div className="text-slate-400 print:hidden">
                        {isExpanded ? <ChevronUp size={18} className="text-blue-500" /> : <ChevronDown size={18} />}
                      </div>
                    </div>
                  </div>

                  {isExpanded && (
                    <div className="border-t border-slate-100 bg-slate-50/30">
                      <div className="p-4 bg-slate-50/80 border-b border-slate-100 flex flex-wrap items-center justify-between gap-3 print:hidden">
                        <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Документи за това училище:</span>
                        <div className="flex flex-wrap items-center gap-2">
                          <button 
                            onClick={() => generateSchoolReportExcel(school.name, currentSchoolRows)} 
                            className="px-3 py-2 rounded-xl border border-slate-200 bg-white text-xs font-bold text-slate-600 hover:bg-slate-100 shadow-sm transition-colors flex items-center gap-1.5"
                          >
                            <FileSpreadsheet size={13} className="text-emerald-600" />
                            Excel Справка
                          </button>
                          <button 
                            onClick={handlePrint} 
                            className="px-3 py-2 rounded-xl border border-rose-200 bg-rose-50/40 text-xs font-bold text-rose-700 hover:bg-rose-50 shadow-sm transition-colors flex items-center gap-1.5"
                          >
                            <Printer size={13} className="text-rose-600" />
                            PDF Сумарен документ
                          </button>
                          <button
                            onClick={() => generateSchoolLetter(school.name, school.city, currentSchoolRows, yearName)}
                            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#0f2240] text-white text-xs font-bold uppercase tracking-wider hover:bg-[#19325c] shadow-sm transition-colors"
                          >
                            <Download size={13} />
                            Word Писмо
                          </button>
                        </div>
                      </div>

                      {count > 0 ? (
                        <div className="overflow-x-auto">
                          <table className="w-full text-sm bg-white">
                            <thead className="bg-slate-50/40 border-b border-slate-100">
                              <tr>
                                <th className="text-left px-6 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Три имена</th>
                                <th className="text-left px-6 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Пар.</th>
                                <th className="text-left px-6 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Психолог</th>
                                <th className="text-left px-6 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Логопед</th>
                                <th className="text-left px-6 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Рехабилитатор</th>
                                <th className="text-center px-6 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Документи</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                              {currentSchoolRows.map((row) => (
                                <tr key={row.studentId} className="hover:bg-slate-50/30 transition-colors">
                                  <td className="px-6 py-3.5 font-semibold text-slate-800">{row.name}</td>
                                  <td className="px-6 py-3.5 text-slate-500 font-medium">{row.className}</td>
                                  <td className="px-6 py-3.5 text-slate-500">{row.psychologist || '—'}</td>
                                  <td className="px-6 py-3.5 text-slate-500">{row.speechTherapist || '—'}</td>
                                  <td className="px-6 py-3.5 text-slate-500">{row.rehabilitator || '—'}</td>
                                  <td className="px-6 py-3.5 text-center">
                                    <span className={`inline-flex items-center text-[11px] font-bold px-2.5 py-1 rounded-md ${row.docsCompleted === row.docsTotal ? 'bg-green-50 text-green-700 border border-green-100/50' : row.docsCompleted > 0 ? 'bg-amber-50 text-amber-700 border border-amber-100/50' : 'bg-slate-50 text-slate-500 border border-slate-100/50'}`}>
                                      {row.docsCompleted} / {row.docsTotal}
                                    </span>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      ) : (
                        <div className="p-8 text-center text-sm text-slate-400 bg-white font-medium">
                          Няма записани ученици от това училище.
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* ── ТАБ: ПО СПЕЦИАЛИСТ ── */}
      {activeTab === 'specialist' && (
        <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
          <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
            <select className="input w-80 shadow-sm border-slate-200 focus:border-purple-500 focus:ring-purple-500/20 print:hidden" value={selectedSpecialist} onChange={e => setSelectedSpecialist(e.target.value)}>
              <option value="">— Избери специалист —</option>
              {specialists.map(s => <option key={s.id} value={s.id}>{s.name} ({s.role})</option>)}
            </select>
            {specialistRows.length > 0 && <ExportButtons onExcel={() => generateSpecialistReportExcel(specialists.find(s => s.id === selectedSpecialist)?.name || '', specialistRows)} />}
          </div>
          {!selectedSpecialist ? (
            <div className="relative overflow-hidden bg-slate-50/50 border border-slate-100 rounded-2xl p-12 text-center print:hidden">
              <Users size={40} strokeWidth={1.5} className="mx-auto mb-3 text-slate-300" />
              <p className="text-sm font-medium text-slate-500">Избери специалист от менюто, за да видиш справката</p>
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-slate-200/80 overflow-hidden shadow-sm">
              <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
                <h3 className="font-semibold text-slate-800 text-sm">{specialists.find(s => s.id === selectedSpecialist)?.name}</h3>
                <span className="text-xs font-medium text-purple-600 bg-purple-50 px-2.5 py-1 rounded-md">{specialistRows.length} ученика</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50/50 border-b border-slate-100">
                    <tr>
                      <th className="text-left px-5 py-4 text-[11px] font-bold text-slate-400 uppercase tracking-widest">Три имена</th>
                      <th className="text-left px-5 py-4 text-[11px] font-bold text-slate-400 uppercase tracking-widest">Пар.</th>
                      {['П1','П2','П3','ИУП','ИУПр','ПДП','ПР'].map(h => (
                        <th key={h} className="text-center px-3 py-4 text-[11px] font-bold text-slate-400 uppercase tracking-widest">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {specialistRows.map((row) => (
                      <tr key={row.studentId} className="border-b border-slate-50 hover:bg-slate-50/80 transition-colors duration-200">
                        <td className="px-5 py-4 font-medium text-slate-800 whitespace-nowrap">{row.name}</td>
                        <td className="px-5 py-4 text-slate-500">{row.className}</td>
                        {[row.p1, row.p2, row.p3, row.iup, row.iuProgram, row.supportPlan, row.parentProgram].map((s, i) => (
                          <td key={i} className="text-center px-3 py-4"><StatusBadge status={s} /></td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── ТАБ: НАТОВАРЕНОСТ ── */}
      {activeTab === 'workload' && (
        <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-semibold text-slate-800">Натовареност на специалистите</h2>
            <ExportButtons onExcel={() => generateWorkloadReportExcel(workloadRows)} />
          </div>
          <div className="bg-white rounded-2xl border border-slate-200/80 overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50/50 border-b border-slate-100">
                  <tr>
                    <th className="text-left px-5 py-4 text-[11px] font-bold text-slate-400 uppercase tracking-widest">Специалист</th>
                    <th className="text-left px-5 py-4 text-[11px] font-bold text-slate-400 uppercase tracking-widest">Роля</th>
                    <th className="text-center px-5 py-4 text-[11px] font-bold text-slate-400 uppercase tracking-widest">Ученици</th>
                    <th className="text-center px-5 py-4 text-[11px] font-bold text-slate-400 uppercase tracking-widest">Документи</th>
                    <th className="px-5 py-4 text-[11px] font-bold text-slate-400 uppercase tracking-widest print:hidden w-1/4">Прогрес</th>
                    <th className="px-5 py-4 text-[11px] font-bold text-slate-400 uppercase tracking-widest hidden print:table-cell">%</th>
                  </tr>
                </thead>
                <tbody>
                  {workloadRows.map((row) => {
                    const pct = row.totalDocs > 0 ? Math.round(row.completedDocs / row.totalDocs * 100) : 0
                    return (
                      <tr key={row.id} className="border-b border-slate-50 hover:bg-slate-50/80 transition-colors duration-200">
                        <td className="px-5 py-4 font-medium text-slate-800">{row.name}</td>
                        <td className="px-5 py-4 text-slate-500 text-xs">{row.role}</td>
                        <td className="px-5 py-4 text-center">
                          <span className={`inline-flex items-center justify-center min-w-[24px] px-2 py-1 text-xs font-bold rounded-md ${row.studentCount === 0 ? 'bg-slate-50 text-slate-400' : row.studentCount <= 20 ? 'bg-emerald-50 text-emerald-700' : row.studentCount <= 30 ? 'bg-amber-50 text-amber-700' : 'bg-red-50 text-red-700'}`}>
                            {row.studentCount}
                          </span>
                        </td>
                        <td className="px-5 py-4 text-center text-slate-500 font-medium">
                          {row.completedDocs} <span className="text-slate-300">/</span> {row.totalDocs}
                        </td>
                        <td className="px-5 py-4 print:hidden">
                          <div className="flex items-center gap-3">
                            <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                              <div className={`h-full rounded-full transition-all duration-1000 ease-out ${pct >= 80 ? 'bg-emerald-500' : pct >= 40 ? 'bg-amber-400' : 'bg-red-400'}`} style={{ width: `${pct}%` }} />
                            </div>
                            <span className="text-xs font-semibold text-slate-500 w-9 text-right">{pct}%</span>
                          </div>
                        </td>
                        <td className="px-5 py-4 text-xs font-medium text-slate-600 hidden print:table-cell">{pct}%</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ── ТАБ: БЕЗ ЕКИП ── */}
      {activeTab === 'noteam' && (
        <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-lg font-semibold text-slate-800">Деца без ЕПЛР екип</h2>
              <p className="text-sm text-slate-500 mt-0.5 print:hidden">Списък на деца, нуждаещи се от разпределение</p>
            </div>
            {noTeamRows.length > 0 && <ExportButtons onExcel={() => generateNoTeamReportExcel(noTeamRows)} />}
          </div>
          {noTeamRows.length === 0 ? (
            <div className="relative overflow-hidden bg-gradient-to-b from-emerald-50/50 to-white border border-emerald-100 rounded-2xl p-12 text-center shadow-sm">
              <div className="absolute top-0 left-1/2 -translate-x-1/2 w-32 h-32 bg-emerald-400/10 blur-3xl rounded-full"></div>
              <div className="relative w-16 h-16 bg-white border border-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4 shadow-sm text-emerald-500">
                <Check size={28} strokeWidth={2.5} />
              </div>
              <h3 className="text-lg font-semibold text-slate-800 mb-1">Разпределението е завършено</h3>
              <p className="text-sm text-slate-500">Всички ученици имат напълно назначен ЕПЛР екип.</p>
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-slate-200/80 overflow-hidden shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50/50 border-b border-slate-100">
                    <tr>
                      <th className="text-left px-5 py-4 text-[11px] font-bold text-slate-400 uppercase tracking-widest">Три имена</th>
                      <th className="text-left px-5 py-4 text-[11px] font-bold text-slate-400 uppercase tracking-widest">Паралелка</th>
                      <th className="text-center px-5 py-4 text-[11px] font-bold text-slate-400 uppercase tracking-widest">Психолог</th>
                      <th className="text-center px-5 py-4 text-[11px] font-bold text-slate-400 uppercase tracking-widest">Логопед</th>
                      <th className="text-center px-5 py-4 text-[11px] font-bold text-slate-400 uppercase tracking-widest">Рехабилитатор</th>
                    </tr>
                  </thead>
                  <tbody>
                    {noTeamRows.map((row) => (
                      <tr key={row.studentId} className="border-b border-slate-50 hover:bg-slate-50/80 transition-colors duration-200">
                        <td className="px-5 py-4 font-medium text-slate-800">{row.name}</td>
                        <td className="px-5 py-4 text-slate-500">{row.className}</td>
                        <td className="px-5 py-4 text-center">
                          <span className={`inline-flex items-center text-[11px] font-bold px-2.5 py-1 rounded-md ${row.missingPsychologist ? 'bg-red-50 text-red-600 border border-red-100/50' : 'bg-emerald-50 text-emerald-600 border border-emerald-100/50'}`}>
                            {row.missingPsychologist ? 'Липсва' : '✓ Назначен'}
                          </span>
                        </td>
                        <td className="px-5 py-4 text-center">
                          <span className={`inline-flex items-center text-[11px] font-bold px-2.5 py-1 rounded-md ${row.missingSpeechTherapist ? 'bg-red-50 text-red-600 border border-red-100/50' : 'bg-emerald-50 text-emerald-600 border border-emerald-100/50'}`}>
                            {row.missingSpeechTherapist ? 'Липсва' : '✓ Назначен'}
                          </span>
                        </td>
                        <td className="px-5 py-4 text-center">
                          <span className={`inline-flex items-center text-[11px] font-bold px-2.5 py-1 rounded-md ${row.missingRehabilitator ? 'bg-amber-50 text-amber-600 border border-amber-100/50' : 'bg-emerald-50 text-emerald-600 border border-emerald-100/50'}`}>
                            {row.missingRehabilitator ? 'Неприложимо' : '✓ Назначен'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── ТАБ: ГОДИШНА СПРАВКА ── */}
      {activeTab === 'annual' && (
        <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-lg font-semibold text-slate-800">Обобщена годишна справка</h2>
              <p className="text-sm text-slate-500 mt-0.5 print:hidden">Всички ученици с екипи и статус — {yearName}</p>
            </div>
            <ExportButtons onExcel={() => generateAnnualReportExcel(yearName, allRows)} />
          </div>
          <div className="bg-white rounded-2xl border border-slate-200/80 overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50/50 border-b border-slate-100">
                  <tr>
                    <th className="text-left px-5 py-4 text-[11px] font-bold text-slate-400 uppercase tracking-widest whitespace-nowrap">Три имена</th>
                    <th className="text-left px-3 py-4 text-[11px] font-bold text-slate-400 uppercase tracking-widest">Пар.</th>
                    <th className="text-left px-3 py-4 text-[11px] font-bold text-blue-500 uppercase tracking-widest">Психолог</th>
                    <th className="text-left px-3 py-4 text-[11px] font-bold text-purple-500 uppercase tracking-widest">Логопед</th>
                    {['П1','П2','П3','ИУП','ИУПр','ПДП','ПР'].map(h => (
                      <th key={h} className="text-center px-3 py-4 text-[11px] font-bold text-slate-400 uppercase tracking-widest">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {allRows.map((row) => (
                    <tr key={row.studentId} className="border-b border-slate-50 hover:bg-slate-50/80 transition-colors duration-200">
                      <td className="px-5 py-4 font-medium text-slate-800 whitespace-nowrap">{row.name}</td>
                      <td className="px-3 py-4 text-slate-500">{row.className}</td>
                      <td className="px-3 py-4 text-slate-500 text-xs whitespace-nowrap">{row.psychologist || '—'}</td>
                      <td className="px-3 py-4 text-slate-500 text-xs whitespace-nowrap">{row.speechTherapist || '—'}</td>
                      {[row.p1, row.p2, row.p3, row.iup, row.iuProgram, row.supportPlan, row.parentProgram].map((s, i) => (
                        <td key={i} className="text-center px-3 py-4"><StatusBadge status={s} /></td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
