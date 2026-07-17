'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ShieldCheck, ShieldAlert, ShieldX, Minus, ChevronDown, ChevronRight } from 'lucide-react'

interface StudentRow {
  id: string
  name: string
  docs: Record<string, string | null | undefined>
}

interface ClassGroup {
  classId: string
  className: string
  students: StudentRow[]
}

interface DocType {
  key: string
  label: string
}

interface Props {
  classes: ClassGroup[]
  docTypes: DocType[]
  currentYearName: string
}

function compareYears(a: string, b: string): number {
  return parseInt(a.split('/')[0]) - parseInt(b.split('/')[0])
}

function statusOf(val: string | null | undefined, currentYear: string): 'valid' | 'expiring' | 'expired' | 'missing' | 'permanent' {
  if (val === undefined) return 'missing'
  if (val === 'permanent' || !val) return 'permanent'
  const cmp = compareYears(val, currentYear)
  if (cmp < 0) return 'expired'
  if (cmp === 0) return 'expiring'
  return 'valid'
}

const STATUS_CFG = {
  valid: { icon: <ShieldCheck size={15} />, cls: 'text-emerald-600', title: 'Валиден' },
  expiring: { icon: <ShieldAlert size={15} />, cls: 'text-amber-600', title: 'Изтича тази година' },
  expired: { icon: <ShieldX size={15} />, cls: 'text-red-600', title: 'Изтекъл' },
  permanent: { icon: <ShieldCheck size={15} />, cls: 'text-slate-400', title: 'Безсрочен' },
  missing: { icon: <Minus size={14} />, cls: 'text-slate-200', title: 'Липсва' },
}

export default function DocumentsMatrixClient({ classes, docTypes, currentYearName }: Props) {
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({})

  function toggle(classId: string) {
    setCollapsed(prev => ({ ...prev, [classId]: !prev[classId] }))
  }

  // Обобщена статистика
  let expiredCount = 0, expiringCount = 0
  classes.forEach(c => c.students.forEach(s => {
    docTypes.forEach(dt => {
      const st = statusOf(s.docs[dt.key], currentYearName)
      if (st === 'expired') expiredCount++
      if (st === 'expiring') expiringCount++
    })
  }))

  if (classes.length === 0) {
    return (
      <div className="bg-white border border-slate-200 rounded-2xl p-16 text-center shadow-sm">
        <p className="text-slate-400 text-sm">Няма ученици за показване</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Легенда + статистика */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white border border-slate-200 rounded-2xl px-5 py-3 shadow-sm">
        <div className="flex flex-wrap items-center gap-4 text-xs">
          <span className="flex items-center gap-1.5 text-slate-600"><ShieldCheck size={14} className="text-emerald-600" /> Валиден</span>
          <span className="flex items-center gap-1.5 text-slate-600"><ShieldAlert size={14} className="text-amber-600" /> Изтича</span>
          <span className="flex items-center gap-1.5 text-slate-600"><ShieldX size={14} className="text-red-600" /> Изтекъл</span>
          <span className="flex items-center gap-1.5 text-slate-600"><Minus size={14} className="text-slate-300" /> Липсва</span>
        </div>
        <div className="flex items-center gap-3 text-xs">
          {expiredCount > 0 && <span className="font-medium text-red-600">{expiredCount} изтекли</span>}
          {expiringCount > 0 && <span className="font-medium text-amber-600">{expiringCount} изтичащи</span>}
        </div>
      </div>

      {/* Таблици по паралелки */}
      {classes.map(cls => {
        const isCollapsed = collapsed[cls.classId]
        return (
          <div key={cls.classId} className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
            <button onClick={() => toggle(cls.classId)}
              className="w-full flex items-center justify-between px-5 py-3 bg-slate-50 border-b border-slate-100 hover:bg-slate-100 transition-colors">
              <div className="flex items-center gap-2">
                {isCollapsed ? <ChevronRight size={16} className="text-slate-400" /> : <ChevronDown size={16} className="text-slate-400" />}
                <span className="text-sm font-medium text-slate-700">Паралелка {cls.className}</span>
              </div>
              <span className="text-xs text-slate-400">{cls.students.length} ученика</span>
            </button>

            {!isCollapsed && (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-100">
                      <th className="text-left px-5 py-2.5 text-[10px] font-medium uppercase tracking-wider text-slate-400">Ученик</th>
                      {docTypes.map(dt => (
                        <th key={dt.key} className="px-2 py-2.5 text-[10px] font-medium uppercase tracking-wider text-slate-400 text-center whitespace-nowrap" title={dt.label}>
                          {dt.label.split(' ')[0]}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {cls.students.map(student => (
                      <tr key={student.id} className="hover:bg-slate-50/50 transition-colors">
                        <td className="px-5 py-2.5">
                          <Link href={`/students/${student.id}`} className="text-sm text-slate-700 hover:text-[#0f2240] hover:underline">
                            {student.name}
                          </Link>
                        </td>
                        {docTypes.map(dt => {
                          const st = statusOf(student.docs[dt.key], currentYearName)
                          const cfg = STATUS_CFG[st]
                          return (
                            <td key={dt.key} className="px-2 py-2.5 text-center">
                              <span className={`inline-flex ${cfg.cls}`} title={`${dt.label}: ${cfg.title}`}>
                                {cfg.icon}
                              </span>
                            </td>
                          )
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
