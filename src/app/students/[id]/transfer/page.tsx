'use client'
import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { ArrowLeft, ArrowRight, Check, AlertTriangle, History } from 'lucide-react'
import Link from 'next/link'
import { useToast } from '@/components/ui/Toast'
import { getFullName } from '@/lib/utils'
import { transferStudent, getClassMoves } from './actions'

const fmt = (d: string) => d.split('-').reverse().join('.')
const todayIso = () => {
  const n = new Date(new Date().toLocaleString('en-US', { timeZone: 'Europe/Sofia' }))
  return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}-${String(n.getDate()).padStart(2, '0')}`
}

export default function TransferStudentPage() {
  const params = useParams()
  const id = params.id as string
  const router = useRouter()
  const { toast } = useToast()
  const supabase = createClient()
  const [student, setStudent] = useState<any>(null)
  const [classes, setClasses] = useState<{ id: string; name: string }[]>([])
  const [selectedClass, setSelectedClass] = useState('')
  const [movedOn, setMovedOn] = useState(todayIso())
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)
  const [currentClass, setCurrentClass] = useState<string>('')
  const [currentClassId, setCurrentClassId] = useState<string>('')
  const [hasEnrollment, setHasEnrollment] = useState(false)
  const [moves, setMoves] = useState<Awaited<ReturnType<typeof getClassMoves>>>([])
  const [result, setResult] = useState<{ done: string[]; warnings: string[] } | null>(null)

  useEffect(() => { loadData() }, [id])
  async function loadData() {
    const { data: s } = await supabase.from('students').select('*').eq('id', id).single()
    setStudent(s)
    const { data: year } = await supabase.from('academic_years').select('id').eq('is_current', true).single()
    const { data: cls } = await supabase
      .from('classes').select('id, name').eq('academic_year_id', year?.id).order('name')
    setClasses(cls || [])
    const { data: enrollment } = await supabase
      .from('student_enrollments')
      .select('class_id, class:classes(name)')
      .eq('student_id', id)
      .eq('academic_year_id', year?.id)
      .maybeSingle()
    if (enrollment) {
      setHasEnrollment(true)
      setCurrentClass((enrollment.class as any)?.name || '')
      setCurrentClassId(enrollment.class_id)
    }
    setMoves(await getClassMoves(id))
  }

  async function handleTransfer(e: React.FormEvent) {
    e.preventDefault()
    if (!selectedClass) { toast('Избери паралелка', 'error'); return }
    setSaving(true)
    const res: any = await transferStudent(id, selectedClass, movedOn, note)
    setSaving(false)
    if (res.error) { toast(res.error, 'error'); return }
    toast(hasEnrollment ? 'Ученикът е преместен' : 'Ученикът е записан в паралелка')
    // Ако има предупреждения — показваме ги, иначе направо обратно в досието
    if (res.warnings?.length) { setResult({ done: res.done || [], warnings: res.warnings }); return }
    router.push(`/students/${id}`)
  }

  const isFirstAssignment = !hasEnrollment
  return (
    <div className="p-4 md:p-8 max-w-lg">
      <Link href={`/students/${id}`} className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800 mb-6">
        <ArrowLeft size={15} />
        Назад
      </Link>
      <h1 className="text-2xl font-semibold text-slate-800 mb-1">
        {isFirstAssignment ? 'Записване в паралелка' : 'Преместване в друга паралелка'}
      </h1>
      {student && <p className="text-slate-500 text-sm mb-6">{getFullName(student)}</p>}

      {result ? (
        <div className="card space-y-3">
          <div className="space-y-1">
            {result.done.map((d, i) => <div key={i} className="flex items-start gap-2 text-sm text-slate-700"><Check size={14} className="text-emerald-600 mt-0.5 shrink-0" />{d}</div>)}
            {result.warnings.map((w, i) => <div key={i} className="flex items-start gap-2 text-sm text-amber-800"><AlertTriangle size={14} className="text-amber-500 mt-0.5 shrink-0" />{w}</div>)}
          </div>
          <Link href={`/students/${id}`} className="btn-primary inline-block" style={{ backgroundColor: '#0f2240' }}>Към досието</Link>
        </div>
      ) : (
      <div className="card">
        {currentClass ? (
          <div className="mb-4 p-3 bg-slate-50 rounded-lg text-sm text-slate-600">
            Текуща паралелка: <strong>{currentClass}</strong>
          </div>
        ) : (
          <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-700">
            Ученикът още няма паралелка. Изберете, за да го запишете.
          </div>
        )}
        <form onSubmit={handleTransfer} className="space-y-4">
          <div>
            <label className="label">{isFirstAssignment ? 'Паралелка' : 'Нова паралелка'}</label>
            <select className="input" value={selectedClass} onChange={e => setSelectedClass(e.target.value)}>
              <option value="">— Избери —</option>
              {classes.filter(c => c.id !== currentClassId).map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
          {!isFirstAssignment && (
            <div className="grid grid-cols-1 sm:grid-cols-[150px_1fr] gap-3">
              <div>
                <label className="label">Считано от</label>
                <input type="date" className="input" value={movedOn} onChange={e => setMovedOn(e.target.value)} />
              </div>
              <div>
                <label className="label">Основание / бележка</label>
                <input className="input" value={note} onChange={e => setNote(e.target.value)} placeholder="напр. решение на КЕ, заповед №…" />
              </div>
            </div>
          )}
          {!isFirstAssignment && (
            <p className="text-[11px] text-slate-500 leading-relaxed">
              Заедно с паралелката се сменя и <strong>класният в ЕПЛР екипа</strong>, а папката на детето в Drive минава в новата паралелка:
              новият класен получава достъп, старият го губи. Досието, родителите, документите, ИФО и терапиите остават непроменени.
            </p>
          )}
          <div className="flex gap-3">
            <button type="submit" disabled={saving} className="btn-primary" style={{ backgroundColor: '#0f2240' }}>
              {saving ? 'Записване...' : (isFirstAssignment ? 'Запиши' : 'Премести')}
            </button>
            <Link href={`/students/${id}`} className="btn-secondary">Отказ</Link>
          </div>
        </form>
      </div>
      )}

      {moves.length > 0 && (
        <div className="mt-6">
          <h2 className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-2 flex items-center gap-1.5"><History size={13} /> История на преместванията</h2>
          <div className="space-y-1.5">
            {moves.map(m => (
              <div key={m.id} className="bg-white border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-700">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-slate-400 text-xs">{fmt(m.on)}</span>
                  <span>{m.from}</span><ArrowRight size={13} className="text-slate-400" /><span className="font-medium">{m.to}</span>
                  {m.by && <span className="text-[11px] text-slate-400 ml-auto">{m.by}</span>}
                </div>
                {m.note && <div className="text-[12px] text-slate-500 mt-0.5">{m.note}</div>}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
