'use client'

// Генератор на табла: колегата избира вид, подрежда картинките (пиктограми или свои снимки),
// вижда превю на живо и получава PDF за печат — или го запазва в библиотеката „Материали“.
// Черновата се пази в браузъра (за всеки вид поотделно).

import { useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { saveAs } from 'file-saver'
import {
  Download, Printer, Library, Plus, ImagePlus, Trash2, ChevronUp, ChevronDown, Loader2, X, RotateCcw,
  LayoutGrid, ArrowRight, ListChecks, Star, ListOrdered, BookOpen, BookHeart, MousePointerClick,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useToast } from '@/components/ui/Toast'
import { pictoUrl } from '@/lib/pictos'
import PictoPicker from '@/components/pictos/PictoPicker'
import type { Picked } from '@/components/pictos/PictoPicker'
import { AREAS } from '../../students/[id]/development/lib'
import { TYPES, COLORS, SIZES, render } from './boards'
import type { Board, BoardType, Pic } from './boards'
import { CanvasPainter, PdfPainter, loadCanvasFonts, pictoImg, photoImg, fileToDataUrl } from './painter'
import type { Img } from './painter'

const ICONS: Record<BoardType, React.ReactNode> = {
  cards: <LayoutGrid size={18} />, 'first-then': <ArrowRight size={18} />, 'now-next': <ListOrdered size={18} />,
  choice: <MousePointerClick size={18} />, token: <Star size={18} />, sequence: <ListChecks size={18} />,
  story: <BookOpen size={18} />, 'pecs-book': <BookHeart size={18} />,
}
const ORDER: BoardType[] = ['first-then', 'now-next', 'choice', 'cards', 'token', 'sequence', 'story', 'pecs-book']
const DRAFT = 'gen-drafts-v1'

function fresh(type: BoardType): Board {
  return { type, title: '', who: '', color: COLORS[0], pics: [], size: 'mid', labels: true, copies: 1, tokens: 5, ...TYPES[type].defaults() }
}

async function prepare(b: Board) {
  const map = new Map<Pic, Img>()
  await Promise.all(b.pics.map(async pc => {
    try {
      const im = pc.photo ? await photoImg(pc.photo) : pc.key ? await pictoImg(pc.key) : undefined
      if (im) map.set(pc, im)
    } catch { /* липсваща картинка — празно място */ }
  }))
  const [me, want, talk] = await Promise.all(['me', 'want', 'talk'].map(k => pictoImg(k).catch(() => undefined)))
  return { imgs: (pc: Pic) => map.get(pc), extra: { me, want, talk } }
}

export default function MakeClient({ meId, ownSourceId }: { meId: string; ownSourceId: string | null }) {
  const { toast } = useToast()
  const [drafts, setDrafts] = useState<Partial<Record<BoardType, Board>>>({})
  const [type, setType] = useState<BoardType>('first-then')
  const [ready, setReady] = useState(false)
  const [pages, setPages] = useState<{ src: string; land: boolean }[]>([])
  const [rendering, setRendering] = useState(false)
  const [picker, setPicker] = useState<{ index: number | null } | null>(null)   // null index = добавяне
  const [busy, setBusy] = useState<'' | 'pdf' | 'print'>('')
  const [saving, setSaving] = useState(false)
  const photoInput = useRef<HTMLInputElement>(null)

  useEffect(() => {
    try {
      const d = JSON.parse(localStorage.getItem(DRAFT) || '{}')
      if (d.drafts) setDrafts(d.drafts)
      if (d.type && TYPES[d.type as BoardType]) setType(d.type)
    } catch { /* без чернова */ }
    setReady(true)
  }, [])

  const board: Board = drafts[type] || fresh(type)
  const meta = TYPES[type]

  function update(patch: Partial<Board>) {
    const next = { ...drafts, [type]: { ...board, ...patch } }
    setDrafts(next)
    try { localStorage.setItem(DRAFT, JSON.stringify({ type, drafts: next })) } catch { /* пълна памет — продължаваме без чернова */ }
  }
  function chooseType(t: BoardType) {
    setType(t)
    try { localStorage.setItem(DRAFT, JSON.stringify({ type: t, drafts })) } catch { /* */ }
  }
  function setPic(i: number, patch: Partial<Pic>) {
    const a = board.pics.slice()
    while (a.length <= i) a.push({ label: '' })
    a[i] = { ...a[i], ...patch }
    update({ pics: a })
  }
  function move(i: number, d: number) {
    const a = board.pics.slice(); const j = i + d
    if (j < 0 || j >= a.length) return
    ;[a[i], a[j]] = [a[j], a[i]]
    update({ pics: a })
  }
  function remove(i: number) { update({ pics: board.pics.filter((_, k) => k !== i) }) }
  function picked(p: Picked) {
    if (picker?.index != null) setPic(picker.index, { key: p.key, photo: p.photo, label: p.label })
    else setDrafts(prev => {
      const cur = prev[type] || fresh(type)
      if (cur.pics.length >= meta.max) return prev
      const next = { ...prev, [type]: { ...cur, pics: [...cur.pics, { key: p.key, photo: p.photo, label: p.label, text: meta.withText ? '' : undefined }] } }
      try { localStorage.setItem(DRAFT, JSON.stringify({ type, drafts: next })) } catch { /* */ }
      return next
    })
  }
  async function addPhoto(f: File | undefined) {
    if (!f) return
    const photo = await fileToDataUrl(f)
    picked({ photo, label: '' })
  }

  // превю на живо
  const sig = useMemo(() => JSON.stringify(board), [board])
  useEffect(() => {
    if (!ready) return
    let stop = false
    setRendering(true)
    const t = setTimeout(async () => {
      try {
        await loadCanvasFonts()
        const { imgs, extra } = await prepare(board)
        if (stop) return
        const P = new CanvasPainter(2.4)
        render(P, board, imgs, extra)
        setPages(P.canvases.map(c => ({ src: c.toDataURL('image/jpeg', 0.85), land: c.width > c.height })))
      } finally { if (!stop) setRendering(false) }
    }, 250)
    return () => { stop = true; clearTimeout(t) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sig, ready])

  async function makePdf(b: Board) {
    const P = await PdfPainter.create()
    const { imgs, extra } = await prepare(b)
    render(P, b, imgs, extra)
    return P
  }
  const fileName = (b: Board) => `${(b.title || meta.label).replace(/[\\/:*?"<>|]/g, '')}${b.who ? ' — ' + b.who : ''}.pdf`

  async function download() {
    setBusy('pdf')
    try { saveAs((await makePdf(board)).blob(), fileName(board)) } catch (e: any) { toast(e?.message || 'PDF не се създаде', 'error') } finally { setBusy('') }
  }
  async function print() {
    setBusy('print')
    try {
      const url = URL.createObjectURL((await makePdf(board)).blob())
      window.open(url, '_blank')
    } catch (e: any) { toast(e?.message || 'PDF не се създаде', 'error') } finally { setBusy('') }
  }

  const fixed = meta.min === meta.max
  const canAdd = board.pics.length < meta.max
  const field = 'w-full px-3 py-2 rounded-xl border border-slate-300 text-[14px] focus:outline-none focus:border-[#0f2240] bg-white'

  return (
    <div className="space-y-5">
      {/* вид */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {ORDER.map(t => (
          <button key={t} type="button" onClick={() => chooseType(t)}
            className={`text-left px-3 py-2.5 rounded-2xl border transition-all ${type === t ? 'border-[#0f2240] bg-white shadow-sm ring-1 ring-[#0f2240]' : 'border-slate-200 bg-white/60 hover:border-slate-300'}`}>
            <div className={`flex items-center gap-2 text-[14px] ${type === t ? 'text-[#0f2240] font-semibold' : 'text-slate-700'}`}>{ICONS[t]} {TYPES[t].label}</div>
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,420px)_1fr] gap-5 items-start">
        {/* настройки */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 space-y-4">
          <p className="text-[13px] text-slate-500">{meta.hint}</p>
          <div className="grid grid-cols-2 gap-2">
            <label className="col-span-2 text-[12px] text-slate-500">Заглавие
              <input value={board.title} onChange={e => update({ title: e.target.value })} maxLength={60} className={field} />
            </label>
            <label className="col-span-2 text-[12px] text-slate-500">За кое дете (по желание — излиза горе вдясно)
              <input value={board.who} onChange={e => update({ who: e.target.value })} maxLength={40} placeholder="напр. Иван" className={field} />
            </label>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-[12px] text-slate-500 mr-1">Цвят</span>
            {COLORS.map(c => (
              <button key={c} type="button" onClick={() => update({ color: c })} aria-label={c}
                className={`w-6 h-6 rounded-full ${board.color === c ? 'ring-2 ring-offset-2 ring-slate-500' : ''}`} style={{ backgroundColor: c }} />
            ))}
          </div>

          {(type === 'cards' || type === 'pecs-book') && (
            <div className="grid grid-cols-2 gap-2">
              <label className="text-[12px] text-slate-500">Размер
                <select value={board.size} onChange={e => update({ size: e.target.value as Board['size'] })} className={field}>
                  {Object.entries(SIZES).map(([k, s]) => <option key={k} value={k}>{s.label}</option>)}
                </select>
              </label>
              <label className="text-[12px] text-slate-500">Копия от всяка
                <select value={board.copies} onChange={e => update({ copies: Number(e.target.value) })} className={field}>
                  {[1, 2, 3, 4, 5].map(n => <option key={n} value={n}>{n}</option>)}
                </select>
              </label>
              <label className="col-span-2 inline-flex items-center gap-2 text-[13px] text-slate-700">
                <input type="checkbox" checked={board.labels} onChange={e => update({ labels: e.target.checked })} className="accent-[#0f2240]" /> С надпис под картинката
              </label>
            </div>
          )}
          {type === 'token' && (
            <label className="block text-[12px] text-slate-500">Брой жетони
              <div className="flex gap-1 mt-1">
                {([3, 5, 10] as const).map(n => (
                  <button key={n} type="button" onClick={() => update({ tokens: n })}
                    className={`px-4 py-1.5 rounded-lg text-[13px] ${board.tokens === n ? 'bg-[#0f2240] text-white' : 'bg-slate-100 text-slate-600'}`}>{n}</button>
                ))}
              </div>
            </label>
          )}

          {/* картинките */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-[13px] font-semibold text-slate-700">Картинки {!fixed && <span className="font-normal text-slate-400">({board.pics.length}/{meta.max})</span>}</span>
              {!fixed && board.pics.length > 0 && (
                <button type="button" onClick={() => { if (confirm('Да се изчистят всички картинки?')) update({ pics: [] }) }} className="text-[12px] text-slate-400 hover:text-rose-600">Изчисти</button>
              )}
            </div>
            <div className="space-y-1.5 max-h-[52vh] overflow-auto pr-1">
              {(fixed ? Array.from({ length: meta.max }, (_, i) => board.pics[i] || { label: '' }) : board.pics).map((pc, i) => (
                <div key={i} className="flex items-start gap-2 p-1.5 rounded-xl border border-slate-200 bg-slate-50/50">
                  <button type="button" onClick={() => setPicker({ index: i })} title="Смени картинката"
                    className="shrink-0 w-14 h-14 rounded-lg bg-white border border-slate-200 hover:border-sky-400 flex items-center justify-center overflow-hidden">
                    {pc.photo ? <img src={pc.photo} alt="" className="w-full h-full object-cover" /> : pc.key ? <img src={pictoUrl(pc.key)} alt="" className="w-11 h-11" /> : <Plus size={18} className="text-slate-300" />}
                  </button>
                  <div className="flex-1 min-w-0 space-y-1">
                    {meta.slotNames && <div className="text-[11px] uppercase tracking-wider text-slate-400">{meta.slotNames[i]}</div>}
                    <input value={pc.label} onChange={e => setPic(i, { label: e.target.value })}
                      placeholder="надпис" maxLength={40} className="w-full px-2 py-1 rounded-lg border border-slate-200 text-[13.5px] focus:outline-none focus:border-[#0f2240] bg-white" />
                    {meta.withText && (
                      <textarea value={pc.text || ''} onChange={e => setPic(i, { text: e.target.value })} rows={2} maxLength={140}
                        placeholder="Изречение от първо лице — напр. „Докато чакам, дишам спокойно.“"
                        className="w-full px-2 py-1 rounded-lg border border-slate-200 text-[13px] focus:outline-none focus:border-[#0f2240] bg-white resize-none" />
                    )}
                  </div>
                  {!fixed && (
                    <div className="flex flex-col">
                      <button type="button" onClick={() => move(i, -1)} className="p-0.5 text-slate-400 hover:text-slate-700"><ChevronUp size={15} /></button>
                      <button type="button" onClick={() => move(i, 1)} className="p-0.5 text-slate-400 hover:text-slate-700"><ChevronDown size={15} /></button>
                      <button type="button" onClick={() => remove(i)} className="p-0.5 text-slate-400 hover:text-rose-600"><Trash2 size={14} /></button>
                    </div>
                  )}
                </div>
              ))}
            </div>
            {!fixed && (
              <div className="flex gap-2 mt-2">
                <button type="button" disabled={!canAdd} onClick={() => setPicker({ index: null })}
                  className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl border border-dashed border-slate-300 text-[13px] text-slate-700 hover:border-[#0f2240] disabled:opacity-40">
                  <Plus size={15} /> Добави картинки
                </button>
                <input ref={photoInput} type="file" accept="image/*" className="hidden" onChange={e => { addPhoto(e.target.files?.[0]); e.target.value = '' }} />
                <button type="button" disabled={!canAdd} onClick={() => photoInput.current?.click()}
                  className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl border border-dashed border-slate-300 text-[13px] text-slate-700 hover:border-[#0f2240] disabled:opacity-40">
                  <ImagePlus size={15} /> Снимка
                </button>
              </div>
            )}
          </div>
          <button type="button" onClick={() => { if (confirm('Да се върне примерът за този вид?')) { const d = { ...drafts }; delete d[type]; setDrafts(d); try { localStorage.setItem(DRAFT, JSON.stringify({ type, drafts: d })) } catch { /* */ } } }}
            className="inline-flex items-center gap-1 text-[12px] text-slate-400 hover:text-slate-700"><RotateCcw size={12} /> Започни отначало</button>
        </div>

        {/* превю и действия */}
        <div className="space-y-3 lg:sticky lg:top-4">
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" onClick={print} disabled={!!busy || !board.pics.length}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-white text-sm hover:opacity-90 disabled:opacity-50" style={{ backgroundColor: '#0f2240' }}>
              {busy === 'print' ? <Loader2 size={15} className="animate-spin" /> : <Printer size={15} />} Печат
            </button>
            <button type="button" onClick={download} disabled={!!busy || !board.pics.length}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl border border-slate-300 bg-white text-sm text-slate-700 hover:border-[#0f2240] disabled:opacity-50">
              {busy === 'pdf' ? <Loader2 size={15} className="animate-spin" /> : <Download size={15} />} Изтегли PDF
            </button>
            <button type="button" onClick={() => setSaving(true)} disabled={!board.pics.length}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl border border-slate-300 bg-white text-sm text-slate-700 hover:border-[#0f2240] disabled:opacity-50">
              <Library size={15} /> Запази в библиотеката
            </button>
            <span className="text-[12px] text-slate-400 ml-auto">{rendering ? <Loader2 size={13} className="inline animate-spin" /> : `${pages.length} стр.`}</span>
          </div>
          <div className="bg-slate-200/60 rounded-2xl p-3 space-y-3 max-h-[78vh] overflow-auto">
            {pages.map((pg, i) => <img key={i} src={pg.src} alt={`страница ${i + 1}`} className={`w-full ${pg.land ? '' : 'max-w-[540px]'} mx-auto bg-white shadow-md rounded-sm`} />)}
            {!pages.length && <div className="h-64 flex items-center justify-center text-slate-400"><Loader2 className="animate-spin" /></div>}
          </div>
        </div>
      </div>

      {picker && (
        <PictoPicker multi={picker.index == null} title={picker.index == null ? 'Добави картинки' : 'Смени картинката'}
          toPhoto={fileToDataUrl} onPick={picked} onClose={() => setPicker(null)} />
      )}
      {saving && <SaveModal board={board} meId={meId} ownSourceId={ownSourceId} makePdf={makePdf} onClose={() => setSaving(false)} />}
    </div>
  )
}

function SaveModal({ board, meId, ownSourceId, makePdf, onClose }: {
  board: Board; meId: string; ownSourceId: string | null; makePdf: (b: Board) => Promise<PdfPainter>; onClose: () => void
}) {
  const supabase = createClient()
  const { toast } = useToast()
  const meta = TYPES[board.type]
  const [title, setTitle] = useState(board.title || meta.label)
  const [description, setDescription] = useState('')
  const [areas, setAreas] = useState<string[]>(meta.areas)
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(false)

  async function save() {
    if (!title.trim()) return
    setBusy(true)
    try {
      // в библиотеката отива без името на детето — вижда се от всички колеги
      const b: Board = { ...board, who: '', title: title.trim() }
      const P = await makePdf(b)
      const pdf = P.blob()
      await loadCanvasFonts()
      const { imgs, extra } = await prepare(b)
      const C = new CanvasPainter(2.5)
      render(C, b, imgs, extra)
      const jpg: Blob = await new Promise(ok => C.canvases[0].toBlob(x => ok(x!), 'image/jpeg', 0.8))
      const id = crypto.randomUUID()
      const fp = `gen/${id}.pdf`, pp = `gen/${id}.jpg`
      const u1 = await supabase.storage.from('materials').upload(fp, pdf, { contentType: 'application/pdf' })
      if (u1.error) throw u1.error
      await supabase.storage.from('materials').upload(pp, jpg, { contentType: 'image/jpeg' })
      const { error } = await supabase.from('materials').insert({
        title: title.trim(), description: description.trim() || null, kind: meta.kind, areas, source_id: ownSourceId,
        file_path: fp, file_name: `${title.trim().replace(/[\\/:*?"<>|]/g, '')}.pdf`, mime_type: 'application/pdf', size: pdf.size,
        uploaded_by: meId, preview_path: pp, pages: P.pages(),
      })
      if (error) throw error
      setDone(true)
    } catch (e: any) {
      toast(e?.message || 'Не се запази', 'error')
    } finally { setBusy(false) }
  }

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/40 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-3xl shadow-xl w-full max-w-lg p-5 space-y-3" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <div className="text-[16px] font-semibold text-slate-800">Запази в библиотеката</div>
          <button type="button" onClick={onClose} className="p-1 text-slate-400 hover:text-slate-700"><X size={18} /></button>
        </div>
        {done ? (
          <div className="space-y-3">
            <p className="text-sm text-slate-700">Готово — материалът е в „Материали“ и колегите могат да го ползват. Може да го дадете и на родител през онлайн стаята („Добави от библиотеката“).</p>
            <div className="flex gap-2 justify-end">
              <button type="button" onClick={onClose} className="px-4 py-2 rounded-xl border border-slate-300 text-sm">Затвори</button>
              <Link href="/materials" className="px-4 py-2 rounded-xl text-white text-sm" style={{ backgroundColor: '#0f2240' }}>Към библиотеката</Link>
            </div>
          </div>
        ) : (
          <>
            <label className="block text-[12px] text-slate-500">Заглавие
              <input value={title} onChange={e => setTitle(e.target.value)} maxLength={80} className="w-full px-3 py-2 rounded-xl border border-slate-300 text-[14px] focus:outline-none focus:border-[#0f2240]" />
            </label>
            <label className="block text-[12px] text-slate-500">Описание (по желание)
              <textarea value={description} onChange={e => setDescription(e.target.value)} rows={2} maxLength={300} className="w-full px-3 py-2 rounded-xl border border-slate-300 text-[14px] focus:outline-none focus:border-[#0f2240] resize-none" />
            </label>
            <div>
              <div className="text-[12px] text-slate-500 mb-1">Области</div>
              <div className="flex flex-wrap gap-1">
                {AREAS.map(a => (
                  <button key={a.key} type="button" onClick={() => setAreas(areas.includes(a.key) ? areas.filter(x => x !== a.key) : [...areas, a.key])}
                    className={`px-2.5 py-1 rounded-lg text-[12.5px] border ${areas.includes(a.key) ? 'text-white border-transparent' : 'text-slate-600 border-slate-200'}`}
                    style={areas.includes(a.key) ? { backgroundColor: a.color } : {}}>{a.short}</button>
                ))}
              </div>
            </div>
            {board.who && <p className="text-[12.5px] text-amber-700 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2">Името „{board.who}“ няма да излезе — библиотеката е обща за всички колеги.</p>}
            <div className="flex gap-2 justify-end pt-1">
              <button type="button" onClick={onClose} className="px-4 py-2 rounded-xl border border-slate-300 text-sm">Откажи</button>
              <button type="button" onClick={save} disabled={busy || !title.trim()} className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-white text-sm disabled:opacity-50" style={{ backgroundColor: '#0f2240' }}>
                {busy && <Loader2 size={14} className="animate-spin" />} Запази
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
