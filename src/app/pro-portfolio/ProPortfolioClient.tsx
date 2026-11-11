'use client'
// Професионално портфолио — представяне (общи данни, философия, самоанализ), материали по раздели,
// квалификация (часове/кредити спрямо нормите), цели за развитие, данни от ЕИС, Word документ
// и (за управата) обобщение по служители и вписване на вътрешна квалификация за много хора наведнъж.
import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  BookUser, Plus, Pencil, Trash2, Paperclip, ExternalLink, Star, Lock, Users, ShieldCheck, FileDown, Loader2,
  GraduationCap, Target, Database, LayoutList, UserRound, Save, ArrowLeft, Images, FileSpreadsheet, Award,
  Briefcase, CheckCircle2, Circle, School,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useToast, confirmDialog } from '@/components/ui/Toast'
import DateInput from '@/components/ui/DateInput'
import { EDU_LEVELS, PKS_LEVELS, ATTEST_YEARS, addYears, dmy, todayIso } from '@/lib/evaluation'
import {
  SECTIONS, VIS, GOAL_STATUS, Q_KINDS, INTERNAL_MIN_YEAR, EXTERNAL_MIN_PERIOD, sectionMeta, qKindLabel, levelLabel,
  qualificationTotals, yearsSince, inPeriod, fmtNum, dateRange,
  type PPProfile, type PPItem, type PPGoal, type PPFile, type PPEvidence, type SectionKey, type Visibility, type Edu, type GoalStatus,
  fixEvidence, fillSteps, ymRange,
  type WorkYear, type Career, type Membership, type FillStep, type PPTraining,
} from '@/lib/pro-portfolio'
import ItemEditor, { type WallPost } from './ItemEditor'

type Year = { id: string; name: string; is_current: boolean; start_date: string | null; end_date: string | null }
type Staff = { id: string; first_name: string; middle_name?: string | null; last_name: string; role: string; position: string | null; email?: string; roleLabel: string }
type OverviewRow = { id: string; first_name: string; last_name: string; role: string; position: string | null; roleLabel: string; items: PPItem[]; profile: { pks: string | null; updated_at: string; philosophy: string | null } | null }
type Props = {
  me: { id: string; role: string }; isManager: boolean; isOwn: boolean; canEdit: boolean; tab: string
  staff: Staff; profile: PPProfile | null; items: PPItem[]; goals: PPGoal[]; posts: WallPost[]; classes: string[]
  years: Year[]; lastAttest: string | null; overview: OverviewRow[]
  /** работа в ЦСОП по години — от ЕИС */
  workYears: WorkYear[]
  /** регистър „Вътрешни обучения“ — само за управата в таба; null — SQL файлът не е пуснат */
  trainings: PPTraining[] | null
  people: { id: string; first_name: string; last_name: string; role: string; position: string | null }[]
}
type Tab = 'overview' | 'sections' | 'qual' | 'goals' | 'eis' | 'staff' | 'trainings'

const ACCENT = '#0f2240'
const fullName = (s: { first_name: string; middle_name?: string | null; last_name: string }) => [s.first_name, s.middle_name, s.last_name].filter(Boolean).join(' ')
const VIS_ICON: Record<Visibility, typeof Lock> = { private: Lock, managers: ShieldCheck, colleagues: Users }

