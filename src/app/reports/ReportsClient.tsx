'use client'

import { useState } from 'react'
import { FileSpreadsheet, AlertTriangle, Users, School, BarChart3, FileX, FileText, Printer, Check } from 'lucide-react'
import { generateSchoolLetter } from '@/lib/docx-generator'
import { FileText as LetterIcon } from 'lucide-react'
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
  const [selectedSchool, setSelectedSchool] = useState('')
  const [selectedSpecialist, setSelectedSpecialist] = useState('')

  const tabs = [
    { id: 'delayed' as ReportTab, label: 'Забавени документи', icon: <AlertTriangle size={15} />, color: 'text-red-500' },
    { id: 'school' as ReportTab, label: 'По училище', icon: <School size={15} />, color: 'text-blue-500' },
    { id: 'specialist' as ReportTab, label: 'По специалист', icon: <Users size={15} />, color: 'text-purple-500' },
    { id: 'workload' as ReportTab, label: 'Натовареност', icon: <BarChart3 size={15} />, color: 'text-emerald-500' },
    { id: 'noteam' as ReportTab, label: 'Без екип', icon: <FileX size={15} />, color: 'text-orange-500' },
    { id: 'annual' as ReportTab, label: 'Годишна', icon: <FileText size={15} />, color: 'text-slate-500' },
  ]

  const schoolRows = selectedSchool ? allRows.filter(r => r.sendingSchoolId === selectedSchool) : []
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

  // 1. Модернизиран StatusBadge с точки (glow и pulse ефекти)
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

  // Бутони за Export
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

      {/* 2. Модерни табове (Segmented Control) */}
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
            // 3. Модерен Empty State
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

      {/* ── ПО УЧИЛИЩЕ ── */}
      {activeTab === 'school' && (
        <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
          <div className="flex flex-wrap items-center gap-4 mb-6 print:hidden">
            <select className="input w-80 shadow-sm border-slate-200 focus:border-blue-500 focus:ring-blue-500/20" value={selectedSchool} onChange={e => setSelectedSchool(e.target.value)}>
              <option value="">— Избери изпращащо училище —</option>
              {schools.map(s => <option key={s.id} value={s.id}>{s.name} — {s.city}</option>)}
            </select>
            {schoolRows.length > 0 && (
              <div className="flex items-center gap-2 ml-auto">
                <ExportButtons onExcel={() => generateSchoolReportExcel(schools.find(s => s.id === selectedSchool)?.name || '', schoolRows)} />
                <button
                  onClick={() => {
                    const school = schools.find(s => s.id === selectedSchool)
                    if (school) generateSchoolLetter(school.name, school.city, schoolRows, yearName)
                  }}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-medium text-white transition-all shadow-md hover:shadow-lg"
                  style={{ backgroundColor: '#0f2240' }}>
                  <LetterIcon size={14} />
                  Официално писмо (Word)
                </button>
              </div>
            )}
          </div>
          
          {!selectedSchool ? (
            <div className="relative overflow-hidden bg-slate-50/50 border border-slate-100 rounded-2xl p-12 text-center print:hidden">
              <School size={40} strokeWidth={1.5} className="mx-auto mb-3 text-slate-300" />
              <p className="text-sm font-medium text-slate-500">Избери училище от менюто, за да видиш справката</p>
            </div>
          ) : schoolRows.length === 0 ? (
            <div className="relative overflow-hidden bg-slate-50/50 border border-slate-100 rounded-2xl p-12 text-center">
              <p className="text-sm font-medium text-slate-500">Няма записани ученици от това училище</p>
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-slate-200/80 overflow-hidden shadow-sm">
              <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
                <h3 className="font-semibold text-slate-800 text-sm">{schools.find(s => s.id === selectedSchool)?.name}</h3>
                <span className="text-xs font-medium text-blue-600 bg-blue-50 px-2.5 py-1 rounded-md">{schoolRows.length} ученика</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50/50 border-b border-slate-100">
                    <tr>
                      <th className="text-left px-5 py-4 text-[11px] font-bold text-slate-400 uppercase tracking-widest">Три имена</th>
                      <th className="text-left px-5 py-4 text-[11px] font-bold text-slate-400 uppercase tracking-widest">Пар.</th>
                      <th className="text-left px-5 py-4 text-[11px] font-bold text-slate-400 uppercase tracking-widest">Психолог</th>
                      <th className="text-left px-5 py-4 text-[11px] font-bold text-slate-400 uppercase tracking-widest">Логопед</th>
                      <th className="text-left px-5 py-4 text-[11px] font-bold text-slate-400 uppercase tracking-widest">Рехабилитатор</th>
                      <th className="text-center px-5 py-4 text-[11px] font-bold text-slate-400 uppercase tracking-widest">Документи</th>
                    </tr>
                  </thead>
                  <tbody>
                    {schoolRows.map((row, idx) => (
                      <tr key={row.studentId} className="border-b border-slate-50 hover:bg-slate-50/80 transition-colors duration-200">
                        <td className="px-5 py-4 font-medium text-slate-800">{row.name}</td>
                        <td className="px-5 py-4 text-slate-500">{row.className}</td>
                        <td className="px-5 py-4 text-slate-500">{row.psychologist || '—'}</td>
                        <td className="px-5 py-4 text-slate-500">{row.speechTherapist || '—'}</td>
                        <td className="px-5 py-4 text-slate-500">{row.rehabilitator || '—'}</td>
                        <td className="px-5 py-4 text-center">
                          <span className={`inline-flex items-center text-[11px] font-bold px-2.5 py-1 rounded-md ${row.docsCompleted === row.docsTotal ? 'bg-green-50 text-green-700 border border-green-100/50' : row.docsCompleted > 0 ? 'bg-amber-50 text-amber-700 border border-amber-100/50' : 'bg-slate-50 text-slate-500 border border-slate-100/50'}`}>
                            {row.docsCompleted} / {row.docsTotal}
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

      {/* ── ПО СПЕЦИАЛИСТ ── */}
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
                    {specialistRows.map((row, idx) => (
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

      {/* ── НАТОВАРЕНОСТ ── */}
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
                  {workloadRows.map((row, idx) => {
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

      {/* ── БЕЗ ЕКИП ── */}
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
                    {noTeamRows.map((row, idx) => (
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

      {/* ── ГОДИШНА СПРАВКА ── */}
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
                  {allRows.map((row, idx) => (
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
