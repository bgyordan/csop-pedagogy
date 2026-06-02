'use client'

import { useState } from 'react'
import { FileSpreadsheet, AlertTriangle, Users, School, BarChart3, FileX, FileText, Printer } from 'lucide-react'
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

const STATUS_COLORS: Record<string, string> = {
  'Завършен': 'bg-green-100 text-green-700',
  'В процес': 'bg-amber-100 text-amber-700',
  'Непопълнен': 'bg-slate-100 text-slate-500',
}

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
    { id: 'delayed' as ReportTab, label: 'Забавени документи', icon: <AlertTriangle size={15} />, color: 'text-red-600' },
    { id: 'school' as ReportTab, label: 'По училище', icon: <School size={15} />, color: 'text-blue-600' },
    { id: 'specialist' as ReportTab, label: 'По специалист', icon: <Users size={15} />, color: 'text-purple-600' },
    { id: 'workload' as ReportTab, label: 'Натовареност', icon: <BarChart3 size={15} />, color: 'text-green-600' },
    { id: 'noteam' as ReportTab, label: 'Без екип', icon: <FileX size={15} />, color: 'text-orange-600' },
    { id: 'annual' as ReportTab, label: 'Годишна', icon: <FileText size={15} />, color: 'text-slate-600' },
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

  function StatusBadge({ status }: { status: string }) {
    return (
      <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${STATUS_COLORS[status] || 'bg-slate-100 text-slate-400'}`}>
        {status === 'Завършен' ? '✓' : status === 'В процес' ? '…' : '—'}
      </span>
    )
  }

  // Бутони за Export
  function ExportButtons({ onExcel }: { onExcel?: () => void }) {
    return (
      <div className="flex items-center gap-2 print:hidden">
        {onExcel && (
          <button onClick={onExcel}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-medium hover:bg-slate-50">
            <FileSpreadsheet size={13} className="text-green-600" />
            Excel
          </button>
        )}
        <button onClick={handlePrint}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-medium hover:bg-slate-50">
          <Printer size={13} className="text-slate-600" />
          PDF
        </button>
      </div>
    )
  }

  return (
    <div>
      {/* Заглавие за печат */}
      <div className="hidden print:block mb-6">
        <h2 className="text-xl font-bold text-slate-800">{TAB_TITLES[activeTab]}</h2>
        <p className="text-sm text-slate-500">{yearName} · ЦСОП Варна</p>
      </div>

      {/* Табове */}
      <div className="flex flex-wrap gap-2 mb-6 print:hidden">
        {tabs.map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors border ${
              activeTab === tab.id ? 'text-white border-transparent' : 'border-slate-200 text-slate-600 hover:bg-slate-50'
            }`}
            style={activeTab === tab.id ? { backgroundColor: '#0f2240' } : {}}>
            <span className={activeTab === tab.id ? 'text-white' : tab.color}>{tab.icon}</span>
            {tab.label}
            {tab.id === 'delayed' && delayedRows.length > 0 && (
              <span className="ml-1 bg-red-500 text-white text-xs px-1.5 py-0.5 rounded-full">{delayedRows.length}</span>
            )}
            {tab.id === 'noteam' && noTeamRows.length > 0 && (
              <span className="ml-1 bg-orange-500 text-white text-xs px-1.5 py-0.5 rounded-full">{noTeamRows.length}</span>
            )}
          </button>
        ))}
      </div>

      {/* ── ЗАБАВЕНИ ДОКУМЕНТИ ── */}
      {activeTab === 'delayed' && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="font-semibold text-slate-800">Мониторинг на забавени документи</h2>
              <p className="text-xs text-slate-500 mt-0.5 print:hidden">Документи с изтекъл или наближаващ краен срок (до 3 дни)</p>
            </div>
            {delayedRows.length > 0 && (
              <ExportButtons onExcel={() => generateDelayedDocsExcel(delayedRows)} />
            )}
          </div>
          {delayedRows.length === 0 ? (
            <div className="card text-center py-12 text-green-600">
              <p className="text-lg mb-1">✓</p>
              <p className="font-medium">Няма забавени документи</p>
              <p className="text-xs text-slate-400 mt-1">Всички документи са в срок</p>
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200">
                      <th className="text-left px-4 py-2.5 text-xs font-medium text-slate-500">Документ</th>
                      <th className="text-left px-4 py-2.5 text-xs font-medium text-slate-500">Ученик</th>
                      <th className="text-left px-4 py-2.5 text-xs font-medium text-slate-500">Паралелка</th>
                      <th className="text-left px-4 py-2.5 text-xs font-medium text-slate-500">Специалист</th>
                      <th className="text-left px-4 py-2.5 text-xs font-medium text-slate-500">Статус</th>
                      <th className="text-center px-4 py-2.5 text-xs font-medium text-slate-500">Краен срок</th>
                    </tr>
                  </thead>
                  <tbody>
                    {delayedRows.map((row, idx) => (
                      <tr key={idx} className={`border-b border-slate-100 ${row.isOverdue ? 'bg-red-50/40' : 'bg-amber-50/30'}`}>
                        <td className="px-4 py-2.5 text-xs font-medium text-slate-700">{row.docType}</td>
                        <td className="px-4 py-2.5 font-medium text-slate-800 whitespace-nowrap">{row.studentName}</td>
                        <td className="px-4 py-2.5 text-slate-600">{row.className}</td>
                        <td className="px-4 py-2.5 text-slate-600">{row.specialist}</td>
                        <td className="px-4 py-2.5"><StatusBadge status={row.status} /></td>
                        <td className="px-4 py-2.5 text-center">
                          <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${row.isOverdue ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'}`}>
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
        <div>
          <div className="flex flex-wrap items-center gap-3 mb-4">
            <select className="input w-72 print:hidden" value={selectedSchool} onChange={e => setSelectedSchool(e.target.value)}>
              <option value="">— Избери училище —</option>
              {schools.map(s => <option key={s.id} value={s.id}>{s.name} — {s.city}</option>)}
            </select>
            {schoolRows.length > 0 && (
              <div className="flex items-center gap-2">
                <ExportButtons onExcel={() => generateSchoolReportExcel(schools.find(s => s.id === selectedSchool)?.name || '', schoolRows)} />
                <button
                  onClick={() => {
                    const school = schools.find(s => s.id === selectedSchool)
                    if (school) generateSchoolLetter(school.name, school.city, schoolRows, yearName)
                  }}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-blue-200 text-xs font-medium text-blue-700 hover:bg-blue-50">
                  <LetterIcon size={13} />
                  Писмо Word
                </button>
              </div>
            )}
          </div>
          {!selectedSchool ? (
            <div className="card text-center py-12 text-slate-400 print:hidden">
              <School size={32} className="mx-auto mb-2 opacity-30" />
              <p className="text-sm">Избери училище за да видиш справката</p>
            </div>
          ) : schoolRows.length === 0 ? (
            <div className="card text-center py-12 text-slate-400"><p className="text-sm">Няма ученици от това училище</p></div>
          ) : (
            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
              <div className="px-4 py-3 border-b border-slate-100 text-sm font-medium text-slate-700">
                {schools.find(s => s.id === selectedSchool)?.name} — {schoolRows.length} ученика
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200">
                      <th className="text-left px-4 py-2.5 text-xs font-medium text-slate-500">Три имена</th>
                      <th className="text-left px-4 py-2.5 text-xs font-medium text-slate-500">Паралелка</th>
                      <th className="text-left px-4 py-2.5 text-xs font-medium text-slate-500">Психолог</th>
                      <th className="text-left px-4 py-2.5 text-xs font-medium text-slate-500">Логопед</th>
                      <th className="text-left px-4 py-2.5 text-xs font-medium text-slate-500">Рехабилитатор</th>
                      <th className="text-center px-4 py-2.5 text-xs font-medium text-slate-500">Документи</th>
                    </tr>
                  </thead>
                  <tbody>
                    {schoolRows.map((row, idx) => (
                      <tr key={row.studentId} className={`border-b border-slate-100 ${idx % 2 === 1 ? 'bg-slate-50' : ''}`}>
                        <td className="px-4 py-2.5 font-medium text-slate-800">{row.name}</td>
                        <td className="px-4 py-2.5 text-slate-600">{row.className}</td>
                        <td className="px-4 py-2.5 text-slate-600 text-xs">{row.psychologist}</td>
                        <td className="px-4 py-2.5 text-slate-600 text-xs">{row.speechTherapist}</td>
                        <td className="px-4 py-2.5 text-slate-600 text-xs">{row.rehabilitator}</td>
                        <td className="px-4 py-2.5 text-center">
                          <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${row.docsCompleted === row.docsTotal ? 'bg-green-100 text-green-700' : row.docsCompleted > 0 ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-500'}`}>
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
      )}

      {/* ── ПО СПЕЦИАЛИСТ ── */}
      {activeTab === 'specialist' && (
        <div>
          <div className="flex flex-wrap items-center gap-3 mb-4">
            <select className="input w-64 print:hidden" value={selectedSpecialist} onChange={e => setSelectedSpecialist(e.target.value)}>
              <option value="">— Избери специалист —</option>
              {specialists.map(s => <option key={s.id} value={s.id}>{s.name} ({s.role})</option>)}
            </select>
            {specialistRows.length > 0 && (
              <ExportButtons onExcel={() => generateSpecialistReportExcel(specialists.find(s => s.id === selectedSpecialist)?.name || '', specialistRows)} />
            )}
          </div>
          {!selectedSpecialist ? (
            <div className="card text-center py-12 text-slate-400 print:hidden">
              <Users size={32} className="mx-auto mb-2 opacity-30" />
              <p className="text-sm">Избери специалист за да видиш справката</p>
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
              <div className="px-4 py-3 border-b border-slate-100 text-sm font-medium text-slate-700">
                {specialists.find(s => s.id === selectedSpecialist)?.name} — {specialistRows.length} ученика
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200">
                      <th className="text-left px-4 py-2.5 text-xs font-medium text-slate-500">Три имена</th>
                      <th className="text-left px-4 py-2.5 text-xs font-medium text-slate-500">Пар.</th>
                      {['П1','П2','П3','ИУП','ИУПр','ПДП','ПР'].map(h => (
                        <th key={h} className="text-center px-2 py-2.5 text-xs font-medium text-slate-500">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {specialistRows.map((row, idx) => (
                      <tr key={row.studentId} className={`border-b border-slate-100 ${idx % 2 === 1 ? 'bg-slate-50' : ''}`}>
                        <td className="px-4 py-2.5 font-medium text-slate-800 whitespace-nowrap">{row.name}</td>
                        <td className="px-4 py-2.5 text-slate-600">{row.className}</td>
                        {[row.p1, row.p2, row.p3, row.iup, row.iuProgram, row.supportPlan, row.parentProgram].map((s, i) => (
                          <td key={i} className="text-center px-2 py-2.5"><StatusBadge status={s} /></td>
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
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-slate-800">Натовареност на специалистите</h2>
            <ExportButtons onExcel={() => generateWorkloadReportExcel(workloadRows)} />
          </div>
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="text-left px-4 py-2.5 text-xs font-medium text-slate-500">Специалист</th>
                  <th className="text-left px-4 py-2.5 text-xs font-medium text-slate-500">Роля</th>
                  <th className="text-center px-4 py-2.5 text-xs font-medium text-slate-500">Ученици</th>
                  <th className="text-center px-4 py-2.5 text-xs font-medium text-slate-500">Завършени</th>
                  <th className="px-4 py-2.5 text-xs font-medium text-slate-500 print:hidden">Прогрес</th>
                  <th className="px-4 py-2.5 text-xs font-medium text-slate-500 hidden print:table-cell">%</th>
                </tr>
              </thead>
              <tbody>
                {workloadRows.map((row, idx) => {
                  const pct = row.totalDocs > 0 ? Math.round(row.completedDocs / row.totalDocs * 100) : 0
                  return (
                    <tr key={row.id} className={`border-b border-slate-100 ${idx % 2 === 1 ? 'bg-slate-50' : ''}`}>
                      <td className="px-4 py-2.5 font-medium text-slate-800">{row.name}</td>
                      <td className="px-4 py-2.5 text-slate-600 text-xs">{row.role}</td>
                      <td className="px-4 py-2.5 text-center">
                        <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${row.studentCount === 0 ? 'bg-slate-100 text-slate-400' : row.studentCount <= 20 ? 'bg-green-100 text-green-700' : row.studentCount <= 30 ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'}`}>
                          {row.studentCount}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-center text-xs text-slate-600">{row.completedDocs}/{row.totalDocs}</td>
                      <td className="px-4 py-2.5 print:hidden">
                        <div className="flex items-center gap-2">
                          <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                            <div className={`h-full rounded-full ${pct >= 80 ? 'bg-green-500' : pct >= 40 ? 'bg-amber-500' : 'bg-red-400'}`} style={{ width: `${pct}%` }} />
                          </div>
                          <span className="text-xs text-slate-500 w-8">{pct}%</span>
                        </div>
                      </td>
                      <td className="px-4 py-2.5 text-xs text-slate-600 hidden print:table-cell">{pct}%</td>
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
        <div>
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="font-semibold text-slate-800">Деца без ЕПЛР екип</h2>
              <p className="text-xs text-slate-500 mt-0.5 print:hidden">Деца без назначен психолог И логопед</p>
            </div>
            {noTeamRows.length > 0 && <ExportButtons onExcel={() => generateNoTeamReportExcel(noTeamRows)} />}
          </div>
          {noTeamRows.length === 0 ? (
            <div className="card text-center py-12 text-green-600">
              <p className="text-lg mb-1">✓</p>
              <p className="font-medium">Всички деца имат ЕПЛР екип</p>
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200">
                    <th className="text-left px-4 py-2.5 text-xs font-medium text-slate-500">Три имена</th>
                    <th className="text-left px-4 py-2.5 text-xs font-medium text-slate-500">Паралелка</th>
                    <th className="text-center px-4 py-2.5 text-xs font-medium text-slate-500">Психолог</th>
                    <th className="text-center px-4 py-2.5 text-xs font-medium text-slate-500">Логопед</th>
                    <th className="text-center px-4 py-2.5 text-xs font-medium text-slate-500">Рехабилитатор</th>
                  </tr>
                </thead>
                <tbody>
                  {noTeamRows.map((row, idx) => (
                    <tr key={row.studentId} className={`border-b border-slate-100 ${idx % 2 === 1 ? 'bg-slate-50' : ''}`}>
                      <td className="px-4 py-2.5 font-medium text-slate-800">{row.name}</td>
                      <td className="px-4 py-2.5 text-slate-600">{row.className}</td>
                      <td className="px-4 py-2.5 text-center">
                        <span className={`text-xs px-2 py-0.5 rounded-full ${row.missingPsychologist ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
                          {row.missingPsychologist ? 'Липсва' : '✓'}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-center">
                        <span className={`text-xs px-2 py-0.5 rounded-full ${row.missingSpeechTherapist ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
                          {row.missingSpeechTherapist ? 'Липсва' : '✓'}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-center">
                        <span className={`text-xs px-2 py-0.5 rounded-full ${row.missingRehabilitator ? 'bg-amber-100 text-amber-700' : 'bg-green-100 text-green-700'}`}>
                          {row.missingRehabilitator ? 'Липсва' : '✓'}
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
        <div>
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="font-semibold text-slate-800">Обобщена годишна справка</h2>
              <p className="text-xs text-slate-500 mt-0.5 print:hidden">Всички ученици с екипи и статус — {yearName}</p>
            </div>
            <ExportButtons onExcel={() => generateAnnualReportExcel(yearName, allRows)} />
          </div>
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200">
                    <th className="text-left px-4 py-2.5 text-xs font-medium text-slate-500 whitespace-nowrap">Три имена</th>
                    <th className="text-left px-2 py-2.5 text-xs font-medium text-slate-500">Пар.</th>
                    <th className="text-left px-2 py-2.5 text-xs font-medium text-blue-500">Психолог</th>
                    <th className="text-left px-2 py-2.5 text-xs font-medium text-purple-500">Логопед</th>
                    {['П1','П2','П3','ИУП','ИУПр','ПДП','ПР'].map(h => (
                      <th key={h} className="text-center px-2 py-2.5 text-xs font-medium text-slate-500">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {allRows.map((row, idx) => (
                    <tr key={row.studentId} className={`border-b border-slate-100 ${idx % 2 === 1 ? 'bg-slate-50' : ''}`}>
                      <td className="px-4 py-2 font-medium text-slate-800 whitespace-nowrap">{row.name}</td>
                      <td className="px-2 py-2 text-slate-600">{row.className}</td>
                      <td className="px-2 py-2 text-slate-600 text-xs whitespace-nowrap">{row.psychologist}</td>
                      <td className="px-2 py-2 text-slate-600 text-xs whitespace-nowrap">{row.speechTherapist}</td>
                      {[row.p1, row.p2, row.p3, row.iup, row.iuProgram, row.supportPlan, row.parentProgram].map((s, i) => (
                        <td key={i} className="text-center px-2 py-2"><StatusBadge status={s} /></td>
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
