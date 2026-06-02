'use client'

import { useState } from 'react'
import { FileSpreadsheet, AlertTriangle, Users, School, BarChart3, FileX, FileText, Printer, Check, ChevronDown, ChevronUp, Mail, Download } from 'lucide-react'
import { generateSchoolLetter } from '@/lib/docx-generator'
import {
  generateSchoolReportExcel,
  generateSpecialistReportExcel,
  generateWorkloadReportExcel,
  generateNoTeamReportExcel,
  generateDelayedDocsExcel,
  generateAnnualReportExcel,
} from '@/lib/excel-generator'

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
  const [expandedSchool, setExpandedSchool] = useState<string | null>(null)
  const [selectedSpecialist, setSelectedSpecialist] = useState('')
  const [generatingAll, setGeneratingAll] = useState(false)

  const tabs = [
    { id: 'delayed' as ReportTab, label: 'Забавени документи', icon: <AlertTriangle size={15} />, color: 'text-red-500' },
    { id: 'school' as ReportTab, label: 'По училище', icon: <School size={15} />, color: 'text-blue-500' },
    { id: 'specialist' as ReportTab, label: 'По специалист', icon: <Users size={15} />, color: 'text-purple-500' },
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

  // Училища с деца
  const schoolsWithStudents = schools.filter(s => allRows.some(r => r.sendingSchoolId === s.id))

  function getSchoolRows(schoolId: string) {
    return allRows.filter(r => r.sendingSchoolId === schoolId)
  }

  function getSchoolStats(schoolId: string) {
    const rows = getSchoolRows(schoolId)
    const completed = rows.reduce((sum, r) => sum + r.docsCompleted, 0)
    const total = rows.reduce((sum, r) => sum + r.docsTotal, 0)
    const withTeam = rows.filter(r => !r.missingPsychologist || !r.missingSpeechTherapist).length
    return { count: rows.length, completed, total, withTeam, pct: total > 0 ? Math.round(completed / total * 100) : 0 }
  }

  async function generateAllLetters() {
    setGeneratingAll(true)
    for (const school of schoolsWithStudents) {
      const rows = getSchoolRows(school.id)
      await generateSchoolLetter(school.name, school.city, rows, yearName)
      await new Promise(r => setTimeout(r, 500))
    }
    setGeneratingAll(false)
  }

  function handlePrint() { window.print() }

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
      <div className="hidden print:block mb-6">
        <h2 className="text-xl font-bold text-slate-800">{TAB_TITLES[activeTab]}</h2>
        <p className="text-sm text-slate-500">{yearName} · ЦСОП Варна</p>
      </div>

      {/* Табове */}
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

      {/* ── ЗАБАВЕНИ ДОКУМЕНТИ ── */}
      {activeTab === 'delayed' && (
        <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
          <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
            <div>
              <h2 className="text-lg font-semibold text-slate-800">Мониторинг на забавени документи</h2>
              <p className="text-sm text-slate-500 mt-0.5 print:hidden">Документи с изтекъл или наближаващ краен срок (до 3 дни)</p>
            </div>
            {delayedRows.length > 0 && <ExportButtons onExcel={() => generateDelayedDocsExcel(delayedRows)} />}
          </div>
          {delayedRows.length === 0 ? (
            <div className="relative overflow-hidden bg-gradient-to-b from-emerald-50/50 to-white border border-emerald-100 rounded-2xl p-12 text-center shadow-sm">
              <div className="absolute top-0 left-1/2 -translate-x-1/2 w-32 h-32 bg-emerald-400/10 blur-3xl rounded-full"></div>
              <div className="relative w-16 h-16 bg-white border border-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4 shadow-sm text-emerald-500">
                <Check size={28} strokeWidth={2.5} />
              </div>
              <h3 className="text-lg font-semibold text-slate-800 mb-1">Всичко е под контрол</h3>
              <p className="text-sm text-slate-500">Няма нито един забавен документ.</p>
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
                      <tr key={idx} className={`border-b border-slate-50 hover:bg-slate-50/80 transition-colors duration-200 ${row.isOverdue ? 'bg-red-50/30' : ''}`}>
                        <td className="px-5 py-4 font-medium text-slate-700">{row.docType}</td>
                        <td className="px-5 py-4 font-medium text-slate-800 whitespace-nowrap">{row.studentName}</td>
                        <td className="px-5 py-4 text-slate-500">{row.className}</td>
                        <td className="px-5 py-4 text-slate-500">{row.specialist}</td>
                        <td className="px-5 py-4"><StatusBadge status={row.status} /></td>
                        <td className="px-5 py-4 text-center">
                          <span className={`inline-flex items-center text-[11px] font-bold px-2.5 py-1 rounded-md ${row.isOverdue ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'}`}>
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

      {/* ── ПО УЧИЛИЩЕ — КАРТИ ── */}
      {activeTab === 'school' && (
        <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
          {/* Хедър с бутон за всички писма */}
          <div className="flex flex-wrap items-center justify-between gap-4 mb-8">
            <div>
              <h2 className="text-lg font-semibold text-slate-800">По изпращащо училище</h2>
              <p className="text-sm text-slate-500 mt-0.5">{schoolsWithStudents.length} училища · {allRows.length} ученика общо</p>
            </div>
            <button
              onClick={generateAllLetters}
              disabled={generatingAll}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-white shadow-lg hover:shadow-xl transition-all disabled:opacity-60"
              style={{ background: 'linear-gradient(135deg, #0f2240 0%, #1a3a5c 100%)' }}>
              <Mail size={16} />
              {generatingAll ? 'Генериране...' : 'Писма за всички училища'}
            </button>
          </div>

          {/* Карти за училищата */}
          <div className="space-y-3">
            {schoolsWithStudents.map(school => {
              const stats = getSchoolStats(school.id)
              const rows = getSchoolRows(school.id)
              const isExpanded = expandedSchool === school.id
              const pctColor = stats.pct >= 80 ? 'bg-emerald-500' : stats.pct >= 40 ? 'bg-amber-400' : 'bg-red-400'
              const pctBg = stats.pct >= 80 ? 'text-emerald-700 bg-emerald-50' : stats.pct >= 40 ? 'text-amber-700 bg-amber-50' : 'text-red-700 bg-red-50'

              return (
                <div key={school.id}
                  className="bg-white rounded-2xl border border-slate-200/80 shadow-sm hover:shadow-md transition-all duration-200 overflow-hidden">

                  {/* Карта хедър */}
                  <div
                    className="flex items-center gap-4 px-5 py-4 cursor-pointer select-none"
                    onClick={() => setExpandedSchool(isExpanded ? null : school.id)}>

                    {/* Иконка */}
                    <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center flex-shrink-0">
                      <School size={18} className="text-blue-600" />
                    </div>

                    {/* Инфо */}
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-slate-800 truncate">{school.name}</div>
                      <div className="text-xs text-slate-400 mt-0.5">{school.city} · {stats.count} ученика</div>

                      {/* Прогрес бар */}
                      <div className="flex items-center gap-2 mt-2">
                        <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden max-w-[200px]">
                          <div className={`h-full rounded-full transition-all duration-700 ${pctColor}`}
                            style={{ width: `${stats.pct}%` }} />
                        </div>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${pctBg}`}>
                          {stats.pct}%
                        </span>
                      </div>
                    </div>

                    {/* Бутони */}
                    <div className="flex items-center gap-2 flex-shrink-0" onClick={e => e.stopPropagation()}>
                      <button
                        onClick={() => generateSchoolLetter(school.name, school.city, rows, yearName)}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-white shadow-sm hover:shadow-md transition-all"
                        style={{ backgroundColor: '#0f2240' }}>
                        <Mail size={12} />
                        Писмо
                      </button>
                      <button
                        onClick={() => generateSchoolReportExcel(school.name, rows)}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border border-slate-200 hover:bg-slate-50 transition-colors">
                        <FileSpreadsheet size={12} className="text-emerald-600" />
                        Excel
                      </button>
                      <div className={`ml-1 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`}>
                        <ChevronDown size={18} className="text-slate-400" />
                      </div>
                    </div>
                  </div>

                  {/* Разгъната таблица */}
                  {isExpanded && (
                    <div className="border-t border-slate-100 animate-in fade-in slide-in-from-top-1 duration-200">
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead className="bg-slate-50/80">
                            <tr>
                              <th className="text-left px-5 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Три имена</th>
                              <th className="text-left px-4 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Пар. ЦСОП</th>
                              <th className="text-left px-4 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Клас</th>
                              <th className="text-left px-4 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Психолог</th>
                              <th className="text-left px-4 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Логопед</th>
                              <th className="text-left px-4 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Рехабилитатор</th>
                              <th className="text-left px-4 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Класен р-л</th>
                              <th className="text-center px-4 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Документи</th>
                            </tr>
                          </thead>
                          <tbody>
                            {rows.map((row, idx) => (
                              <tr key={row.studentId} className={`border-t border-slate-50 hover:bg-blue-50/30 transition-colors ${idx % 2 === 1 ? 'bg-slate-50/40' : ''}`}>
                                <td className="px-5 py-3 font-medium text-slate-800">{row.name}</td>
                                <td className="px-4 py-3 text-slate-500 text-xs">{row.className}</td>
                                <td className="px-4 py-3 text-slate-500 text-xs">{row.externalClass || '—'}</td>
                                <td className="px-4 py-3 text-slate-500 text-xs">{row.psychologist || '—'}</td>
                                <td className="px-4 py-3 text-slate-500 text-xs">{row.speechTherapist || '—'}</td>
                                <td className="px-4 py-3 text-slate-500 text-xs">{row.rehabilitator || '—'}</td>
                                <td className="px-4 py-3 text-slate-500 text-xs">{row.classTeacher || '—'}</td>
                                <td className="px-4 py-3 text-center">
                                  <span className={`inline-flex items-center text-[10px] font-bold px-2 py-0.5 rounded-md ${
                                    row.docsCompleted === row.docsTotal ? 'bg-green-50 text-green-700' :
                                    row.docsCompleted > 0 ? 'bg-amber-50 text-amber-700' :
                                    'bg-slate-50 text-slate-500'
                                  }`}>
                                    {row.docsCompleted}/{row.docsTotal}
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
              )
            })}

            {schoolsWithStudents.length === 0 && (
              <div className="bg-slate-50/50 border border-slate-100 rounded-2xl p-16 text-center">
                <School size={40} strokeWidth={1.5} className="mx-auto mb-3 text-slate-300" />
                <p className="text-sm font-medium text-slate-500">Няма ученици с посочено изпращащо училище</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── ПО СПЕЦИАЛИСТ ── */}
      {activeTab === 'specialist' && (
        <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
          <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
            <select className="input w-80 shadow-sm print:hidden" value={selectedSpecialist} onChange={e => setSelectedSpecialist(e.target.value)}>
              <option value="">— Избери специалист —</option>
              {specialists.map(s => <option key={s.id} value={s.id}>{s.name} ({s.role})</option>)}
            </select>
            {specialistRows.length > 0 && <ExportButtons onExcel={() => generateSpecialistReportExcel(specialists.find(s => s.id === selectedSpecialist)?.name || '', specialistRows)} />}
          </div>
          {!selectedSpecialist ? (
            <div className="bg-slate-50/50 border border-slate-100 rounded-2xl p-12 text-center print:hidden">
              <Users size={40} strokeWidth={1.5} className="mx-auto mb-3 text-slate-300" />
              <p className="text-sm font-medium text-slate-500">Избери специалист от менюто</p>
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
                      <tr key={row.studentId} className="border-b border-slate-50 hover:bg-slate-50/80 transition-colors">
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

      {/* ── НАТОВАРЕНОСТ ── */}
      {activeTab === 'workload' && (
        <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-semibold text-slate-800">Натовареност на специалистите</h2>
            <ExportButtons onExcel={() => generateWorkloadReportExcel(workloadRows)} />
          </div>
          <div className="bg-white rounded-2xl border border-slate-200/80 overflow-hidden shadow-sm">
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
                    <tr key={row.id} className="border-b border-slate-50 hover:bg-slate-50/80 transition-colors">
                      <td className="px-5 py-4 font-medium text-slate-800">{row.name}</td>
                      <td className="px-5 py-4 text-slate-500 text-xs">{row.role}</td>
                      <td className="px-5 py-4 text-center">
                        <span className={`inline-flex items-center justify-center min-w-[24px] px-2 py-1 text-xs font-bold rounded-md ${row.studentCount === 0 ? 'bg-slate-50 text-slate-400' : row.studentCount <= 20 ? 'bg-emerald-50 text-emerald-700' : row.studentCount <= 30 ? 'bg-amber-50 text-amber-700' : 'bg-red-50 text-red-700'}`}>
                          {row.studentCount}
                        </span>
                      </td>
                      <td className="px-5 py-4 text-center text-slate-500 font-medium">{row.completedDocs} / {row.totalDocs}</td>
                      <td className="px-5 py-4 print:hidden">
                        <div className="flex items-center gap-3">
                          <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                            <div className={`h-full rounded-full ${pct >= 80 ? 'bg-emerald-500' : pct >= 40 ? 'bg-amber-400' : 'bg-red-400'}`} style={{ width: `${pct}%` }} />
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
      )}

      {/* ── БЕЗ ЕКИП ── */}
      {activeTab === 'noteam' && (
        <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-lg font-semibold text-slate-800">Деца без ЕПЛР екип</h2>
              <p className="text-sm text-slate-500 mt-0.5 print:hidden">Деца без назначен психолог И логопед</p>
            </div>
            {noTeamRows.length > 0 && <ExportButtons onExcel={() => generateNoTeamReportExcel(noTeamRows)} />}
          </div>
          {noTeamRows.length === 0 ? (
            <div className="relative overflow-hidden bg-gradient-to-b from-emerald-50/50 to-white border border-emerald-100 rounded-2xl p-12 text-center shadow-sm">
              <div className="w-16 h-16 bg-white border border-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4 shadow-sm text-emerald-500">
                <Check size={28} strokeWidth={2.5} />
              </div>
              <h3 className="text-lg font-semibold text-slate-800 mb-1">Разпределението е завършено</h3>
              <p className="text-sm text-slate-500">Всички ученици имат ЕПЛР екип.</p>
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-slate-200/80 overflow-hidden shadow-sm">
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
                    <tr key={row.studentId} className="border-b border-slate-50 hover:bg-slate-50/80 transition-colors">
                      <td className="px-5 py-4 font-medium text-slate-800">{row.name}</td>
                      <td className="px-5 py-4 text-slate-500">{row.className}</td>
                      <td className="px-5 py-4 text-center">
                        <span className={`inline-flex items-center text-[11px] font-bold px-2.5 py-1 rounded-md ${row.missingPsychologist ? 'bg-red-50 text-red-600' : 'bg-emerald-50 text-emerald-600'}`}>
                          {row.missingPsychologist ? 'Липсва' : '✓'}
                        </span>
                      </td>
                      <td className="px-5 py-4 text-center">
                        <span className={`inline-flex items-center text-[11px] font-bold px-2.5 py-1 rounded-md ${row.missingSpeechTherapist ? 'bg-red-50 text-red-600' : 'bg-emerald-50 text-emerald-600'}`}>
                          {row.missingSpeechTherapist ? 'Липсва' : '✓'}
                        </span>
                      </td>
                      <td className="px-5 py-4 text-center">
                        <span className={`inline-flex items-center text-[11px] font-bold px-2.5 py-1 rounded-md ${row.missingRehabilitator ? 'bg-amber-50 text-amber-600' : 'bg-emerald-50 text-emerald-600'}`}>
                          {row.missingRehabilitator ? 'Неприл.' : '✓'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ── ГОДИШНА СПРАВКА ── */}
      {activeTab === 'annual' && (
        <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-lg font-semibold text-slate-800">Обобщена годишна справка</h2>
              <p className="text-sm text-slate-500 mt-0.5 print:hidden">Всички ученици — {yearName}</p>
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
                    <tr key={row.studentId} className="border-b border-slate-50 hover:bg-slate-50/80 transition-colors">
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