export default function ProPortfolioClient(p: Props) {
  const router = useRouter()
  const tabs: { k: Tab; l: string; i: typeof LayoutList; show: boolean }[] = [
    { k: 'overview', l: 'Представяне', i: UserRound, show: true },
    { k: 'sections', l: 'Материали', i: LayoutList, show: true },
    { k: 'qual', l: 'Квалификация', i: GraduationCap, show: true },
    { k: 'goals', l: 'Цели за развитие', i: Target, show: p.isOwn || p.isManager },
    { k: 'eis', l: 'От ЕИС', i: Database, show: p.isOwn || p.isManager },
    { k: 'staff', l: 'Служители', i: Users, show: p.isManager },
    { k: 'trainings', l: 'Вътрешни обучения', i: GraduationCap, show: p.isManager },
  ]
  const tab: Tab = (tabs.find(t => t.k === p.tab && t.show)?.k) || 'overview'
  const go = (t: Tab) => router.push(`/pro-portfolio?${p.isOwn ? '' : `staff=${p.staff.id}&`}tab=${t}`)

  // Период: целият / атестационният (от последното атестиране, иначе 4 години назад) / учебна година
  const attestFrom = p.lastAttest || addYears(todayIso(), -ATTEST_YEARS)
  const [period, setPeriod] = useState<string>('all')
  const range = useMemo(() => {
    if (period === 'attest') return { from: attestFrom, to: todayIso(), label: `Атестационен период (${dmy(attestFrom)} – ${dmy(todayIso())})` }
    const y = p.years.find(x => x.id === period)
    if (y) return { from: y.start_date, to: y.end_date, label: `Учебна ${y.name} г.` }
    return { from: null as string | null, to: null as string | null, label: 'Цялото портфолио' }
  }, [period, attestFrom, p.years])
  const items = p.items.filter(i => inPeriod(i, range.from, range.to))

  const [editor, setEditor] = useState<{ item: PPItem | null; section?: SectionKey } | null>(null)
  const [exporting, setExporting] = useState(false)
  async function exportWord() {
    setExporting(true)
    try {
      let evidence: PPEvidence | null = null
      if (p.isOwn || p.isManager) {
        const { data } = await createClient().rpc('pp_evidence', { p_staff: p.staff.id, p_from: range.from || '2000-01-01', p_to: range.to || todayIso() })
        evidence = fixEvidence((data || null) as PPEvidence | null)
      }
      const { generatePortfolio } = await import('@/lib/docx-pro-portfolio')
      await generatePortfolio({ staff: { name: fullName(p.staff), position: p.staff.position || p.staff.roleLabel }, profile: p.profile, items, goals: p.goals, classes: p.classes, periodLabel: range.label, evidence })
    } finally { setExporting(false) }
  }

  return (
    <div className="p-4 md:p-8 max-w-6xl mx-auto">
      {!p.isOwn && <Link href={p.isManager ? '/pro-portfolio?tab=staff' : '/pro-portfolio'} className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800 mb-4"><ArrowLeft size={15} /> {p.isManager ? 'Към всички портфолиа' : 'Към моето портфолио'}</Link>}
      <header className="rounded-3xl bg-gradient-to-br from-[#0f2240] to-[#24497a] text-white p-6 md:p-7 mb-5 flex flex-wrap items-center gap-5">
        <div className="w-14 h-14 rounded-2xl bg-white/10 border border-white/15 flex items-center justify-center shrink-0"><BookUser size={26} /></div>
        <div className="min-w-0 flex-1">
          <div className="text-[12px] uppercase tracking-wide text-white/60">Професионално портфолио</div>
          <h1 className="text-xl md:text-2xl font-semibold">{fullName(p.staff)}</h1>
          <div className="text-sm text-white/70">{[p.staff.position || p.staff.roleLabel, p.profile?.pks && p.profile.pks !== 'няма' ? p.profile.pks : null].filter(Boolean).join(' · ')}</div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <select value={period} onChange={e => setPeriod(e.target.value)} className="px-3 py-2 rounded-xl bg-white/10 border border-white/20 text-sm text-white [&>option]:text-slate-800">
            <option value="all">Цялото портфолио</option>
            <option value="attest">Атестационен период</option>
            {p.years.slice(0, 8).map(y => <option key={y.id} value={y.id}>Учебна {y.name}</option>)}
          </select>
          <button type="button" onClick={exportWord} disabled={exporting} className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white text-[#0f2240] text-sm font-medium hover:bg-slate-100 disabled:opacity-60">
            {exporting ? <Loader2 size={15} className="animate-spin" /> : <FileDown size={15} />} Word
          </button>
          {p.canEdit && <button type="button" onClick={() => setEditor({ item: null })} className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-500 text-white text-sm font-medium hover:bg-emerald-600"><Plus size={15} /> Нов запис</button>}
        </div>
      </header>

      <nav className="flex gap-1.5 mb-5 overflow-x-auto pb-1">
        {tabs.filter(t => t.show).map(t => {
          const I = t.i
          return (
            <button key={t.k} type="button" onClick={() => go(t.k)}
              className={`shrink-0 inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-sm ${tab === t.k ? 'bg-[#0f2240] text-white' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'}`}>
              <I size={14} /> {t.l}
            </button>
          )
        })}
      </nav>

      {tab === 'overview' && <Overview {...p} items={items} rangeLabel={range.label} attestFrom={attestFrom} onAdd={s => setEditor({ item: null, section: s })} onOpen={() => go('sections')} onGo={go} />}
      {tab === 'sections' && <Sections {...p} items={items} onEdit={it => setEditor({ item: it })} onAdd={s => setEditor({ item: null, section: s })} />}
      {tab === 'qual' && <Qualification {...p} all={p.items} items={items} range={range} attestFrom={attestFrom} onEdit={it => setEditor({ item: it })} onAdd={() => setEditor({ item: null, section: 'qualification' })} />}
      {tab === 'goals' && <Goals {...p} />}
      {tab === 'eis' && <Eis staffId={p.staff.id} range={range} />}
      {tab === 'staff' && <StaffOverview rows={p.overview} years={p.years} />}
      {tab === 'trainings' && <Trainings rows={p.trainings} people={p.people} years={p.years} />}

      {editor && <ItemEditor staffId={p.staff.id} item={editor.item} section={editor.section} posts={p.posts}
        onClose={() => setEditor(null)} onSaved={() => { setEditor(null); router.refresh() }} />}
    </div>
  )
}

// ── Представяне ───────────────────────────────────────────────────────────
function Overview(p: Props & { items: PPItem[]; rangeLabel: string; attestFrom: string; onAdd: (s: SectionKey) => void; onOpen: () => void; onGo: (t: Tab) => void }) {
  const router = useRouter()
  const { toast } = useToast()
  const empty: PPProfile = {
    staff_id: p.staff.id, philosophy: '', about: '', education: [], specialty: '', teacher_q: null, other_q: '', pks: '', pks_year: null,
    work_since: null, teacher_since: null, years_extra: null, strengths: '', growth: '', visibility: 'managers',
  }
  const [f, setF] = useState<PPProfile>(() => ({ ...empty, ...(p.profile || {}), education: p.profile?.education || [] }))
  const [editing, setEditing] = useState(!p.profile && p.canEdit)
  const [busy, setBusy] = useState(false)
  const set = (patch: Partial<PPProfile>) => setF(x => ({ ...x, ...patch }))
  const setEdu = (i: number, patch: Partial<Edu>) => set({ education: f.education.map((e, j) => (j === i ? { ...e, ...patch } : e)) })
  async function save() {
    setBusy(true)
    // професионалният път, членството и мотото се записват отделно (CareerCard) — тук не ги пипаме
    const { updated_at: _u, career: _c, memberships: _m, motto: _mo, ...row } = f as any
    const { error } = await createClient().from('pp_profile').upsert({ ...row, staff_id: p.staff.id, updated_at: new Date().toISOString() })
    setBusy(false)
    if (error) { toast(error.message, 'error'); return }
    toast('Записано'); setEditing(false); router.refresh()
  }
  const today = todayIso()
  const yt = yearsSince(f.work_since, today, Number(f.years_extra?.total || 0))
  const yy = yearsSince(f.teacher_since, today, Number(f.years_extra?.teacher || 0))
  const t = qualificationTotals(p.items)
  const featured = p.items.filter(i => i.featured)
  const bySection = SECTIONS.map(s => ({ ...s, n: p.items.filter(i => i.section === s.key).length }))
  const [careerOpen, setCareerOpen] = useState(false)
  const steps = fillSteps(p.profile, p.items, p.goals, p.attestFrom)
  function doStep(s: FillStep) {
    if (s.action === 'edit') { setEditing(true); window.scrollTo({ top: 0, behavior: 'smooth' }) }
    else if (s.action === 'career') { setCareerOpen(true); document.getElementById('pp-career')?.scrollIntoView({ behavior: 'smooth' }) }
    else if (s.action === 'qual') p.onAdd('qualification')
    else if (s.action === 'sections') p.onOpen()
    else p.onGo('goals')
  }

  return (
    <div className="grid lg:grid-cols-3 gap-5">
      <div className="lg:col-span-2 space-y-5">
        {p.canEdit && <FillProgress steps={steps} onStep={doStep} own={p.isOwn} />}
        <section className="bg-white rounded-2xl border border-slate-200 p-5">
          <div className="flex items-center gap-2 mb-3">
            <h2 className="text-[15px] font-semibold text-slate-800 flex-1">Общи данни</h2>
            {p.canEdit && !editing && <button type="button" onClick={() => setEditing(true)} className="inline-flex items-center gap-1 text-[13px] text-indigo-700"><Pencil size={13} /> Редактирай</button>}
          </div>
          {!editing ? (
            <dl className="grid sm:grid-cols-2 gap-x-6 gap-y-2 text-[13px]">
              <Row l="Длъжност" v={p.staff.position || p.staff.roleLabel} />
              <Row l="Групи / паралелки (тази година)" v={p.classes.join(', ')} />
              <Row l="Образование" v={f.education.map(e => [e.level, e.specialty, e.qualification ? `ПК: ${e.qualification}` : null, e.school, e.year].filter(Boolean).join(', ')).join('; ')} />
              <Row l="Специалност (базово висше)" v={f.specialty || ''} />
              <Row l="ПК „учител“" v={f.teacher_q == null ? '' : f.teacher_q ? 'да' : 'не'} />
              <Row l="Друга квалификация" v={f.other_q || ''} />
              <Row l="ПКС" v={[f.pks, f.pks_year].filter(Boolean).join(', ')} />
              <Row l="Стаж — общ / учителски" v={yt != null || yy != null ? `${yt ?? '—'} / ${yy ?? '—'} г.` : ''} />
              {f.neispuo && <Row l={`По НЕИСПУО към ${f.neispuo.as_of.split('-').reverse().join('.')}`} v={[
                f.neispuo.credits != null ? `${f.neispuo.credits} квалификационни кредита` : null,
                f.neispuo.titular, f.neispuo.contract_basis,
              ].filter(Boolean).join(' · ')} />}
            </dl>
          ) : (
            <div className="space-y-3 text-[13px]">
              <div>
                <span className="label">Образование</span>
                {f.education.map((e, i) => (
                  <div key={i} className="grid grid-cols-12 gap-2 mb-2">
                    <select value={e.level} onChange={x => setEdu(i, { level: x.target.value })} className="input col-span-12 sm:col-span-3"><option value="">—</option>{EDU_LEVELS.map(l => <option key={l}>{l}</option>)}</select>
                    <input value={e.specialty || ''} onChange={x => setEdu(i, { specialty: x.target.value })} placeholder="специалност" className="input col-span-12 sm:col-span-4" />
                    <input value={e.school || ''} onChange={x => setEdu(i, { school: x.target.value })} placeholder="висше училище" className="input col-span-8 sm:col-span-3" />
                    <input type="number" value={e.year ?? ''} onChange={x => setEdu(i, { year: x.target.value ? Number(x.target.value) : null })} placeholder="година" className="input col-span-3 sm:col-span-1 px-2" />
                    <button type="button" onClick={() => set({ education: f.education.filter((_, j) => j !== i) })} className="col-span-1 text-slate-400 hover:text-rose-600" aria-label="Махни"><Trash2 size={14} /></button>
                  </div>
                ))}
                <button type="button" onClick={() => set({ education: [...f.education, { level: '' }] })} className="text-indigo-700 inline-flex items-center gap-1"><Plus size={13} /> Добави образование</button>
              </div>
              <div className="grid sm:grid-cols-2 gap-3">
                <label className="block"><span className="label">Специалност по базовото висше образование</span><input value={f.specialty || ''} onChange={e => set({ specialty: e.target.value })} className="input" /></label>
                <label className="block"><span className="label">Професионална квалификация „учител“</span>
                  <select value={f.teacher_q == null ? '' : f.teacher_q ? 'yes' : 'no'} onChange={e => set({ teacher_q: e.target.value === '' ? null : e.target.value === 'yes' })} className="input"><option value="">—</option><option value="yes">Да</option><option value="no">Не</option></select></label>
                <label className="block sm:col-span-2"><span className="label">Друга (нова / допълнителна) квалификация</span><input value={f.other_q || ''} onChange={e => set({ other_q: e.target.value })} className="input" /></label>
                <label className="block"><span className="label">Последна ПКС</span>
                  <div className="flex gap-2"><select value={f.pks || ''} onChange={e => set({ pks: e.target.value })} className="input"><option value="">—</option>{PKS_LEVELS.map(l => <option key={l}>{l}</option>)}</select>
                    <input type="number" value={f.pks_year ?? ''} onChange={e => set({ pks_year: e.target.value ? Number(e.target.value) : null })} placeholder="година" className="input w-28" /></div></label>
                <div />
                <label className="block"><span className="label">Начало на трудовия стаж</span><DateInput value={f.work_since || ''} onChange={v => set({ work_since: v || null })} /></label>
                <label className="block"><span className="label">Начало на учителския стаж</span><DateInput value={f.teacher_since || ''} onChange={v => set({ teacher_since: v || null })} /></label>
                <label className="block"><span className="label">Добави години общ стаж (прекъснат стаж)</span><input type="number" step="0.5" value={f.years_extra?.total ?? ''} onChange={e => set({ years_extra: { ...(f.years_extra || {}), total: e.target.value ? Number(e.target.value) : undefined } })} className="input" /></label>
                <label className="block"><span className="label">Добави години учителски стаж</span><input type="number" step="0.5" value={f.years_extra?.teacher ?? ''} onChange={e => set({ years_extra: { ...(f.years_extra || {}), teacher: e.target.value ? Number(e.target.value) : undefined } })} className="input" /></label>
              </div>
            </div>
          )}
        </section>

        <CareerCard {...p} open={careerOpen} setOpen={setCareerOpen} />
        {p.workYears.length > 0 && <WorkYears rows={p.workYears} />}

        <section className="bg-white rounded-2xl border border-slate-200 p-5 space-y-3">
          <h2 className="text-[15px] font-semibold text-slate-800">Представяне и самоанализ</h2>
          {editing ? (
            <div className="space-y-3 text-[13px]">
              <label className="block"><span className="label">Педагогическа философия — в какво вярвам, как работя</span><textarea rows={5} value={f.philosophy || ''} onChange={e => set({ philosophy: e.target.value })} className="input" /></label>
              <label className="block"><span className="label">Кратко професионално CV</span><textarea rows={4} value={f.about || ''} onChange={e => set({ about: e.target.value })} className="input" /></label>
              <div className="grid sm:grid-cols-2 gap-3">
                <label className="block"><span className="label">Силни страни</span><textarea rows={3} value={f.strengths || ''} onChange={e => set({ strengths: e.target.value })} className="input" /></label>
                <label className="block"><span className="label">Области за развитие</span><textarea rows={3} value={f.growth || ''} onChange={e => set({ growth: e.target.value })} className="input" /></label>
              </div>
              <label className="block"><span className="label">Кой вижда общите данни и представянето</span>
                <select value={f.visibility} onChange={e => set({ visibility: e.target.value as Visibility })} className="input">{(Object.keys(VIS) as Visibility[]).map(v => <option key={v} value={v}>{VIS[v].label} — {VIS[v].hint}</option>)}</select></label>
              <div className="flex gap-2">
                <button type="button" disabled={busy} onClick={save} className="btn-primary inline-flex items-center gap-1.5">{busy ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} Запази</button>
                {p.profile && <button type="button" onClick={() => { setF({ ...empty, ...p.profile!, education: p.profile!.education || [] }); setEditing(false) }} className="btn-secondary">Отказ</button>}
              </div>
            </div>
          ) : (
            <div className="space-y-3 text-[13.5px] text-slate-700">
              <Para l="Педагогическа философия" v={f.philosophy} />
              <Para l="Професионално CV" v={f.about} />
              <div className="grid sm:grid-cols-2 gap-4"><Para l="Силни страни" v={f.strengths} /><Para l="Области за развитие" v={f.growth} /></div>
              {!f.philosophy && !f.about && !f.strengths && !f.growth && <p className="text-slate-400">Още няма представяне.{p.canEdit ? ' Натиснете „Редактирай“ горе.' : ''}</p>}
            </div>
          )}
        </section>

        {featured.length > 0 && (
          <section className="bg-white rounded-2xl border border-slate-200 p-5">
            <h2 className="text-[15px] font-semibold text-slate-800 mb-3 flex items-center gap-1.5"><Star size={15} className="text-amber-500" /> Избрани материали</h2>
            <div className="grid sm:grid-cols-2 gap-3">{featured.map(i => <MiniItem key={i.id} i={i} />)}</div>
          </section>
        )}
      </div>

      <aside className="space-y-5">
        <section className="bg-white rounded-2xl border border-slate-200 p-5">
          <h2 className="text-[15px] font-semibold text-slate-800 mb-1">Раздели</h2>
          <p className="text-[12px] text-slate-500 mb-3">{p.rangeLabel}</p>
          <ul className="space-y-1.5 text-[13px]">
            {bySection.map(s => (
              <li key={s.key} className="flex items-center gap-2">
                <button type="button" onClick={p.onOpen} className="flex-1 text-left text-slate-700 hover:text-indigo-700">{s.label}</button>
                <span className={`min-w-6 text-center text-[11.5px] px-1.5 py-0.5 rounded-full ${s.n ? 'bg-indigo-50 text-indigo-700' : 'bg-slate-100 text-slate-400'}`}>{s.n}</span>
                {p.canEdit && <button type="button" onClick={() => p.onAdd(s.key)} className="p-0.5 text-slate-400 hover:text-emerald-600" aria-label={`Добави в ${s.label}`}><Plus size={14} /></button>}
              </li>
            ))}
          </ul>
        </section>
        <section className="bg-white rounded-2xl border border-slate-200 p-5 text-[13px] space-y-2">
          <h2 className="text-[15px] font-semibold text-slate-800">Квалификация · {p.rangeLabel.toLowerCase()}</h2>
          <div className="flex justify-between"><span className="text-slate-600">Вътрешноинституционална</span><b className="tabular-nums">{fmtNum(t.internal)} ч.</b></div>
          <div className="flex justify-between"><span className="text-slate-600">От обучаващи организации</span><b className="tabular-nums">{fmtNum(t.extHours)} ч.</b></div>
          <div className="flex justify-between"><span className="text-slate-600">Кредити</span><b className="tabular-nums">{fmtNum(t.credits)}</b></div>
        </section>
        {p.isOwn && (
          <section className="rounded-2xl border border-indigo-100 bg-indigo-50/60 p-5 text-[13px] text-indigo-900 space-y-2">
            <div className="flex items-center gap-1.5 font-medium"><Award size={15} /> За атестирането</div>
            <p>Когато започне атестиране, в „Оценяване → Моите карти“ изберете записи оттук като доказателства — и към конкретен критерий. Раздел А на картата се попълва с един бутон от общите данни и квалификацията.</p>
            <Link href="/attestation?tab=mine" className="inline-flex items-center gap-1 text-indigo-700 font-medium">Към моите карти →</Link>
          </section>
        )}
      </aside>
    </div>
  )
}

/** Колко е попълнено портфолиото — стъпки с бутон, който води направо до мястото */
function FillProgress({ steps, onStep, own }: { steps: FillStep[]; onStep: (s: FillStep) => void; own: boolean }) {
  const done = steps.filter(s => s.ok).length
  const pct = Math.round((done / steps.length) * 100)
  const [open, setOpen] = useState(pct < 100)
  return (
    <section className="bg-white rounded-2xl border border-slate-200 p-5">
      <button type="button" onClick={() => setOpen(o => !o)} className="w-full flex items-center gap-3 text-left">
        <span className="flex-1">
          <span className="block text-[15px] font-semibold text-slate-800">{pct === 100 ? 'Портфолиото е попълнено' : own ? 'Попълнете портфолиото си' : 'Попълване на портфолиото'}</span>
          <span className="block text-[12.5px] text-slate-500">{done} от {steps.length} стъпки · {own ? 'отнема около 15 минути, после само добавяте' : 'какво остава'}</span>
        </span>
        <span className="text-xl font-semibold tabular-nums" style={{ color: pct === 100 ? '#047857' : ACCENT }}>{pct}%</span>
      </button>
      <div className="mt-3 h-2 rounded-full bg-slate-100 overflow-hidden"><div className="h-full rounded-full bg-emerald-500 transition-all" style={{ width: `${pct}%` }} /></div>
      {open && (
        <ul className="mt-3 grid sm:grid-cols-2 gap-x-4 gap-y-1.5 text-[13px]">
          {steps.map(s => (
            <li key={s.k} className="flex items-start gap-2">
              {s.ok ? <CheckCircle2 size={16} className="text-emerald-600 shrink-0 mt-0.5" /> : <Circle size={16} className="text-slate-300 shrink-0 mt-0.5" />}
              <span className="flex-1 min-w-0">
                {s.ok ? <span className="text-slate-500">{s.l}</span>
                  : <button type="button" onClick={() => onStep(s)} className="text-left text-slate-800 hover:text-indigo-700">{s.l} <span className="text-indigo-700">→</span></button>}
                {!s.ok && <span className="block text-[11.5px] text-slate-400">{s.hint}</span>}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

/** Професионален път (история на длъжностите), членство в организации и мото — записват се отделно от общите данни */
function CareerCard(p: Props & { open: boolean; setOpen: (v: boolean) => void }) {
  const router = useRouter()
  const { toast } = useToast()
  const init = () => ({ career: (p.profile?.career || []) as Career[], memberships: (p.profile?.memberships || []) as Membership[], motto: p.profile?.motto || '' })
  const [d, setD] = useState(init)
  const [busy, setBusy] = useState(false)
  const since = p.profile?.neispuo?.since_year
  const setC = (i: number, patch: Partial<Career>) => setD(x => ({ ...x, career: x.career.map((c, j) => (j === i ? { ...c, ...patch } : c)) }))
  const setM = (i: number, patch: Partial<Membership>) => setD(x => ({ ...x, memberships: x.memberships.map((c, j) => (j === i ? { ...c, ...patch } : c)) }))
  function startEdit() {
    const fresh = init()
    // първия път — предложи реда за ЦСОП от НЕИСПУО
    if (!fresh.career.length) fresh.career = [{ from: since ? `${since}-09` : '', to: null, institution: 'ЦСОП – Варна', position: p.staff.position || p.staff.roleLabel }]
    setD(fresh); p.setOpen(true)
  }
  async function save() {
    const clean = {
      career: d.career.filter(c => c.institution.trim() || c.position.trim()).sort((a, b) => (b.from || '').localeCompare(a.from || '')),
      memberships: d.memberships.filter(m => m.org.trim()),
      motto: d.motto.trim() || null,
    }
    setBusy(true)
    const { error } = await createClient().from('pp_profile').upsert({ staff_id: p.staff.id, ...clean, updated_at: new Date().toISOString() })
    setBusy(false)
    if (error) { toast(/career|memberships|motto/.test(error.message) ? 'Пуснете SQL файла 2026-11-12_portfolio_career.sql' : error.message, 'error'); return }
    toast('Записано'); p.setOpen(false); router.refresh()
  }
  const career = p.profile?.career || [], memberships = p.profile?.memberships || []
  return (
    <section id="pp-career" className="bg-white rounded-2xl border border-slate-200 p-5">
      <div className="flex items-center gap-2 mb-3">
        <h2 className="text-[15px] font-semibold text-slate-800 flex-1 flex items-center gap-1.5"><Briefcase size={15} className="text-slate-400" /> Професионален път</h2>
        {p.canEdit && !p.open && <button type="button" onClick={startEdit} className="inline-flex items-center gap-1 text-[13px] text-indigo-700"><Pencil size={13} /> {career.length ? 'Редактирай' : 'Попълни'}</button>}
      </div>
      {!p.open ? (
        <div className="space-y-3 text-[13.5px]">
          {career.length ? (
            <ol className="relative border-l border-slate-200 ml-1.5 space-y-3">
              {career.map((c, i) => (
                <li key={i} className="ml-4">
                  <span className={`absolute -left-[5px] mt-1.5 w-2.5 h-2.5 rounded-full ${!c.to ? 'bg-emerald-500' : 'bg-slate-300'}`} />
                  <div className="text-slate-800">{c.position}</div>
                  <div className="text-[12.5px] text-slate-500">{c.institution} · {ymRange(c.from, c.to)}</div>
                </li>
              ))}
            </ol>
          ) : <p className="text-slate-400">Още не е попълнен.{p.canEdit ? ' Натиснете „Попълни“ — редът за ЦСОП е подготвен.' : ''}</p>}
          {memberships.length > 0 && (
            <div><div className="text-[12px] text-slate-500 mb-1">Членство в организации</div>
              <ul className="space-y-0.5">{memberships.map((m, i) => <li key={i}>{m.org}{m.role ? ` — ${m.role}` : ''} <span className="text-[12.5px] text-slate-500">({ymRange(m.from, m.to)})</span></li>)}</ul></div>
          )}
          {p.profile?.motto && <blockquote className="border-l-2 border-indigo-200 pl-3 italic text-slate-600">{p.profile.motto}</blockquote>}
        </div>
      ) : (
        <div className="space-y-4 text-[13px]">
          <div>
            <span className="label">Длъжности — от последната към първата</span>
            {d.career.map((c, i) => (
              <div key={i} className="grid grid-cols-12 gap-2 mb-2 items-center">
                <input value={c.position} onChange={e => setC(i, { position: e.target.value })} placeholder="длъжност" className="input col-span-12 sm:col-span-4" />
                <input value={c.institution} onChange={e => setC(i, { institution: e.target.value })} placeholder="училище / детска градина / център" className="input col-span-12 sm:col-span-4" />
                <input type="month" value={c.from || ''} onChange={e => setC(i, { from: e.target.value || null })} className="input col-span-5 sm:col-span-2 px-2" title="от" />
                <input type="month" value={c.to || ''} onChange={e => setC(i, { to: e.target.value || null })} className="input col-span-5 sm:col-span-1 px-1" title="до (празно — до сега)" />
                <button type="button" onClick={() => setD(x => ({ ...x, career: x.career.filter((_, j) => j !== i) }))} className="col-span-2 sm:col-span-1 text-slate-400 hover:text-rose-600 justify-self-center" aria-label="Махни"><Trash2 size={14} /></button>
              </div>
            ))}
            <button type="button" onClick={() => setD(x => ({ ...x, career: [...x.career, { from: '', to: '', institution: '', position: '' }] }))} className="text-indigo-700 inline-flex items-center gap-1"><Plus size={13} /> Добави длъжност</button>
            <p className="text-[11.5px] text-slate-400 mt-1">„до“ оставете празно за настоящата длъжност.</p>
          </div>
          <div>
            <span className="label">Членство в организации (синдикат, сдружения, асоциации)</span>
            {d.memberships.map((m, i) => (
              <div key={i} className="grid grid-cols-12 gap-2 mb-2 items-center">
                <input value={m.org} onChange={e => setM(i, { org: e.target.value })} placeholder="организация, напр. СБУ" className="input col-span-12 sm:col-span-5" />
                <input value={m.role || ''} onChange={e => setM(i, { role: e.target.value })} placeholder="роля (член, председател…)" className="input col-span-12 sm:col-span-3" />
                <input type="month" value={m.from || ''} onChange={e => setM(i, { from: e.target.value || null })} className="input col-span-5 sm:col-span-2 px-2" title="от" />
                <input type="month" value={m.to || ''} onChange={e => setM(i, { to: e.target.value || null })} className="input col-span-5 sm:col-span-1 px-1" title="до" />
                <button type="button" onClick={() => setD(x => ({ ...x, memberships: x.memberships.filter((_, j) => j !== i) }))} className="col-span-2 sm:col-span-1 text-slate-400 hover:text-rose-600 justify-self-center" aria-label="Махни"><Trash2 size={14} /></button>
              </div>
            ))}
            <button type="button" onClick={() => setD(x => ({ ...x, memberships: [...x.memberships, { org: '', role: 'член', from: '', to: '' }] }))} className="text-indigo-700 inline-flex items-center gap-1"><Plus size={13} /> Добави организация</button>
          </div>
          <label className="block"><span className="label">Любим цитат или мото (по желание)</span><input value={d.motto} onChange={e => setD(x => ({ ...x, motto: e.target.value }))} className="input" /></label>
          <div className="flex gap-2">
            <button type="button" disabled={busy} onClick={save} className="btn-primary inline-flex items-center gap-1.5">{busy ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} Запази</button>
            <button type="button" onClick={() => p.setOpen(false)} className="btn-secondary">Отказ</button>
          </div>
        </div>
      )}
    </section>
  )
}

/** Работа в ЦСОП по години — само от ЕИС, без писане */
function WorkYears({ rows }: { rows: WorkYear[] }) {
  return (
    <section className="bg-white rounded-2xl border border-slate-200 p-5">
      <h2 className="text-[15px] font-semibold text-slate-800 mb-1 flex items-center gap-1.5"><School size={15} className="text-slate-400" /> Работа в ЦСОП по години</h2>
      <p className="text-[12px] text-slate-500 mb-3">От ЕИС — паралелки като класен ръководител, групи ЦОУД и деца в ЕПЛР екипите.</p>
      <table className="w-full text-[13px]">
        <thead className="text-[12px] text-slate-500"><tr><th className="text-left font-normal py-1">Учебна година</th><th className="text-left font-normal py-1">Паралелки / групи</th><th className="text-right font-normal py-1">Деца в ЕПЛР</th></tr></thead>
        <tbody>
          {rows.map(r => (
            <tr key={r.year} className="border-t border-slate-100">
              <td className="py-1.5 pr-2 whitespace-nowrap text-slate-700">{r.year}</td>
              <td className="py-1.5 pr-2 text-slate-700">{[...r.classes.map(c => `паралелка ${c}`), ...r.coud.map(c => `ЦОУД ${c}`)].join(', ') || <span className="text-slate-400">—</span>}</td>
              <td className="py-1.5 text-right tabular-nums">{r.eplr || ''}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  )
}

function Row({ l, v }: { l: string; v: string }) {
  return <div><dt className="text-[11.5px] text-slate-500">{l}</dt><dd className="text-slate-800">{v || <span className="text-slate-300">—</span>}</dd></div>
}
function Para({ l, v }: { l: string; v: string | null }) {
  if (!v) return null
  return <div><div className="text-[11.5px] uppercase tracking-wide text-slate-400 mb-0.5">{l}</div><p className="whitespace-pre-line">{v}</p></div>
}

async function openFile(f: PPFile, toast: (m: string, t?: any) => void) {
  const { data, error } = await createClient().storage.from('pro-portfolio').createSignedUrl(f.path, 600)
  if (error || !data) { toast(error?.message || 'Файлът не може да се отвори', 'error'); return }
  window.open(data.signedUrl, '_blank')
}

function MiniItem({ i }: { i: PPItem }) {
  const m = sectionMeta(i.section)
  return (
    <div className="rounded-xl border border-slate-200 p-3">
      <span className={`inline-block text-[11px] px-1.5 py-0.5 rounded border ${m.tone}`}>{m.label}</span>
      <div className="mt-1 text-[13.5px] font-medium text-slate-800">{i.title}</div>
      <div className="text-[12px] text-slate-500">{dateRange(i.date_from, i.date_to)}</div>
    </div>
  )
}

// ── Материали ─────────────────────────────────────────────────────────────
function Sections(p: Props & { items: PPItem[]; onEdit: (i: PPItem) => void; onAdd: (s: SectionKey) => void }) {
  const [sec, setSec] = useState<SectionKey | 'all'>('all')
  const [q, setQ] = useState('')
  const needle = q.trim().toLowerCase()
  const shown = p.items.filter(i => (sec === 'all' || i.section === sec)
    && (!needle || [i.title, i.body, i.reflection, i.provider].join(' ').toLowerCase().includes(needle)))
  const groups = SECTIONS.filter(s => sec === 'all' || s.key === sec).map(s => ({ ...s, list: shown.filter(i => i.section === s.key) })).filter(g => g.list.length || sec === g.key)
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2 items-center">
        <select value={sec} onChange={e => setSec(e.target.value as any)} className="px-3 py-2 rounded-xl border border-slate-300 bg-white text-[13px]">
          <option value="all">Всички раздели ({p.items.length})</option>
          {SECTIONS.map(s => <option key={s.key} value={s.key}>{s.label} ({p.items.filter(i => i.section === s.key).length})</option>)}
        </select>
        <input value={q} onChange={e => setQ(e.target.value)} placeholder="Търси…" className="px-3 py-2 rounded-xl border border-slate-300 bg-white text-[13px] flex-1 min-w-[160px] max-w-xs" />
      </div>
      {!groups.length && <p className="bg-white rounded-2xl border border-slate-200 p-6 text-sm text-slate-400 text-center">Няма записи за избрания период.{p.canEdit ? ' Натиснете „Нов запис“.' : ''}</p>}
      {groups.map(g => (
        <section key={g.key} className="bg-white rounded-2xl border border-slate-200">
          <div className="flex items-center gap-2 px-5 py-3 border-b border-slate-100">
            <h2 className="text-[14.5px] font-semibold text-slate-800 flex-1">{g.label} <span className="text-slate-400 font-normal">· {g.list.length}</span></h2>
            {p.canEdit && <button type="button" onClick={() => p.onAdd(g.key)} className="inline-flex items-center gap-1 text-[13px] text-indigo-700"><Plus size={14} /> Добави</button>}
          </div>
          {!g.list.length && <p className="px-5 py-4 text-[13px] text-slate-400">{g.hint}</p>}
          <div className="divide-y divide-slate-100">{g.list.map(i => <ItemRow key={i.id} i={i} canEdit={p.canEdit} onEdit={() => p.onEdit(i)} />)}</div>
        </section>
      ))}
    </div>
  )
}

export function ItemRow({ i, canEdit, onEdit, compact }: { i: PPItem; canEdit?: boolean; onEdit?: () => void; compact?: boolean }) {
  const router = useRouter()
  const { toast } = useToast()
  const VI = VIS_ICON[i.visibility]
  async function remove() {
    if (!(await confirmDialog(`Да се изтрие ли „${i.title}“ заедно с файловете?`))) return
    const supabase = createClient()
    const paths = (i.files || []).map(f => f.path)
    if (paths.length) await supabase.storage.from('pro-portfolio').remove(paths)
    const { error } = await supabase.from('pp_items').delete().eq('id', i.id)
    if (error) { toast(error.message, 'error'); return }
    toast('Изтрито'); router.refresh()
  }
  const meta = [
    i.section === 'qualification' ? qKindLabel(i.kind) : levelLabel(i.level),
    i.part_role, i.provider,
    i.hours != null ? `${fmtNum(i.hours)} ч.` : null, i.credits != null ? `${fmtNum(i.credits)} кр.` : null,
    i.doc_no ? `№ ${i.doc_no}` : null,
  ].filter(Boolean).join(' · ')
  return (
    <div className="px-5 py-3.5 flex gap-3">
      <div className="w-20 shrink-0 text-[12px] text-slate-500 tabular-nums pt-0.5">{dateRange(i.date_from, i.date_to) || dmy(i.created_at)}</div>
      <div className="min-w-0 flex-1 text-[13px]">
        <div className="flex items-start gap-1.5">
          <span className="text-[14px] font-medium text-slate-800 flex-1">{i.featured && <Star size={13} className="inline -mt-0.5 mr-1 text-amber-500" />}{i.title}</span>
          <span title={VIS[i.visibility].label} className="text-slate-400 pt-0.5"><VI size={13} /></span>
          {canEdit && onEdit && <button type="button" onClick={onEdit} className="p-0.5 text-slate-400 hover:text-indigo-700" aria-label="Редактирай"><Pencil size={13} /></button>}
          {canEdit && <button type="button" onClick={remove} className="p-0.5 text-slate-400 hover:text-rose-600" aria-label="Изтрий"><Trash2 size={13} /></button>}
        </div>
        {meta && <div className="text-[12px] text-slate-500">{meta}</div>}
        {i.body && <p className={`mt-1 text-slate-700 whitespace-pre-line ${compact ? 'line-clamp-2' : ''}`}>{i.body}</p>}
        {i.reflection && !compact && <p className="mt-1 text-slate-600 italic whitespace-pre-line">„{i.reflection}“</p>}
        {(i.files?.length || i.url || i.post_id) ? (
          <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1">
            {(i.files || []).map(f => <button key={f.id} type="button" onClick={() => openFile(f, toast)} className="inline-flex items-center gap-1 text-indigo-700 hover:underline"><Paperclip size={12} />{f.name}</button>)}
            {i.url && <a href={i.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-indigo-700 hover:underline"><ExternalLink size={12} />линк</a>}
            {i.post_id && <Link href={`/portfolio?open=${i.post_id}`} className="inline-flex items-center gap-1 text-indigo-700 hover:underline"><Images size={12} />публикацията</Link>}
          </div>
        ) : null}
      </div>
    </div>
  )
}

// ── Квалификация ──────────────────────────────────────────────────────────
function Bar({ v, max, label }: { v: number; max: number; label: string }) {
  const pct = Math.min(100, Math.round((v / max) * 100))
  return (
    <div>
      <div className="flex justify-between text-[12.5px] mb-1"><span className="text-slate-600">{label}</span><b className={`tabular-nums ${v >= max ? 'text-emerald-700' : 'text-slate-800'}`}>{fmtNum(v)} / {max} ч.</b></div>
      <div className="h-2 rounded-full bg-slate-100 overflow-hidden"><div className={`h-full rounded-full ${v >= max ? 'bg-emerald-500' : 'bg-indigo-500'}`} style={{ width: `${pct}%` }} /></div>
    </div>
  )
}

function Qualification(p: Props & { all: PPItem[]; items: PPItem[]; range: { from: string | null; to: string | null; label: string }; attestFrom: string; onEdit: (i: PPItem) => void; onAdd: () => void }) {
  const cur = p.years.find(y => y.is_current)
  const yearT = qualificationTotals(p.items)
  const curT = cur ? qualificationTotals(p.all, cur.start_date, cur.end_date) : null
  const attT = qualificationTotals(p.all, p.attestFrom, todayIso())
  const list = p.items.filter(i => i.section === 'qualification')
  return (
    <div className="space-y-5">
      <div className="grid md:grid-cols-3 gap-4">
        <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-3">
          <div className="text-[13px] font-medium text-slate-800">Тази учебна година{cur ? ` (${cur.name})` : ''}</div>
          <Bar v={curT?.internal || 0} max={INTERNAL_MIN_YEAR} label="Вътрешноинституционална" />
        </div>
        <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-3">
          <div className="text-[13px] font-medium text-slate-800">Атестационен период · от {dmy(p.attestFrom)}</div>
          <Bar v={attT.extHours} max={EXTERNAL_MIN_PERIOD} label="От обучаващи организации" />
          <div className="text-[12.5px] text-slate-600">Кредити: <b className="tabular-nums">{fmtNum(attT.credits)}</b> от 3</div>
        </div>
        <div className="bg-white rounded-2xl border border-slate-200 p-5 text-[13px] space-y-1.5">
          <div className="font-medium text-slate-800">{p.range.label}</div>
          <div className="flex justify-between"><span>Вътрешна</span><b className="tabular-nums">{fmtNum(yearT.internal)} ч.</b></div>
          <div className="flex justify-between"><span>Външна</span><b className="tabular-nums">{fmtNum(yearT.extHours)} ч.</b></div>
          <div className="flex justify-between"><span>Кредити</span><b className="tabular-nums">{fmtNum(yearT.credits)}</b></div>
          <div className="flex justify-between"><span>Записи</span><b className="tabular-nums">{yearT.count}</b></div>
        </div>
      </div>
      <p className="text-[12px] text-slate-500">Нормите (Наредба № 15): поне 16 академични часа годишно вътрешноинституционална квалификация и поне 48 академични часа (3 кредита) от обучаващи организации за всеки атестационен период; 1 кредит = 16 академични часа.</p>
      <section className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
        <div className="flex items-center gap-2 px-5 py-3 border-b border-slate-100">
          <h2 className="text-[14.5px] font-semibold text-slate-800 flex-1">Обучения и квалификации · {list.length}</h2>
          {p.canEdit && <button type="button" onClick={p.onAdd} className="inline-flex items-center gap-1 text-[13px] text-indigo-700"><Plus size={14} /> Добави</button>}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-[13px]">
            <thead className="bg-slate-50 text-slate-500 text-left"><tr><th className="px-4 py-2">Дата</th><th className="px-4 py-2">Тема</th><th className="px-4 py-2">Вид</th><th className="px-4 py-2">Организация</th><th className="px-4 py-2 text-right">Часа</th><th className="px-4 py-2 text-right">Кредити</th><th className="px-4 py-2">Документ</th><th /></tr></thead>
            <tbody>
              {!list.length && <tr><td colSpan={8} className="px-4 py-6 text-center text-slate-400">Няма записани обучения за периода.</td></tr>}
              {list.map(i => (
                <tr key={i.id} className="border-t border-slate-100 align-top">
                  <td className="px-4 py-2 tabular-nums text-slate-500 whitespace-nowrap">{dateRange(i.date_from, i.date_to)}</td>
                  <td className="px-4 py-2 text-slate-800">{i.title}{i.training_id && <span className="ml-1.5 text-[11px] px-1.5 py-0.5 rounded-full bg-indigo-50 text-indigo-700" title="Вписано от ЦСОП в регистъра „Вътрешни обучения“">вписано от ЦСОП</span>}</td>
                  <td className="px-4 py-2 text-slate-600">{qKindLabel(i.kind)}</td>
                  <td className="px-4 py-2 text-slate-600">{i.provider}</td>
                  <td className="px-4 py-2 text-right tabular-nums">{fmtNum(i.hours)}</td>
                  <td className="px-4 py-2 text-right tabular-nums">{fmtNum(i.credits)}</td>
                  <td className="px-4 py-2 text-slate-600">{i.doc_no}{(i.files || []).length ? <Paperclip size={12} className="inline ml-1 text-slate-400" /> : null}</td>
                  <td className="px-2 py-2">{p.canEdit && <button type="button" onClick={() => p.onEdit(i)} className="p-1 text-slate-400 hover:text-indigo-700" aria-label="Редактирай"><Pencil size={13} /></button>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}

// ── Цели за развитие ──────────────────────────────────────────────────────
function Goals(p: Props) {
  const router = useRouter()
  const { toast } = useToast()
  const cur = p.years.find(y => y.is_current) || p.years[0]
  const [yearId, setYearId] = useState(cur?.id || '')
  const [draft, setDraft] = useState({ area: '', goal: '', actions: '', indicator: '', due: '' })
  const [busy, setBusy] = useState(false)
  const supabase = createClient()
  const canEdit = p.isOwn
  const list = p.goals.filter(g => (g.academic_year_id || '') === yearId)
  async function add() {
    if (!draft.goal.trim()) return
    setBusy(true)
    const { error } = await supabase.from('pp_goals').insert({ staff_id: p.staff.id, academic_year_id: yearId || null, area: draft.area || null, goal: draft.goal.trim(), actions: draft.actions || null, indicator: draft.indicator || null, due: draft.due || null, sort: list.length })
    setBusy(false)
    if (error) { toast(error.message, 'error'); return }
    setDraft({ area: '', goal: '', actions: '', indicator: '', due: '' }); router.refresh()
  }
  async function patch(g: PPGoal, x: Partial<PPGoal>) {
    const { error } = await supabase.from('pp_goals').update({ ...x, updated_at: new Date().toISOString() }).eq('id', g.id)
    if (error) { toast(error.message, 'error'); return }
    router.refresh()
  }
  async function remove(g: PPGoal) {
    if (!(await confirmDialog('Да се изтрие ли целта?'))) return
    const { error } = await supabase.from('pp_goals').delete().eq('id', g.id)
    if (error) { toast(error.message, 'error'); return }
    router.refresh()
  }
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <select value={yearId} onChange={e => setYearId(e.target.value)} className="px-3 py-2 rounded-xl border border-slate-300 bg-white text-[13px]">
          {p.years.map(y => <option key={y.id} value={y.id}>Учебна {y.name}</option>)}
        </select>
        <span className="text-[12.5px] text-slate-500">Конкретни, измерими и постижими цели — за развиващата функция на портфолиото.</span>
      </div>
      <div className="bg-white rounded-2xl border border-slate-200 divide-y divide-slate-100">
        {!list.length && <p className="p-6 text-sm text-slate-400 text-center">Няма цели за годината.</p>}
        {list.map(g => (
          <div key={g.id} className="px-5 py-3.5 text-[13px] space-y-1.5">
            <div className="flex items-start gap-2">
              <div className="flex-1">
                {g.area && <div className="text-[11.5px] uppercase tracking-wide text-slate-400">{g.area}</div>}
                <div className="text-[14px] font-medium text-slate-800">{g.goal}</div>
              </div>
              {canEdit
                ? <select value={g.status} onChange={e => patch(g, { status: e.target.value as GoalStatus })} className={`text-[12px] px-2 py-1 rounded-lg border-0 ${GOAL_STATUS[g.status].cls}`}>{(Object.keys(GOAL_STATUS) as GoalStatus[]).map(s => <option key={s} value={s}>{GOAL_STATUS[s].label}</option>)}</select>
                : <span className={`text-[12px] px-2 py-1 rounded-lg ${GOAL_STATUS[g.status].cls}`}>{GOAL_STATUS[g.status].label}</span>}
              {canEdit && <button type="button" onClick={() => remove(g)} className="p-1 text-slate-400 hover:text-rose-600" aria-label="Изтрий"><Trash2 size={13} /></button>}
            </div>
            {g.actions && <div className="text-slate-700"><b className="font-medium">Дейности:</b> {g.actions}</div>}
            {g.indicator && <div className="text-slate-700"><b className="font-medium">Индикатор:</b> {g.indicator}</div>}
            {g.due && <div className="text-slate-500">Срок: {dmy(g.due)}</div>}
            {canEdit
              ? <textarea defaultValue={g.reflection || ''} onBlur={e => e.target.value !== (g.reflection || '') && patch(g, { reflection: e.target.value || null })} rows={2} placeholder="Рефлексия — докъде стигнах (записва се, като излезете от полето)" className="input text-[13px]" />
              : g.reflection && <div className="text-slate-600 italic">{g.reflection}</div>}
          </div>
        ))}
      </div>
      {canEdit && (
        <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-3 text-[13px]">
          <div className="font-medium text-slate-800">Нова цел</div>
          <div className="grid md:grid-cols-3 gap-3">
            <label className="block"><span className="label">Област</span><input list="pp-areas" value={draft.area} onChange={e => setDraft({ ...draft, area: e.target.value })} className="input" />
              <datalist id="pp-areas">{['Работа с децата', 'Методи и подходи', 'Квалификация', 'Работа с родителите', 'Екипна работа', 'Дигитални умения', 'Изследвания и публикации'].map(a => <option key={a} value={a} />)}</datalist></label>
            <label className="block md:col-span-2"><span className="label">Цел</span><input value={draft.goal} onChange={e => setDraft({ ...draft, goal: e.target.value })} className="input" placeholder="напр. „Да въведа PECS фаза III с 3 деца до края на първия срок“" /></label>
            <label className="block md:col-span-2"><span className="label">Дейности</span><input value={draft.actions} onChange={e => setDraft({ ...draft, actions: e.target.value })} className="input" /></label>
            <label className="block"><span className="label">Срок</span><DateInput value={draft.due} onChange={v => setDraft({ ...draft, due: v })} /></label>
            <label className="block md:col-span-3"><span className="label">Индикатор за постигане</span><input value={draft.indicator} onChange={e => setDraft({ ...draft, indicator: e.target.value })} className="input" /></label>
          </div>
          <button type="button" disabled={busy || !draft.goal.trim()} onClick={add} className="btn-primary inline-flex items-center gap-1.5"><Plus size={14} /> Добави целта</button>
        </div>
      )}
    </div>
  )
}

// ── От ЕИС ────────────────────────────────────────────────────────────────
function Eis({ staffId, range }: { staffId: string; range: { from: string | null; to: string | null; label: string } }) {
  const [ev, setEv] = useState<PPEvidence | null>(null)
  const [err, setErr] = useState('')
  useEffect(() => {
    setEv(null); setErr('')
    createClient().rpc('pp_evidence', { p_staff: staffId, p_from: range.from || '2000-01-01', p_to: range.to || todayIso() })
      .then(({ data, error }) => { if (error) setErr(error.message); else setEv(fixEvidence(data as PPEvidence)) })
  }, [staffId, range.from, range.to])
  if (err) return <p className="bg-amber-50 border border-amber-200 text-amber-800 text-sm rounded-2xl px-4 py-3">Данните от ЕИС не могат да се заредят: {err}</p>
  if (!ev) return <p className="text-sm text-slate-400"><Loader2 size={14} className="inline animate-spin mr-1" />Зареждане…</p>
  return (
    <div className="space-y-5 text-[13px]">
      <p className="text-slate-500">Събрано автоматично от ЕИС за „{range.label.toLowerCase()}“ — не е нужно да се въвежда отново. Влиза в документа и е видимо за атестационната комисия.</p>
      <section className="bg-white rounded-2xl border border-slate-200 p-5">
        <h2 className="text-[14.5px] font-semibold text-slate-800 mb-2">Дейност</h2>
        <div className="flex flex-wrap gap-2">
          {ev.counts.filter(k => k.n).map(k => <span key={k.k} className="px-2.5 py-1 rounded-lg bg-slate-100 text-slate-700"><b className="tabular-nums">{k.n}</b> {k.l.toLowerCase()}</span>)}
          {!ev.counts.some(k => k.n) && <span className="text-slate-400">Няма записи за периода.</span>}
        </div>
      </section>
      <section className="bg-white rounded-2xl border border-slate-200 p-5">
        <h2 className="text-[14.5px] font-semibold text-slate-800 mb-2">Контролна дейност — силни страни и изводи ({ev.checks.length})</h2>
        {ev.checks.length ? ev.checks.map(k => (
          <div key={k.id} className="py-2 border-t border-slate-100 first:border-0">
            <div className="text-slate-800"><span className="tabular-nums text-slate-500">{dmy(k.date)}</span> · {k.subject} <span className="text-slate-400">· {k.inspector}</span></div>
            {k.strengths && <div className="text-slate-600"><b className="font-medium">Силни страни:</b> {k.strengths}</div>}
            {k.conclusions && <div className="text-slate-600"><b className="font-medium">Изводи:</b> {k.conclusions}</div>}
          </div>
        )) : <p className="text-slate-400">Няма подписани протоколи за периода.</p>}
      </section>
      <section className="bg-white rounded-2xl border border-slate-200 p-5">
        <h2 className="text-[14.5px] font-semibold text-slate-800 mb-2">Оценки (ДТВ, атестиране)</h2>
        {ev.evals.length ? ev.evals.map((e, i) => <div key={i} className="text-slate-700">{e.name}: <b className="tabular-nums">{e.kind === 'attest' ? `${fmtNum(e.result)} — ${e.grade || ''}` : `${fmtNum(e.total)} т.`}</b></div>) : <p className="text-slate-400">Няма оценки за периода.</p>}
      </section>
    </div>
  )
}

// ── Служители (управата) ──────────────────────────────────────────────────
function StaffOverview({ rows, years }: { rows: OverviewRow[]; years: Year[] }) {
  const router = useRouter()
  const cur = years.find(y => y.is_current)
  const from4 = addYears(todayIso(), -ATTEST_YEARS)
  const data = rows.map(r => {
    const y = cur ? qualificationTotals(r.items, cur.start_date, cur.end_date) : { internal: 0 }
    const a = qualificationTotals(r.items, from4, todayIso())
    const last = [r.profile?.updated_at, ...r.items.map(i => i.updated_at)].filter(Boolean).sort().reverse()[0] || null
    return { r, internal: y.internal, ext: a.extHours, credits: a.credits, n: r.items.length, last }
  })
  async function excel() {
    const XLSX = await import('xlsx')
    const ws = XLSX.utils.json_to_sheet(data.map(d => ({
      'Служител': `${d.r.first_name} ${d.r.last_name}`, 'Длъжност': d.r.position || d.r.roleLabel, 'ПКС': d.r.profile?.pks || '',
      'Записи': d.n, [`Вътрешна квалификация ${cur?.name || ''} (ч.)`]: d.internal, 'Външна за 4 г. (ч.)': d.ext, 'Кредити за 4 г.': d.credits,
      'Последна промяна': d.last ? dmy(d.last) : '',
    })))
    const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, 'Портфолиа')
    XLSX.writeFile(wb, `Портфолиа_квалификация_${todayIso()}.xlsx`)
  }
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2 items-center">
        <span className="text-[13px] text-slate-500 flex-1">Педагогическите специалисти и докъде са с портфолиото и квалификацията. Записите „само за мен“ не се виждат.</span>
        <button type="button" onClick={() => router.push('/pro-portfolio?tab=trainings')} className="btn-secondary inline-flex items-center gap-1.5"><GraduationCap size={15} /> Вътрешни обучения</button>
        <button type="button" onClick={excel} className="btn-secondary inline-flex items-center gap-1.5"><FileSpreadsheet size={15} /> Excel</button>
      </div>
      <div className="bg-white rounded-2xl border border-slate-200 overflow-x-auto">
        <table className="w-full text-[13px]">
          <thead className="bg-slate-50 text-slate-500 text-left"><tr>
            <th className="px-4 py-2">Служител</th><th className="px-4 py-2">ПКС</th><th className="px-4 py-2 text-right">Записи</th>
            <th className="px-4 py-2 text-right" title={`поне ${INTERNAL_MIN_YEAR} ч. годишно`}>Вътрешна {cur?.name || ''}</th>
            <th className="px-4 py-2 text-right" title={`поне ${EXTERNAL_MIN_PERIOD} ч. за 4 години`}>Външна · 4 г.</th>
            <th className="px-4 py-2 text-right">Кредити</th><th className="px-4 py-2">Обновено</th>
          </tr></thead>
          <tbody>
            {data.map(d => (
              <tr key={d.r.id} onClick={() => router.push(`/pro-portfolio?staff=${d.r.id}`)} className="border-t border-slate-100 hover:bg-slate-50 cursor-pointer">
                <td className="px-4 py-2"><div className="text-slate-800">{d.r.first_name} {d.r.last_name}</div><div className="text-[11.5px] text-slate-500">{d.r.position || d.r.roleLabel}</div></td>
                <td className="px-4 py-2 text-slate-600">{d.r.profile?.pks || ''}</td>
                <td className="px-4 py-2 text-right tabular-nums">{d.n}</td>
                <td className={`px-4 py-2 text-right tabular-nums ${d.internal >= INTERNAL_MIN_YEAR ? 'text-emerald-700' : 'text-amber-700'}`}>{fmtNum(d.internal)}</td>
                <td className={`px-4 py-2 text-right tabular-nums ${d.ext >= EXTERNAL_MIN_PERIOD ? 'text-emerald-700' : 'text-amber-700'}`}>{fmtNum(d.ext)}</td>
                <td className="px-4 py-2 text-right tabular-nums">{fmtNum(d.credits)}</td>
                <td className="px-4 py-2 text-slate-500 tabular-nums">{d.last ? dmy(d.last) : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

/** Управата вписва една вътрешноинституционална квалификация на много служители наведнъж. */

// ── Вътрешни обучения (управата) ─────────────────────────────────────────
type TPerson = Props['people'][number]
const tName = (x: TPerson) => `${x.first_name} ${x.last_name}`
/** Регистър на вътрешните обучения: вписва се веднъж — появява се в портфолиото на всеки участник. */
function Trainings({ rows, people, years }: { rows: PPTraining[] | null; people: TPerson[]; years: Year[] }) {
  const router = useRouter()
  const { toast } = useToast()
  const cur = years.find(y => y.is_current)
  const [yearId, setYearId] = useState(cur?.id || '')
  const [edit, setEdit] = useState<PPTraining | 'new' | null>(null)
  if (!rows) return <p className="bg-amber-50 border border-amber-200 text-amber-800 text-sm rounded-2xl px-4 py-3">Пуснете SQL файла 2026-11-12_portfolio_trainings.sql — тогава тук ще е регистърът на вътрешните обучения.</p>
  const y = years.find(x => x.id === yearId)
  const list = rows.filter(t => !y || ((!y.start_date || t.date_from >= y.start_date) && (!y.end_date || t.date_from <= y.end_date)))
  const hours = list.reduce((s, t) => s + Number(t.hours || 0), 0)
  async function del(t: PPTraining) {
    if (!(await confirmDialog(`Да се изтрие ли „${t.title}“? Ще изчезне и от портфолиата на ${t.staff.length} участници.`))) return
    const { error } = await createClient().from('pp_trainings').delete().eq('id', t.id)
    if (error) { toast(error.message, 'error'); return }
    toast('Изтрито'); router.refresh()
  }
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2 items-center">
        <span className="text-[13px] text-slate-500 flex-1 min-w-[240px]">Вписвате обучението веднъж — с часовете и участниците — и то се появява в професионалното портфолио на всеки участник (раздел „Квалификация“). Промяната обновява всички.</span>
        <select value={yearId} onChange={e => setYearId(e.target.value)} className="input w-auto">
          <option value="">Всички години</option>{years.map(x => <option key={x.id} value={x.id}>{x.name}</option>)}
        </select>
        <button type="button" onClick={() => setEdit('new')} className="btn-primary inline-flex items-center gap-1.5" style={{ backgroundColor: ACCENT }}><Plus size={15} /> Ново обучение</button>
      </div>
      <p className="text-[13px] text-slate-600">{list.length} обучения · {fmtNum(hours)} академични часа{y ? ` през ${y.name}` : ''}</p>
      <div className="bg-white rounded-2xl border border-slate-200 divide-y divide-slate-100">
        {list.map(t => (
          <div key={t.id} className="flex flex-wrap items-center gap-3 px-4 py-2.5 text-[13px]">
            <span className="w-28 tabular-nums text-slate-600">{dateRange(t.date_from, t.date_to)}</span>
            <span className="flex-1 min-w-[200px]"><span className="block text-slate-800">{t.title}</span>
              <span className="block text-[12px] text-slate-500">{[t.lecturer, t.provider].filter(Boolean).join(' · ')}</span></span>
            <span className="tabular-nums text-slate-700">{t.hours != null ? `${fmtNum(t.hours)} ч.` : ''}</span>
            <span className="text-[12px] px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700">{t.staff.length} участници</span>
            <button type="button" onClick={() => setEdit(t)} className="p-1 text-slate-400 hover:text-indigo-700" aria-label="Редактирай"><Pencil size={14} /></button>
            <button type="button" onClick={() => del(t)} className="p-1 text-slate-400 hover:text-rose-600" aria-label="Изтрий"><Trash2 size={14} /></button>
          </div>
        ))}
        {!list.length && <p className="p-6 text-sm text-slate-400 text-center">Няма вписани обучения{y ? ` за ${y.name}` : ''}.</p>}
      </div>
      {edit && <TrainingEditor t={edit === 'new' ? null : edit} people={people} onClose={() => setEdit(null)} />}
    </div>
  )
}

function TrainingEditor({ t, people, onClose }: { t: PPTraining | null; people: TPerson[]; onClose: () => void }) {
  const router = useRouter()
  const { toast } = useToast()
  const [f, setF] = useState({
    title: t?.title || '', date_from: t?.date_from || todayIso(), date_to: t?.date_to || '', hours: t?.hours != null ? String(t.hours) : '',
    lecturer: t?.lecturer || '', provider: t?.provider || 'ЦСОП – Варна', kind: t?.kind || 'internal',
  })
  const [sel, setSel] = useState<Set<string>>(new Set(t?.staff || []))
  const [q, setQ] = useState('')
  const [busy, setBusy] = useState(false)
  const toggle = (id: string) => setSel(s => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n })
  const shown = people.filter(x => !q.trim() || tName(x).toLowerCase().includes(q.trim().toLowerCase()))
  async function save() {
    if (!f.title.trim() || !f.date_from) { toast('Напишете тема и дата', 'error'); return }
    if (!sel.size) { toast('Изберете участниците', 'error'); return }
    setBusy(true)
    const sb = createClient()
    const row = {
      title: f.title.trim(), date_from: f.date_from, date_to: f.date_to || null, hours: f.hours ? Number(f.hours.replace(',', '.')) : null,
      lecturer: f.lecturer.trim() || null, provider: f.provider.trim() || null, kind: f.kind, updated_at: new Date().toISOString(),
    }
    const res = t ? await sb.from('pp_trainings').update(row).eq('id', t.id).select('id').single() : await sb.from('pp_trainings').insert(row).select('id').single()
    if (res.error || !res.data) { setBusy(false); toast(res.error?.message || 'Грешка', 'error'); return }
    const id = res.data.id as string
    // записите в портфолиата: нови участници — добавят се; махнатите — изтриват се; останалите — обновяват се
    const item = { section: 'qualification', kind: f.kind, title: row.title, date_from: row.date_from, date_to: row.date_to, hours: row.hours,
      provider: [row.lecturer, row.provider].filter(Boolean).join(', ') || null }
    const before = new Set(t?.staff || [])
    const add = Array.from(sel).filter(s => !before.has(s)), remove = Array.from(before).filter(s => !sel.has(s))
    const ops = [
      add.length ? sb.from('pp_items').insert(add.map(staff_id => ({ ...item, staff_id, training_id: id, visibility: 'managers' }))) : null,
      remove.length ? sb.from('pp_items').delete().eq('training_id', id).in('staff_id', remove) : null,
      t ? sb.from('pp_items').update(item).eq('training_id', id) : null,
    ].filter(Boolean)
    const results = await Promise.all(ops as any[])
    setBusy(false)
    const err = results.find((r: any) => r?.error)?.error
    if (err) { toast(err.message, 'error'); return }
    toast(t ? 'Обновено' : `Вписано на ${sel.size} участници`); onClose(); router.refresh()
  }
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[92vh] overflow-y-auto p-5 space-y-3 text-[13px]">
        <h2 className="text-base font-semibold text-slate-800">{t ? 'Обучение' : 'Ново вътрешно обучение'}</h2>
        <label className="block"><span className="label">Тема</span><input autoFocus value={f.title} onChange={e => setF({ ...f, title: e.target.value })} className="input" placeholder="напр. Приложен поведенчески анализ — 1-ва част" /></label>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <label className="block"><span className="label">От</span><DateInput value={f.date_from} onChange={v => setF({ ...f, date_from: v })} /></label>
          <label className="block"><span className="label">До (по желание)</span><DateInput value={f.date_to} onChange={v => setF({ ...f, date_to: v })} /></label>
          <label className="block"><span className="label">Акад. часа</span><input inputMode="decimal" value={f.hours} onChange={e => setF({ ...f, hours: e.target.value })} className="input" /></label>
          <label className="block"><span className="label">Вид</span><select value={f.kind} onChange={e => setF({ ...f, kind: e.target.value })} className="input">
            {Q_KINDS.filter(k => ['internal', 'external', 'self'].includes(k.key)).map(k => <option key={k.key} value={k.key}>{k.label}</option>)}</select></label>
        </div>
        <div className="grid sm:grid-cols-2 gap-3">
          <label className="block"><span className="label">Лектор / водещ</span><input value={f.lecturer} onChange={e => setF({ ...f, lecturer: e.target.value })} className="input" /></label>
          <label className="block"><span className="label">Организатор</span><input value={f.provider} onChange={e => setF({ ...f, provider: e.target.value })} className="input" /></label>
        </div>
        <div>
          <div className="flex flex-wrap items-center gap-2 mb-1">
            <span className="label flex-1 mb-0">Участници ({sel.size})</span>
            <input value={q} onChange={e => setQ(e.target.value)} placeholder="Търси" className="input w-40 py-1" />
            <button type="button" onClick={() => setSel(new Set(people.map(x => x.id)))} className="text-indigo-700">всички</button>
            <button type="button" onClick={() => setSel(new Set())} className="text-slate-500">никой</button>
          </div>
          <div className="max-h-64 overflow-y-auto rounded-xl border border-slate-200 grid sm:grid-cols-2">
            {shown.map(x => (
              <label key={x.id} className="flex items-center gap-2 px-3 py-1.5 hover:bg-slate-50 cursor-pointer">
                <input type="checkbox" checked={sel.has(x.id)} onChange={() => toggle(x.id)} />
                <span className="truncate">{tName(x)} <span className="text-[11.5px] text-slate-400">{x.position || ''}</span></span>
              </label>
            ))}
          </div>
        </div>
        <div className="flex justify-end gap-2 pt-1">
          <button type="button" onClick={onClose} className="btn-secondary">Отказ</button>
          <button type="button" disabled={busy} onClick={save} className="btn-primary inline-flex items-center gap-1.5" style={{ backgroundColor: ACCENT }}>{busy && <Loader2 size={14} className="animate-spin" />} Запази</button>
        </div>
      </div>
    </div>
  )
}
