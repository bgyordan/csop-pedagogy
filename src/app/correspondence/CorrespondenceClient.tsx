'use client'

import { useState } from 'react'
import { School, Users, FileSpreadsheet, FileText, Mail } from 'lucide-react'
import { generateSchoolLetter } from '@/lib/docx-generator'
import { generateSchoolReportExcel, generateSpecialistReportExcel } from '@/lib/excel-generator'

type Tab = 'school' | 'specialist'

interface Props {
  allRows: any[]
  schools: { id: string; name: string; city: string }[]
  specialists: { id: string; name: string; role: string }[]
  specialistRows: any[]
  yearName: string
}

export default function CorrespondenceClient({ allRows, schools, specialists, specialistRows, yearName }: Props) {
  const [activeTab, setActiveTab] = useState<Tab>('school')
  const [selectedSchool, setSelectedSchool] = useState('')
  const [selectedSpecialist, setSelectedSpecialist] = useState('')

  const schoolRows = selectedSchool ? allRows.filter(r => r.sendingSchoolId === selectedSchool) : []
  const specialistStudentRows = selectedSpecialist
    ? allRows.filter(r =>
        r.psychologistId === selectedSpecialist ||
        r.speechTherapistId === selectedSpecialist ||
        r.rehabilitatorId === selectedSpecialist
      )
    : []

  const tabs = [
    { id: 'school' as Tab, label: 'По училище', icon: <School size={15} />, color: 'text-blue-600' },
    { id: 'specialist' as Tab, label: 'По специалист', icon: <Users size={15} />, color: 'text-purple-600' },
  ]

  return (
    <div>
      {/* Табове */}
      <div className="inline-flex p-1 bg-slate-100/80 backdrop-blur-sm rounded-xl mb-8 border border-slate-200/50 shadow-inner">
        {tabs.map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 ${
              activeTab === tab.id
                ? 'bg-white text-slate-800 shadow-sm border border-slate-200/50'
                : 'text-slate-500 hover:text-slate-700 hover:bg-slate-200/50'
            }`}>
            <span className={activeTab === tab.id ? tab.color : 'opacity-60'}>{tab.icon}</span>
            {tab.label}
          </button>
        ))}
      </div>

      {/* ── ПО УЧИЛИЩЕ ── */}
      {activeTab === 'school' && (
        <div>
          <div className="mb-6">
            <h2 className="text-lg font-semibold text-slate-800 mb-1">Писма и справки по училище</h2>
            <p className="text-sm text-slate-500">Избери училище за да генерираш официално писмо или справка</p>
          </div>

          <div className="flex flex-wrap items-center gap-3 mb-6">
            <select className="input w-80" value={selectedSchool} onChange={e => setSelectedSchool(e.target.value)}>
              <option value="">— Избери изпращащо училище —</option>
              {schools.map(s => <option key={s.id} value={s.id}>{s.name} — {s.city}</option>)}
            </select>
          </div>

          {!selectedSchool ? (
            <div className="bg-slate-50/50 border border-slate-100 rounded-2xl p-16 text-center">
              <School size={40} strokeWidth={1.5} className="mx-auto mb-3 text-slate-300" />
              <p className="text-sm font-medium text-slate-500">Избери училище от менюто</p>
            </div>
          ) : schoolRows.length === 0 ? (
            <div className="bg-slate-50/50 border border-slate-100 rounded-2xl p-16 text-center">
              <p className="text-sm font-medium text-slate-500">Няма ученици от това училище</p>
            </div>
          ) : (
            <div>
              {/* Бутони за действие */}
              <div className="flex flex-wrap gap-3 mb-6">
                <button
                  onClick={() => {
                    const school = schools.find(s => s.id === selectedSchool)
                    if (school) generateSchoolLetter(school.name, school.city, schoolRows, yearName)
                  }}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-medium text-white shadow-md hover:shadow-lg transition-all"
                  style={{ backgroundColor: '#0f2240' }}>
                  <Mail size={16} />
                  Официално писмо (Word)
                </button>
                <button
                  onClick={() => generateSchoolReportExcel(schools.find(s => s.id === selectedSchool)?.name || '', schoolRows)}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-medium border border-slate-200 hover:bg-slate-50 transition-colors shadow-sm">
                  <FileSpreadsheet size={16} className="text-green-600" />
                  Справка Excel
                </button>
              </div>

              {/* Таблица */}
              <div className="bg-white rounded-2xl border border-slate-200/80 overflow-hidden shadow-sm">
                <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
                  <h3 className="font-semibold text-slate-800 text-sm">{schools.find(s => s.id === selectedSchool)?.name}</h3>
                  <span className="text-xs font-medium text-blue-600 bg-blue-50 px-2.5 py-1 rounded-md">{schoolRows.length} ученика</span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-50/50 border-b border-slate-100">
                      <tr>
                        <th className="text-left px-5 py-3 text-[11px] font-bold text-slate-400 uppercase tracking-widest">Три имена</th>
                        <th className="text-left px-5 py-3 text-[11px] font-bold text-slate-400 uppercase tracking-widest">Пар. ЦСОП</th>
                        <th className="text-left px-5 py-3 text-[11px] font-bold text-slate-400 uppercase tracking-widest">Клас</th>
                        <th className="text-left px-5 py-3 text-[11px] font-bold text-slate-400 uppercase tracking-widest">Психолог</th>
                        <th className="text-left px-5 py-3 text-[11px] font-bold text-slate-400 uppercase tracking-widest">Логопед</th>
                        <th className="text-left px-5 py-3 text-[11px] font-bold text-slate-400 uppercase tracking-widest">Рехабилитатор</th>
                        <th className="text-left px-5 py-3 text-[11px] font-bold text-slate-400 uppercase tracking-widest">Класен р-л</th>
                      </tr>
                    </thead>
                    <tbody>
                      {schoolRows.map((row, idx) => (
                        <tr key={row.studentId} className="border-b border-slate-50 hover:bg-slate-50/80 transition-colors">
                          <td className="px-5 py-3 font-medium text-slate-800">{row.name}</td>
                          <td className="px-5 py-3 text-slate-500">{row.className}</td>
                          <td className="px-5 py-3 text-slate-500">{row.externalClass || '—'}</td>
                          <td className="px-5 py-3 text-slate-500 text-xs">{row.psychologist}</td>
                          <td className="px-5 py-3 text-slate-500 text-xs">{row.speechTherapist}</td>
                          <td className="px-5 py-3 text-slate-500 text-xs">{row.rehabilitator}</td>
                          <td className="px-5 py-3 text-slate-500 text-xs">{row.classTeacher}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── ПО СПЕЦИАЛИСТ ── */}
      {activeTab === 'specialist' && (
        <div>
          <div className="mb-6">
            <h2 className="text-lg font-semibold text-slate-800 mb-1">Справки по специалист</h2>
            <p className="text-sm text-slate-500">Справка за дейността на конкретен специалист — за архив или изпращане</p>
          </div>

          <div className="flex flex-wrap items-center gap-3 mb-6">
            <select className="input w-72" value={selectedSpecialist} onChange={e => setSelectedSpecialist(e.target.value)}>
              <option value="">— Избери специалист —</option>
              {specialists.map(s => <option key={s.id} value={s.id}>{s.name} ({s.role})</option>)}
            </select>
            {selectedSpecialist && specialistStudentRows.length > 0 && (
              <button
                onClick={() => generateSpecialistReportExcel(specialists.find(s => s.id === selectedSpecialist)?.name || '', specialistStudentRows)}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-medium border border-slate-200 hover:bg-slate-50 transition-colors shadow-sm">
                <FileSpreadsheet size={16} className="text-green-600" />
                Справка Excel
              </button>
            )}
          </div>

          {!selectedSpecialist ? (
            <div className="bg-slate-50/50 border border-slate-100 rounded-2xl p-16 text-center">
              <Users size={40} strokeWidth={1.5} className="mx-auto mb-3 text-slate-300" />
              <p className="text-sm font-medium text-slate-500">Избери специалист от менюто</p>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Обобщение */}
              {(() => {
                const sp = specialistRows.find(r => r.id === selectedSpecialist)
                if (!sp) return null
                const pct = sp.totalDocs > 0 ? Math.round(sp.completedDocs / sp.totalDocs * 100) : 0
                return (
                  <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-sm">
                    <div className="flex items-center justify-between mb-3">
                      <div>
                        <div className="font-semibold text-slate-800">{sp.name}</div>
                        <div className="text-xs text-slate-500 mt-0.5">{sp.role} · {sp.studentCount} ученика</div>
                      </div>
                      <span className={`text-sm font-bold px-3 py-1.5 rounded-xl ${pct >= 80 ? 'bg-green-50 text-green-700' : pct >= 40 ? 'bg-amber-50 text-amber-700' : 'bg-red-50 text-red-700'}`}>
                        {pct}%
                      </span>
                    </div>
                    <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                      <div className={`h-full rounded-full ${pct >= 80 ? 'bg-green-500' : pct >= 40 ? 'bg-amber-400' : 'bg-red-400'}`} style={{ width: `${pct}%` }} />
                    </div>
                    <div className="text-xs text-slate-400 mt-2">{sp.completedDocs} завършени от {sp.totalDocs} документа</div>
                  </div>
                )
              })()}

              {/* Таблица с ученици */}
              <div className="bg-white rounded-2xl border border-slate-200/80 overflow-hidden shadow-sm">
                <div className="px-5 py-4 border-b border-slate-100">
                  <span className="text-xs font-medium text-purple-600 bg-purple-50 px-2.5 py-1 rounded-md">{specialistStudentRows.length} ученика</span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-50/50 border-b border-slate-100">
                      <tr>
                        <th className="text-left px-5 py-3 text-[11px] font-bold text-slate-400 uppercase tracking-widest">Три имена</th>
                        <th className="text-left px-5 py-3 text-[11px] font-bold text-slate-400 uppercase tracking-widest">Пар.</th>
                        {['П1','П2','П3','ИУП','ИУПр','ПДП','ПР'].map(h => (
                          <th key={h} className="text-center px-3 py-3 text-[11px] font-bold text-slate-400 uppercase tracking-widest">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {specialistStudentRows.map((row, idx) => (
                        <tr key={row.studentId} className="border-b border-slate-50 hover:bg-slate-50/80 transition-colors">
                          <td className="px-5 py-3 font-medium text-slate-800 whitespace-nowrap">{row.name}</td>
                          <td className="px-5 py-3 text-slate-500">{row.className}</td>
                          {[row.p1, row.p2, row.p3, row.iup, row.iuProgram, row.supportPlan, row.parentProgram].map((s, i) => (
                            <td key={i} className="text-center px-3 py-3">
                              <span className={`text-xs font-medium px-2 py-0.5 rounded-md ${
                                s === 'Завършен' ? 'bg-green-50 text-green-700' :
                                s === 'В процес' ? 'bg-amber-50 text-amber-700' :
                                'bg-slate-50 text-slate-400'
                              }`}>
                                {s === 'Завършен' ? '✓' : s === 'В процес' ? '…' : '—'}
                              </span>
                            </td>
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
      )}
    </div>
  )
}
