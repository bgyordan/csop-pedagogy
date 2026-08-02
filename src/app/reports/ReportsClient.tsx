'use client'
import { useState } from 'react'
import { FileSpreadsheet, AlertTriangle, Users, School, BarChart3, FileX, FileText, Printer, Check, ChevronDown, ChevronUp, Mail, Download, ArrowRight, CalendarClock, Sparkles } from 'lucide-react'
import { generateSchoolLetter, generateSchoolScheduleLetter } from '@/lib/docx-generator'
import RuoLetterButton from './RuoLetterButton'
import DistributionPdfButton from './DistributionPdfButton'
import { generateIntensityPDF } from '@/lib/pdf-generator'
import {
  generateSchoolReportExcel,
  generateSpecialistReportExcel,
  generateWorkloadReportExcel,
} from '@/lib/excel-generator'
import Link from 'next/link'
type ReportTab = 'distribution' | 'school' | 'workload' | 'intensity'
const TAB_TITLES: Record<ReportTab, string> = {
  distribution: 'Разпределение на учениците',
  school: 'Писма по изпращащо училище',
  workload: 'Натовареност на специалистите',
  intensity: 'Терапевтична натовареност по деца',
}
interface Props {
  schedules?: { id: string; name: string }[]
  slotsBySchedule?: Record<string, Record<string, { date: string; time: string }>>
  allRows: any[]
  workloadRows: any[]
  intensityRows: any[]
  delayedRows?: any[]
  schools: { id: string; name: string; city: string }[]
  specialists: { id: string; name: string; role: string }[]
  yearName: string
  limitedView?: boolean
}
export default function ReportsClient({ schedules = [], slotsBySchedule = {}, allRows, workloadRows, intensityRows = [], delayedRows = [], schools, specialists, yearName, limitedView = false }: Props) {
  const [activeTab, setActiveTab] = useState<ReportTab>(limitedView ? 'intensity' : 'distribution')
  const [distClass, setDistClass] = useState('')
  const [distSpecialist, setDistSpecialist] = useState('')
  const [distNewOnly, setDistNewOnly] = useState(false)
  const [distSearch, setDistSearch] = useState('')
  const [expandedSchool, setExpandedSchool] = useState<string | null>(null)
  const [generatingAll, setGeneratingAll] = useState(false)
  const [scheduleId, setScheduleId] = useState(schedules[0]?.id || '')
  const [generatingSchedules, setGeneratingSchedules] = useState(false)
  const activeSlots = slotsBySchedule[scheduleId] || {}
  const ruoData = (() => {
    const byClass: Record<string, { className: string; students: any[] }> = {}
    allRows.forEach((r: any) => {
      const key = r.className || '—'
      if (!byClass[key]) byClass[key] = { className: key, students: [] }
      byClass[key].students.push({
        name: r.name,
        school: r.sendingSchoolName || '',
        externalClass: r.externalClass || '',
      })
    })
    return Object.values(byClass)
      .sort((a, b) => a.className.localeCompare(b.className, 'bg', { numeric: true }))
      .map(c => ({
        ...c,
        students: c.students.sort((a: any, b: any) => a.name.localeCompare(b.name, 'bg')),
      }))
  })()
  function scheduleRowsFor(schoolId: string) {
    return getSchoolRows(schoolId)
      .map((r: any) => {
        const slot = activeSlots[r.studentId]
        if (!slot?.date && !slot?.time) return null
        return {
          name: r.name,
          externalClass: r.externalClass || '',
          className: r.className || '',
          classTeacher: r.classTeacher || '',
          date: slot.date, time: slot.time,
        }
      })
      .filter(Boolean) as any[]
  }
  async function downloadSchedule(school: any) {
    const rows = scheduleRowsFor(school.id)
    if (rows.length === 0) { alert('Няма насрочени срещи за това училище в избрания график'); return }
    const sch = schedules.find(s => s.id === scheduleId)
    await generateSchoolScheduleLetter(school.name, school.city, yearName, sch?.name || '', rows)
  }
  async function downloadAllSchedules() {
    setGeneratingSchedules(true)
    const sch = schedules.find(s => s.id === scheduleId)
    for (const school of schoolsWithStudents) {
      const rows = scheduleRowsFor(school.id)
      if (rows.length === 0) continue
      await generateSchoolScheduleLetter(school.name, school.city, yearName, sch?.name || '', rows)
      await new Promise(r => setTimeout(r, 500))
    }
    setGeneratingSchedules(false)
  }
  const tabs = [
    { id: 'distribution' as ReportTab, label: 'Разпределение', icon: <Users size={15} />, color: 'text-blue-500' },
    { id: 'school' as ReportTab, label: 'Писма по училище', icon: <School size={15} />, color: 'text-indigo-500' },
    { id: 'workload' as ReportTab, label: 'Натовареност', icon: <BarChart3 size={15} />, color: 'text-emerald-500' },
    { id: 'intensity' as ReportTab, label: 'Терапии по деца', icon: <BarChart3 size={15} />, color: 'text-teal-500' },
  ]
  const uniqueClasses = Array.from(new Set(allRows.map((r: any) => r.className).filter((c: string) => c && c !== '—'))).sort((a: any, b: any) => String(a).localeCompare(String(b), 'bg', { numeric: true }))
  const distRows = allRows.filter((r: any) => {
    if (distClass && r.className !== distClass) return false
    if (distSpecialist && r.psychologistId !== distSpecialist && r.speechTherapistId !== distSpecialist && r.rehabilitatorId !== distSpecialist) return false
    if (distNewOnly && !r.isNew) return false
    if (distSearch.trim()) {
      const q = distSearch.toLowerCase()
      if (!r.name.toLowerCase().includes(q) && !(r.sendingSchoolName || '').toLowerCase().includes(q)) return false
    }
    return true
  }).sort((a: any, b: any) => String(a.className).localeCompare(String(b.className), 'bg', { numeric: true }) || a.name.localeCompare(b.name, 'bg'))
  const schoolsWithStudents = schools.filter(s => allRows.some(r => r.sendingSchoolId === s.id))
  function getSchoolRows(schoolId: string) {
    return allRows.filter(r => r.sendingSchoolId === schoolId)
  }
  function getSchoolStats(schoolId: string) {
    const rows = getSchoolRows(schoolId)
    const withTeam = rows.filter(r => !r.missingPsychologist || !r.missingSpeechTherapist).length
    return { count: rows.length, withTeam }
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
  const [genIntensity, setGenIntensity] = useState(false)
  async function downloadIntensityPdf() {
    setGenIntensity(true)
    try { await generateIntensityPDF(intensityRows, yearName) } catch (e: any) { alert('Грешка: ' + e.message) }
    setGenIntensity(false)
  }
  function ExportButtons({ onExcel }: { onExcel?: () => void }) {
    return (
      <div className="flex items-center gap-1.5 print:hidden">
        {onExcel && (
          <button onClick={onExcel}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-slate-200 text-xs font-medium hover:bg-slate-50 shadow-sm bg-white text-slate-700">
            <FileSpreadsheet size={13} className="text-emerald-600" />
            Excel
          </button>
        )}
        <button onClick={handlePrint}
          className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-slate-200 text-xs font-medium hover:bg-slate-50 shadow-sm bg-white text-slate-700">
          <Printer size={13} className="text-slate-600" />
          PDF / Печат
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
      {/* Меню с табове */}
      <div className="inline-flex p-1 bg-slate-100/80 backdrop-blur-sm rounded-xl mb-6 print:hidden overflow-x-auto max-w-full border border-slate-200/50 shadow-inner">
        {(limitedView ? tabs.filter(t => t.id === 'intensity') : tabs).map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 whitespace-nowrap ${
              activeTab === tab.id
                ? 'bg-white text-slate-800 shadow-sm border border-slate-200/50'
                : 'text-slate-500 hover:text-slate-700 hover:bg-slate-200/50'
            }`}>
            <span className={activeTab === tab.id ? tab.color : 'opacity-60'}>{tab.icon}</span>
            {tab.label}
          </button>
        ))}
      </div>
      {/* ── ТАБ: РАЗПРЕДЕЛЕНИЕ ── */}
      {activeTab === 'distribution' && (
        <div className="animate-in fade-in duration-200 space-y-4">
          {/* Филтри */}
          <div className="flex flex-wrap items-center gap-2 print:hidden">
            <div className="relative flex-1 min-w-[200px] max-w-xs">
              <Users size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input value={distSearch} onChange={e => setDistSearch(e.target.value)}
                placeholder="Търси по име или училище…"
                className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-200" />
            </div>
            <select value={distClass} onChange={e => setDistClass(e.target.value)}
              className="px-3 py-2 border border-slate-200 rounded-xl text-sm bg-white">
              <option value="">Всички паралелки</option>
              {uniqueClasses.map((c: any) => <option key={c} value={c}>Паралелка {c}</option>)}
            </select>
            <select value={distSpecialist} onChange={e => setDistSpecialist(e.target.value)}
              className="px-3 py-2 border border-slate-200 rounded-xl text-sm bg-white">
              <option value="">Всички специалисти</option>
              {specialists.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
            <button onClick={() => setDistNewOnly(!distNewOnly)}
              className={`inline-flex items-center gap-1 px-3 py-2 rounded-xl text-sm font-medium border transition-colors ${distNewOnly ? 'bg-violet-600 text-white border-violet-600' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'}`}>
              <Sparkles size={13} /> Само нови
            </button>
            <span className="text-xs text-slate-400 ml-auto">{distRows.length} ученика</span>
            <DistributionPdfButton rows={distRows} yearName={yearName} />
            <RuoLetterButton yearName={yearName} classes={ruoData} label="Официален списък паралелки" />
          </div>
          {/* Таблица — нежни линийки + колона Класен + зебра */}
          <div className="bg-white rounded-2xl border border-slate-200/80 overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-sm border-collapse">
                <thead className="bg-slate-50/70 border-b border-slate-200">
                  <tr className="[&>th]:border-r [&>th]:border-slate-100 [&>th:last-child]:border-r-0">
                    <th className="text-left px-4 py-3 text-[11px] font-bold text-slate-400 uppercase tracking-widest">Име</th>
                    <th className="text-left px-3 py-3 text-[11px] font-bold text-slate-400 uppercase tracking-widest">Пар.</th>
                    <th className="text-left px-3 py-3 text-[11px] font-bold text-slate-400 uppercase tracking-widest">Класен</th>
                    <th className="text-left px-3 py-3 text-[11px] font-bold text-blue-500 uppercase tracking-widest">Психолог</th>
                    <th className="text-left px-3 py-3 text-[11px] font-bold text-purple-500 uppercase tracking-widest">Логопед</th>
                    <th className="text-left px-3 py-3 text-[11px] font-bold text-teal-500 uppercase tracking-widest">Рехаб.</th>
                    <th className="text-left px-3 py-3 text-[11px] font-bold text-slate-400 uppercase tracking-widest">Училище</th>
                    <th className="text-center px-3 py-3 text-[11px] font-bold text-slate-400 uppercase tracking-widest">Форма</th>
                  </tr>
                </thead>
                <tbody>
                  {distRows.length === 0 ? (
                    <tr><td colSpan={8} className="px-4 py-8 text-center text-slate-400 text-sm">Няма ученици по този филтър</td></tr>
                  ) : distRows.map((row: any, idx: number) => {
                    const nextRow = distRows[idx + 1]
                    const classChanges = !nextRow || nextRow.className !== row.className
                    return (
                    <tr key={row.studentId} className={`hover:bg-blue-50/40 transition-colors [&>td]:border-r [&>td]:border-slate-100 [&>td:last-child]:border-r-0 ${classChanges ? 'border-b-[3px] border-double border-slate-400' : 'border-b border-slate-100'} ${idx % 2 === 1 ? 'bg-slate-50/50' : 'bg-white'}`}>
                      <td className="px-4 py-2.5 font-medium text-slate-800 whitespace-nowrap">
                        <span className="inline-flex items-center gap-1.5">
                          {row.name}
                          {row.isNew && <span className="inline-flex items-center gap-0.5 text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-violet-50 text-violet-600 border border-violet-200"><Sparkles size={9} /> НОВ</span>}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 text-slate-600">{row.className}</td>
                      <td className="px-3 py-2.5 text-xs text-slate-600 whitespace-nowrap">{row.classTeacher || '—'}</td>
                      <td className="px-3 py-2.5 text-xs text-slate-600 whitespace-nowrap">{row.psychologist}</td>
                      <td className="px-3 py-2.5 text-xs text-slate-600 whitespace-nowrap">{row.speechTherapist}</td>
                      <td className="px-3 py-2.5 text-xs text-slate-600 whitespace-nowrap">{row.rehabilitator}</td>
                      <td className="px-3 py-2.5 text-xs text-slate-500">{row.sendingSchoolName}</td>
                      <td className="px-3 py-2.5 text-center">
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${row.educationForm === 'ifo' ? 'bg-amber-50 text-amber-700' : 'bg-slate-100 text-slate-600'}`}>
                          {row.educationForm === 'ifo' ? 'ИФО' : 'Дневна'}
                        </span>
                      </td>
                    </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
      {/* ── ТАБ: ПО УЧИЛИЩЕ / ПИСМА ── */}
      {activeTab === 'school' && (
        <div className="animate-in fade-in duration-200 space-y-4">
          <div className="bg-slate-50 border border-slate-200/60 rounded-xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-sm print:hidden">
            <div>
              <h2 className="text-sm font-bold text-slate-700 uppercase tracking-wider">Кампания Изходящи документи</h2>
              <p className="text-xs text-slate-400 mt-0.5">{schoolsWithStudents.length} активни училища с разпределени деца</p>
            </div>
            <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
              <Link href="/admin/eplr-assignment" className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-white border border-slate-200 text-xs font-bold text-slate-700 hover:bg-slate-50 shadow-sm transition-all">
                <Users size={13} className="text-slate-400" />
                Корекция разпределение екипи
                <ArrowRight size={13} className="text-slate-400" />
              </Link>
              <Link href="/admin/eplr-schedule" className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-white border border-slate-200 text-xs font-bold text-slate-700 hover:bg-slate-50 shadow-sm transition-all">
                <CalendarClock size={13} className="text-slate-400" />
                График екипни срещи
                <ArrowRight size={13} className="text-slate-400" />
              </Link>
            </div>
          </div>
          {schedules.length > 0 && (
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white border border-slate-200 rounded-2xl px-4 py-3 shadow-sm print:hidden">
              <div className="flex items-center gap-2 flex-1">
                <CalendarClock size={15} className="text-slate-400 flex-shrink-0" />
                <span className="text-xs font-semibold text-slate-600 whitespace-nowrap">График:</span>
                <select value={scheduleId} onChange={e => setScheduleId(e.target.value)}
                  className="px-2.5 py-1.5 border border-slate-200 rounded-lg text-xs flex-1 sm:flex-none sm:min-w-56">
                  <option value="">— Не е избран —</option>
                  {schedules.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
              <span className="text-[11px] text-slate-400">Изберете график, за да се появи бутонът „Писмо график" на всяко училище</span>
            </div>
          )}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {schoolsWithStudents.map(school => {
              const stats = getSchoolStats(school.id)
              const rows = getSchoolRows(school.id)
              const isExpanded = expandedSchool === school.id
              const hasMissingTeam = stats.withTeam < stats.count
              return (
                <div key={school.id}
                  className={`bg-white rounded-xl border transition-all duration-200 overflow-hidden shadow-sm flex flex-col ${
                    isExpanded ? 'border-blue-500 ring-4 ring-blue-500/5 md:col-span-2 lg:col-span-3' : 'border-slate-200/70 hover:border-slate-300 hover:shadow-md'
                  }`}>
                  <div
                    className="p-3.5 flex items-center justify-between cursor-pointer select-none gap-3"
                    onClick={() => setExpandedSchool(isExpanded ? null : school.id)}>
                    <div className="min-w-0 flex items-center gap-2.5">
                      <div className={`w-7 h-7 rounded-lg border text-xs font-bold flex items-center justify-center flex-shrink-0 ${isExpanded ? 'bg-blue-50 text-blue-600 border-blue-100' : 'bg-slate-50 text-slate-400 border-slate-200/50'}`}>
                        <School size={14} />
                      </div>
                      <div className="min-w-0">
                        <h4 className="font-bold text-slate-800 text-xs md:text-sm truncate tracking-tight">{school.name}</h4>
                        <p className="text-[11px] text-slate-400 truncate mt-0.5">{school.city}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0" onClick={e => e.stopPropagation()}>
                      {hasMissingTeam && (
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-rose-50 text-rose-600 border border-rose-100">
                          Без екип: {stats.count - stats.withTeam}
                        </span>
                      )}
                      <span className="text-[11px] font-bold px-2 py-0.5 rounded bg-slate-50 text-slate-600 border border-slate-200/60">
                        {stats.count} деца
                      </span>
                      <button
                        onClick={() => setExpandedSchool(isExpanded ? null : school.id)}
                        className={`p-1 text-slate-400 hover:text-slate-600 rounded-md hover:bg-slate-50 print:hidden transition-transform duration-200 ${isExpanded ? 'rotate-180 text-blue-500' : ''}`}>
                        <ChevronDown size={15} />
                      </button>
                    </div>
                  </div>
                  {isExpanded && (
                    <div className="border-t border-slate-100 bg-slate-50/20">
                      <div className="px-4 py-2 border-b border-slate-100 flex flex-wrap items-center justify-end gap-2 bg-slate-50/60 print:hidden">
                        <div className="flex items-center gap-1.5">
                          <button onClick={() => generateSchoolLetter(school.name, school.city, rows, yearName)} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#0f2240] text-white text-xs font-bold hover:bg-[#19325c]">
                            <Mail size={12} /> Писмо екип
                          </button>
                          {scheduleId && (
                            <button onClick={() => downloadSchedule(school)}
                              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white text-xs font-bold transition-colors"
                              style={{ border: '1px solid rgba(15,34,64,0.30)', color: '#0f2240' }}
                              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.backgroundColor = 'rgba(15,34,64,0.05)' }}
                              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.backgroundColor = '#ffffff' }}>
                              <CalendarClock size={12} /> Писмо график
                            </button>
                          )}
                        </div>
                      </div>
                      <div className="overflow-x-auto">
                        <table className="w-full text-xs bg-white">
                          <thead className="bg-slate-50/70 border-b border-slate-200/60">
                            <tr>
                              <th className="text-left px-4 py-2 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Три имена</th>
                              <th className="text-left px-3 py-2 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Група ЦСОП</th>
                              <th className="text-left px-3 py-2 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Клас там</th>
                              <th className="text-left px-3 py-2 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Психолог</th>
                              <th className="text-left px-3 py-2 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Логопед</th>
                              <th className="text-left px-3 py-2 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Рехабилитатор</th>
                              <th className="text-left px-3 py-2 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Класен ръководител</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {rows.map((row, idx) => (
                              <tr key={row.studentId} className={`hover:bg-blue-50/40 transition-colors ${idx % 2 === 1 ? 'bg-slate-50/40' : 'bg-white'}`}>
                                <td className="px-4 py-2 font-bold text-slate-800 whitespace-nowrap">{row.name}</td>
                                <td className="px-3 py-2 text-slate-600">{row.className}</td>
                                <td className="px-3 py-2 text-slate-500 font-semibold">{row.externalClass || '—'}</td>
                                <td className="px-3 py-2 text-slate-500 whitespace-nowrap">{row.psychologist || '—'}</td>
                                <td className="px-3 py-2 text-slate-500 whitespace-nowrap">{row.speechTherapist || '—'}</td>
                                <td className="px-3 py-2 text-slate-500 whitespace-nowrap">{row.rehabilitator || '—'}</td>
                                <td className="px-3 py-2 text-slate-500 whitespace-nowrap">{row.classTeacher || '—'}</td>
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
          </div>
        </div>
      )}
      {/* ── НАТОВАРЕНОСТ ── */}
      {activeTab === 'workload' && (
        <div className="animate-in fade-in duration-200">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-semibold text-slate-800">Натовареност на специалистите</h2>
            <ExportButtons onExcel={() => generateWorkloadReportExcel(workloadRows)} />
          </div>
          <div className="bg-white rounded-2xl border border-slate-200/80 overflow-hidden shadow-sm">
            <table className="w-full text-sm">
              <thead className="bg-slate-50/50 border-b border-slate-100">
                <tr>
                  <th className="text-left px-5 py-2.5 text-[11px] font-bold text-slate-400 uppercase tracking-widest">Специалист</th>
                  <th className="text-left px-5 py-2.5 text-[11px] font-bold text-slate-400 uppercase tracking-widest">Роля</th>
                  <th className="text-center px-5 py-2.5 text-[11px] font-bold text-slate-400 uppercase tracking-widest">Деца (терапия)</th>
                  <th className="text-center px-5 py-2.5 text-[11px] font-bold text-slate-400 uppercase tracking-widest">Сесии / седмица</th>
                </tr>
              </thead>
              <tbody>
               {workloadRows.map((row, idx) => (
                    <tr key={row.id} className={`border-b border-slate-50 hover:bg-blue-50/40 transition-colors ${idx % 2 === 1 ? 'bg-slate-50/40' : 'bg-white'}`}>
                      <td className="px-5 py-2.5 font-medium text-slate-800">{row.name}</td>
                      <td className="px-5 py-2.5 text-slate-500 text-xs">{row.role}</td>
                      <td className="px-5 py-2.5 text-center">
                        <span className={`inline-flex items-center justify-center min-w-[24px] px-2 py-1 text-xs font-bold rounded-md ${row.studentCount === 0 ? 'bg-slate-50 text-slate-400' : row.studentCount <= 20 ? 'bg-emerald-50 text-emerald-700' : row.studentCount <= 30 ? 'bg-amber-50 text-amber-700' : 'bg-red-50 text-red-700'}`}>
                          {row.studentCount}
                        </span>
                      </td>
                      <td className="px-5 py-2.5 text-center text-slate-600 font-semibold">{row.totalSessions}</td>
                    </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
      {/* ── ТЕРАПЕВТИЧНА НАТОВАРЕНОСТ ПО ДЕЦА ── */}
      {activeTab === 'intensity' && (
        <div className="animate-in fade-in duration-200">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-lg font-semibold text-slate-800">Терапевтична натовареност по деца</h2>
              <p className="text-sm text-slate-500 mt-0.5 print:hidden">Колко пъти седмично всеки специалист взима детето · инициали × брой сесии</p>
            </div>
            <div className="flex items-center gap-1.5 print:hidden">
              <button onClick={downloadIntensityPdf} disabled={genIntensity}
                className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold text-white shadow-sm disabled:opacity-60 transition-opacity hover:opacity-90"
                style={{ backgroundColor: '#0f2240' }}>
                <FileText size={13} />
                {genIntensity ? 'Генериране…' : 'PDF (бланка)'}
              </button>
            </div>
          </div>
          <div className="bg-white rounded-2xl border border-slate-200/80 overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50/50 border-b border-slate-100">
                  <tr>
                    <th className="text-left px-4 py-3 text-[11px] font-bold text-slate-400 uppercase tracking-widest">Име</th>
                    <th className="text-left px-3 py-3 text-[11px] font-bold text-slate-400 uppercase tracking-widest">Училище</th>
                    <th className="text-left px-3 py-3 text-[11px] font-bold text-slate-400 uppercase tracking-widest">Клас</th>
                    <th className="text-center px-3 py-3 text-[11px] font-bold text-slate-400 uppercase tracking-widest">Интензитет</th>
                    <th className="text-left px-3 py-3 text-[11px] font-bold text-blue-500 uppercase tracking-widest">П</th>
                    <th className="text-left px-3 py-3 text-[11px] font-bold text-purple-500 uppercase tracking-widest">Л</th>
                    <th className="text-left px-3 py-3 text-[11px] font-bold text-teal-500 uppercase tracking-widest">Р</th>
                  </tr>
                </thead>
                <tbody>
                  {(() => {
                    let lastClass = ''
                    let rowIdx = 0
                    const out: any[] = []
                    intensityRows.forEach((row: any) => {
                      if (row.className !== lastClass) {
                        lastClass = row.className
                        out.push(
                          <tr key={`grp-${row.className}`}>
                            <td colSpan={7} className="px-4 py-2 text-[11px] font-bold text-white uppercase tracking-wider" style={{ backgroundColor: '#0f2240' }}>
                              Паралелка {row.className}
                            </td>
                          </tr>
                        )
                      }
                      const zebra = rowIdx % 2 === 1 ? 'bg-slate-50/40' : 'bg-white'
                      rowIdx++
                      out.push(
                        <tr key={row.studentId} className={`border-b border-slate-50 hover:bg-blue-50/40 transition-colors ${zebra}`}>
                          <td className="px-4 py-2 font-medium text-slate-800 whitespace-nowrap">{row.name}</td>
                          <td className="px-3 py-2 text-slate-500 text-xs">{row.sendingSchoolName}</td>
                          <td className="px-3 py-2 text-slate-500 text-xs">{row.externalClass || '—'}</td>
                          <td className="px-3 py-2 text-center">
                            {row.intensity ? (
                              <span className="inline-flex items-center font-bold px-2 py-0.5 rounded text-[11px] bg-slate-100 text-slate-700">
                                {row.intensity}{/^\d+$/.test(row.intensity) ? ' ч.' : ''}
                              </span>
                            ) : <span className="text-slate-300">—</span>}
                          </td>
                          <td className="px-3 py-2 text-xs font-semibold text-slate-700">{row.psy || '—'}</td>
                          <td className="px-3 py-2 text-xs font-semibold text-slate-700">{row.log || '—'}</td>
                          <td className="px-3 py-2 text-xs font-semibold text-slate-700">{row.reh || '—'}</td>
                        </tr>
                      )
                    })
                    return out
                  })()}
                </tbody>
              </table>
            </div>
          </div>
          <p className="text-[11px] text-slate-400 mt-3 print:hidden">
            Пример: „ТИ×2" означава специалист с инициали ТИ взима детето 2 пъти седмично (по седмичен график).
          </p>
        </div>
      )}
    </div>
  )
}
