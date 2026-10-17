'use client'
// Студио за работни листове: избор на лист, ниво, обхват, тема и дете → преглед на A4 страниците → печат / PDF.
// Листовете са векторни (SVG) и се печатат остро; „Нов вариант“ дава нови числа и рисунки със същите настройки.

import { useEffect, useMemo, useRef, useState } from 'react'
import { Printer, Shuffle, Sparkles, Calculator, HeartHandshake, KeyRound, Copy } from 'lucide-react'
import { useToast } from '@/components/ui/Toast'
import { GENS, genById, gensForSkill, levelFor, presetFor, runGen, THEMES, LEVEL_LABEL, type Gen } from '@/lib/sheets'
import { SheetPage } from '@/lib/sheets/page'
import { Icon } from '@/lib/sheets/icons'

export type Rec = { code: string; title: string; part: 'math' | 'social'; level: number }

const GEN_ICON: Record<string, string> = {
  count: 'apple', match: 'star', compare: 'balloon', tenframe: 'ladybug', train: 'bus', add: 'strawberry', sub: 'cupcake', tens: 'pear',
  clock: 'clockIcon', money: 'basket', shop: 'gift', groups: 'flower', share: 'pumpkin', feelings: 'heart', steps: 'toothbrush', dayplan: 'sun', sos: 'phone', roles: 'hand',
}
const newSeed = () => Math.floor(Math.random() * 1e9)
const today = () => new Date().toLocaleDateString('bg-BG', { timeZone: 'Europe/Sofia', day: '2-digit', month: '2-digit', year: 'numeric' }).replace(/\s*г\.?$/, '')

