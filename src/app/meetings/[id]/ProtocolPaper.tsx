'use client'
// Протоколът като лист хартия — за преглед на екрана и за „Печат / PDF“ (същото съдържание като Word).
import { CENTER_NAME } from '@/lib/control'
import {
  BODY_OF, BODY_DECIDES, QUORUM_LABEL, ATT_LABEL, quorum, decisionNumbers, voteLine, dmy, hm, attName, fullName,
  type Meeting, type Item, type Decision, type Attendance, type Person,
} from '@/lib/meetings'

export default function ProtocolPaper({ m, items, decisions, attendance, people }: {
  m: Meeting; items: Item[]; decisions: Decision[]; attendance: Attendance[]; people: Record<string, Person>
}) {
  const q = quorum(attendance, m.quorum_rule)
  const nums = decisionNumbers(items, decisions)
  const members = attendance.filter(a => a.role === 'member')
  const absent = members.filter(a => a.status === 'absent')
  const late = members.filter(a => a.status === 'late' || a.status === 'left')
  const others = attendance.filter(a => a.role !== 'member' && a.status !== 'absent')
  const chair = m.chair_id ? fullName(people[m.chair_id]) : ''
  const secretary = m.secretary_id ? fullName(people[m.secretary_id]) : ''
  const extra = m.kind === 'extraordinary' ? 'извънредно ' : ''
  const rap = (it: Item) => it.rapporteur_id ? fullName(people[it.rapporteur_id]) : it.rapporteur_text
  const para = (s: string | null) => (s || '').split('\n').filter(x => x.trim()).map((x, i) => <p key={i} className="indent-8 text-justify">{x}</p>)

  const decisionBlock = (d: Decision) => (
    <div key={d.id} className="mt-2 mb-3">
      {d.kind !== 'noted' && <p className="indent-8 italic">{voteLine(d)}</p>}
      <p className="indent-8 font-bold mt-1">{BODY_DECIDES[m.body]} {d.kind === 'noted' ? 'ПРИЕ ЗА СВЕДЕНИЕ' : d.outcome === 'rejected' ? 'НЕ ПРИЕ' : 'РЕШИ'}:</p>
      <p className="pl-8 text-justify"><b>Решение № {nums[d.id]}:</b> {d.text || <span className="text-slate-400">…</span>}</p>
      {(d.responsible_id || d.due_date) && (
        <p className="pl-8 italic text-[0.92em]">
          {d.responsible_id && <>Отговорник: {fullName(people[d.responsible_id])}</>}{d.responsible_id && d.due_date && <span className="inline-block w-6" />}
          {d.due_date && <>Срок: {dmy(d.due_date)} г.</>}
        </p>
      )}
    </div>
  )

  return (
    <article className="protocol-paper mx-auto bg-white text-[15px] leading-[1.65] text-slate-900 shadow-[0_6px_30px_rgba(15,34,64,0.12)] print:shadow-none rounded-sm px-[8%] py-12 max-w-[820px]"
      style={{ fontFamily: '"Times New Roman", Times, serif' }}>
      <p className="text-center font-bold pb-1 border-b border-slate-900">{CENTER_NAME}</p>
      {m.status !== 'final' && <p className="text-center text-[12px] text-rose-700 mt-1 print:text-black">ПРОЕКТ — не е вписан в Книгата</p>}
      <h2 className="text-center text-2xl font-bold tracking-[0.2em] mt-8">ПРОТОКОЛ</h2>
      <p className="text-center">№ {m.meeting_no ?? '......'}</p>
      <p className="text-center font-bold mb-6">от {extra}заседание {BODY_OF[m.body]}</p>

      <p className="indent-8 text-justify">
        Днес, {dmy(m.meeting_date)} г.{m.start_time ? `, от ${hm(m.start_time)} ч.` : ''}{m.place ? `, в ${m.place}` : ''}, се проведе {extra}заседание {BODY_OF[m.body]}{m.title ? ` — „${m.title}“` : ''}.
      </p>
      <p className="indent-8 text-justify"><b>Присъстват:</b> {q.present} от общо {q.total} членове. {q.ok ? `Има необходимия кворум (${QUORUM_LABEL[m.quorum_rule]}) и заседанието е редовно.` : `Няма необходимия кворум (${QUORUM_LABEL[m.quorum_rule]}).`}</p>
      <p className="indent-8 text-justify"><b>Отсъстват:</b> {absent.length ? absent.map(a => `${attName(a, people)}${a.reason ? ` (${a.reason})` : ''}`).join('; ') + '.' : 'няма.'}</p>
      {late.length > 0 && <p className="indent-8"><b>Закъснели / напуснали по-рано:</b> {late.map(a => `${attName(a, people)} (${ATT_LABEL[a.status]}${a.reason ? `, ${a.reason}` : ''})`).join('; ')}.</p>}
      {others.length > 0 && <p className="indent-8 text-justify"><b>Присъстват още:</b> {others.map(a => `${attName(a, people)}${a.guest_role ? ` — ${a.guest_role}` : ''}${a.role === 'advisory' ? ' (със съвещателен глас)' : ''}`).join('; ')}.</p>}
      <p className="indent-8"><b>Председател:</b> {chair || '..............................'}<span className="inline-block w-8" /><b>Протоколчик:</b> {secretary || '..............................'}</p>
      {para(m.intro)}

      <p className="font-bold mt-6 mb-1">ДНЕВЕН РЕД:</p>
      <ol className="pl-8 space-y-0.5">
        {items.map((it, i) => <li key={it.id}>{i + 1}. {it.title || <span className="text-slate-400">…</span>}{rap(it) && <i className="text-[0.92em]">  Докладва: {rap(it)}</i>}</li>)}
      </ol>
      <p className="indent-8 italic mt-1 mb-4">Дневният ред беше приет единодушно.</p>

      {items.map((it, i) => (
        <section key={it.id} className="mt-5 break-inside-avoid-page">
          <p className="font-bold underline underline-offset-2">По т. {i + 1}. {it.title}</p>
          {rap(it) && <p className="indent-8">Докладва: {rap(it)}.</p>}
          {para(it.discussion)}
          {decisions.filter(d => d.item_id === it.id).sort((a, b) => a.sort - b.sort).map(decisionBlock)}
        </section>
      ))}
      {decisions.filter(d => !d.item_id || !items.some(i => i.id === d.item_id)).map(decisionBlock)}

      <p className="indent-8 mt-6">Поради изчерпване на дневния ред заседанието беше закрито{m.end_time ? ` в ${hm(m.end_time)} ч.` : '.'}</p>

      <div className="mt-12 space-y-6">
        <p>Протоколчик: ................................ <span className="ml-2">/{secretary || '..............................'}/</span></p>
        <p>{m.body === 'ps' ? 'Председател на ПС (директор)' : 'Председател'}: ................................ <span className="ml-2">/{chair || '..............................'}/</span></p>
        {m.body === 'ps' && <p className="pl-64 italic text-[0.9em]">(печат)</p>}
      </div>
    </article>
  )
}