export default function SheetsStudio({ kids, studentId, recs, init }: { kids: { id: string; name: string }[]; studentId: string; recs: Rec[]; init: { skill: string; level: number; gen: string } }) {
  const { toast } = useToast()
  // начален лист: от умението (бутона в програмата), от ?gen=, иначе „Преброй“
  const start = useMemo(() => {
    const g = (init.gen && genById(init.gen)) || (init.skill && gensForSkill(init.skill)[0]) || GENS[0]
    const pre = init.skill ? presetFor(g, init.skill) : {}
    return { g, level: init.skill ? levelFor(g, init.level) : g.levels[0], ...pre }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const [part, setPart] = useState<'math' | 'social'>(start.g.part)
  const [genId, setGenId] = useState(start.g.id)
  const gen = genById(genId) as Gen
  const [level, setLevel] = useState(start.level)
  const [range, setRange] = useState<number | undefined>(start.range)
  const [variant, setVariant] = useState<string | undefined>(start.variant)
  const [themeId, setThemeId] = useState(THEMES[0].id)
  const [count, setCount] = useState(1)
  const [answers, setAnswers] = useState(false)
  const [withDate, setWithDate] = useState(false)
  const [seed, setSeed] = useState(newSeed)
  const [kid, setKid] = useState(studentId)
  const [name, setName] = useState(kids.find(k => k.id === studentId)?.name || '')
  const preview = useRef<HTMLDivElement>(null)

  useEffect(() => { // шрифтът на листовете (кирилица, закръглен)
    const id = 'sheets-font'
    if (document.getElementById(id)) return
    const l = document.createElement('link'); l.id = id; l.rel = 'stylesheet'
    l.href = 'https://fonts.googleapis.com/css2?family=Nunito:wght@400;500;600;700;800;900&display=swap'
    document.head.appendChild(l)
  }, [])

  function pick(g: Gen, opts: { level?: number; range?: number; variant?: string } = {}) {
    setGenId(g.id); setPart(g.part)
    setLevel(opts.level && g.levels.includes(opts.level) ? opts.level : g.levels.includes(level) ? level : g.levels[0])
    setRange(opts.range); setVariant(opts.variant)
  }
  function fromRec(r: Rec, g: Gen) { pick(g, { level: levelFor(g, r.level), ...presetFor(g, r.code) }); setSeed(newSeed()) }

  const sheets = useMemo(() => Array.from({ length: count }, (_, i) => runGen(gen, { themeId, level, range, variant, seed: seed + i * 7919 })), [gen, themeId, level, range, variant, seed, count])
  const date = withDate ? today() : undefined

  function print() {
    const svgs = Array.from(preview.current?.querySelectorAll('svg.sheet') || []).map(s => s.outerHTML)
    const w = window.open('', '_blank')
    if (!w) { toast('Разрешете изскачащите прозорци за този сайт, за да се отвори печатът', 'error'); return }
    w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>${gen.title} — ${name || 'работен лист'}</title>
<link href="https://fonts.googleapis.com/css2?family=Nunito:wght@400;500;600;700;800;900&display=swap" rel="stylesheet">
<style>@page{size:A4;margin:0}html,body{margin:0;padding:0;background:#fff}svg{width:210mm;height:297mm;display:block;break-after:page;page-break-after:always}svg:last-child{break-after:auto;page-break-after:auto}</style></head>
<body>${svgs.join('')}<script>(document.fonts?document.fonts.ready:Promise.resolve()).then(function(){setTimeout(function(){window.print()},350)})<\/script></body></html>`)
    w.document.close()
  }

  const btn = (on: boolean) => `px-3 py-1.5 rounded-lg text-[13px] border transition ${on ? 'bg-[#0f2240] text-white border-[#0f2240]' : 'bg-white text-slate-700 border-slate-200 hover:border-slate-400'}`
  const label = 'block text-[11px] uppercase tracking-wider text-slate-400 mb-1.5'
  const recGens = recs.map(r => ({ r, gs: gensForSkill(r.code) })).filter(x => x.gs.length)

  return (
    <div>
      <header className="flex flex-wrap items-end gap-4 mb-5">
        <div className="flex-1 min-w-[240px]">
          <h1 className="text-xl md:text-2xl font-semibold text-slate-800 tracking-tight">Работни листове</h1>
          <p className="text-sm text-slate-500 mt-0.5">Тематични листове за печат — по умението и нивото на детето. Всеки „Нов вариант“ дава нови задачи.</p>
        </div>
        <button type="button" onClick={() => setSeed(newSeed())} className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-slate-300 bg-white text-sm text-slate-700 hover:bg-slate-50"><Shuffle size={15} /> Нов вариант</button>
        <button type="button" onClick={print} className="inline-flex items-center gap-2 px-5 py-2 rounded-xl text-sm font-medium text-white hover:opacity-90" style={{ backgroundColor: '#0f2240' }}><Printer size={15} /> Печат / PDF</button>
      </header>

      <div className="grid lg:grid-cols-[360px_1fr] gap-6 items-start">
        {/* ── настройки ── */}
        <aside className="space-y-4 lg:sticky lg:top-4">
          <section className="bg-white rounded-2xl border border-slate-200 p-4 space-y-3">
            <div>
              <span className={label}>За кого</span>
              <div className="flex gap-2">
                <select value={kid} onChange={e => { const k = kids.find(x => x.id === e.target.value); setKid(e.target.value); setName(k?.name || '') }}
                  className="flex-1 min-w-0 px-3 py-2 rounded-xl border border-slate-200 text-sm bg-white">
                  <option value="">— без дете —</option>
                  {kids.map(k => <option key={k.id} value={k.id}>{k.name}</option>)}
                </select>
              </div>
              <input value={name} onChange={e => setName(e.target.value)} placeholder="Име на листа (може и празно)"
                className="mt-2 w-full px-3 py-2 rounded-xl border border-slate-200 text-sm" />
              {kid && kid !== studentId && <a href={`/remelka/sheets?student=${kid}`} className="inline-block mt-1.5 text-[12px] text-indigo-700 hover:underline">Покажи листовете по програмата на детето →</a>}
            </div>
            {recGens.length > 0 && (
              <div>
                <span className={label}><Sparkles size={11} className="inline -mt-0.5 mr-1 text-indigo-500" />По програмата на детето</span>
                <div className="space-y-1.5 max-h-[230px] overflow-y-auto pr-1">
                  {recGens.map(({ r, gs }) => (
                    <div key={r.code} className="rounded-xl border border-indigo-100 bg-indigo-50/50 px-2.5 py-2">
                      <div className="text-[12.5px] text-slate-800"><span className="text-[11px] text-indigo-700 mr-1">{r.code}</span>{r.title} <span className="text-[11px] text-slate-400">· ниво {r.level}</span></div>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {gs.map(g => <button key={g.id} type="button" onClick={() => fromRec(r, g)}
                          className={`text-[11.5px] px-2 py-0.5 rounded-full border ${genId === g.id ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-indigo-800 border-indigo-200 hover:border-indigo-400'}`}>{g.title}</button>)}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </section>

          <section className="bg-white rounded-2xl border border-slate-200 p-4">
            <div className="inline-flex p-1 rounded-xl bg-slate-100 mb-3">
              {([['math', 'Смятане', Calculator], ['social', 'Социални умения', HeartHandshake]] as const).map(([p, l, I]) => (
                <button key={p} type="button" onClick={() => setPart(p)} className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[13px] ${part === p ? 'bg-white shadow-sm text-slate-800' : 'text-slate-500'}`}><I size={14} />{l}</button>
              ))}
            </div>
            <div className="grid grid-cols-2 gap-1.5">
              {GENS.filter(g => g.part === part).map(g => (
                <button key={g.id} type="button" onClick={() => { pick(g); setSeed(newSeed()) }} title={g.desc}
                  className={`flex items-center gap-2 text-left px-2 py-1.5 rounded-xl border transition ${genId === g.id ? 'border-[#0f2240] bg-slate-50 ring-1 ring-[#0f2240]' : 'border-slate-200 hover:border-slate-400'}`}>
                  <svg viewBox="0 0 100 100" className="w-8 h-8 shrink-0"><Icon id={GEN_ICON[g.id] || 'star'} x={0} y={0} s={100} /></svg>
                  <span className="text-[12.5px] leading-tight text-slate-800">{g.title}</span>
                </button>
              ))}
            </div>
            <p className="text-[12px] text-slate-500 mt-2.5 leading-snug">{gen.desc} · умения {gen.skills.join(', ')}</p>
          </section>

          <section className="bg-white rounded-2xl border border-slate-200 p-4 space-y-3.5">
            <div>
              <span className={label}>Ниво</span>
              <div className="flex flex-wrap gap-1.5">{gen.levels.map(l => <button key={l} type="button" onClick={() => setLevel(l)} className={btn(level === l)}>{LEVEL_LABEL[l]}</button>)}</div>
            </div>
            {gen.ranges && <div>
              <span className={label}>Обхват</span>
              <div className="flex flex-wrap gap-1.5">{gen.ranges.map(r => <button key={r.v} type="button" onClick={() => setRange(r.v)} className={btn((range ?? gen.ranges![Math.min(1, gen.ranges!.length - 1)].v) === r.v)}>{r.label}</button>)}</div>
            </div>}
            {gen.variants && <div>
              <span className={label}>Вид</span>
              <div className="flex flex-wrap gap-1.5">{gen.variants.map(v => <button key={v.v} type="button" onClick={() => setVariant(v.v)} className={btn((variant ?? gen.variants![0].v) === v.v)}>{v.label}</button>)}</div>
            </div>}
            {!gen.noTheme && <div>
              <span className={label}>Тема</span>
              <div className="grid grid-cols-4 gap-1.5">
                {THEMES.map(t => (
                  <button key={t.id} type="button" onClick={() => setThemeId(t.id)} title={t.label}
                    className={`flex flex-col items-center gap-0.5 py-1.5 rounded-xl border ${themeId === t.id ? 'ring-2' : 'border-slate-200 hover:border-slate-400'}`}
                    style={themeId === t.id ? { borderColor: t.color, background: t.soft, ['--tw-ring-color' as any]: t.color } : undefined}>
                    <svg viewBox="0 0 100 100" className="w-7 h-7"><Icon id={t.icons[0]} x={0} y={0} s={100} /></svg>
                    <span className="text-[10.5px] text-slate-600 leading-tight text-center px-0.5">{t.label}</span>
                  </button>
                ))}
              </div>
            </div>}
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2 pt-1">
              <label className="inline-flex items-center gap-2 text-[13px] text-slate-700"><Copy size={14} className="text-slate-400" />Листове
                <select value={count} onChange={e => setCount(Number(e.target.value))} className="px-2 py-1 rounded-lg border border-slate-200 text-[13px] bg-white">{[1, 2, 3, 4, 5].map(n => <option key={n} value={n}>{n}</option>)}</select>
              </label>
              <label className="inline-flex items-center gap-2 text-[13px] text-slate-700 cursor-pointer"><input type="checkbox" checked={answers} onChange={e => setAnswers(e.target.checked)} className="accent-[#0f2240]" /><KeyRound size={14} className="text-slate-400" />Отговори</label>
              <label className="inline-flex items-center gap-2 text-[13px] text-slate-700 cursor-pointer"><input type="checkbox" checked={withDate} onChange={e => setWithDate(e.target.checked)} className="accent-[#0f2240]" />Днешна дата</label>
            </div>
            <p className="text-[11.5px] text-slate-400 leading-snug">„Листове“ — няколко различни варианта наведнъж (за упражнение у дома или за повторение). Листът с отговорите е отделна страница накрая.</p>
          </section>
        </aside>

        {/* ── преглед ── */}
        <div ref={preview} className="space-y-6 [&_svg.sheet]:w-full [&_svg.sheet]:h-auto">
          {sheets.map((s, i) => (
            <div key={`q${i}`} className="mx-auto max-w-[760px] bg-white rounded-xl shadow-[0_4px_24px_rgba(15,34,64,0.12)] overflow-hidden">
              <SheetPage meta={s.meta} theme={s.theme} student={name || undefined} date={date}>{s.body(false)}</SheetPage>
            </div>
          ))}
          {answers && sheets.map((s, i) => (
            <div key={`a${i}`} className="mx-auto max-w-[760px] bg-white rounded-xl shadow-[0_4px_24px_rgba(15,34,64,0.12)] overflow-hidden">
              <SheetPage meta={s.meta} theme={s.theme} student={name || undefined} date={date} answers>{s.body(true)}</SheetPage>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
