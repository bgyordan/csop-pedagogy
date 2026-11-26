'use client'

// Банка с уроци: търсене, филтри с отметки (предмет, възраст, вид), карти с „Отвори“ / „Изтегли“ / „Ползвах го“,
// качване с кратка карта. Авторът е скрит, освен ако сам не избере „С моето име“.

import { useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Search, Upload, Eye, Download, Trash2, X, Loader2, FileText, ThumbsUp, Target, UserRound, EyeOff } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useToast, confirmDialog } from '@/components/ui/Toast'
import { smartMatch } from '@/lib/search'
import { KINDS, SUBJECTS, LEVELS, levelLabel } from './lib'
import type { BankItem } from './lib'
import { getUploadUrl, discardUpload, removeItem } from './actions'

const MAX_MB = 30
const BUCKET = 'lesson-bank'

const toggleIn = (list: string[], v: string) => list.includes(v) ? list.filter(x => x !== v) : [...list, v]

export default function LessonBankClient({ items, mine, used, focus, isManager }: {
  items: BankItem[]; mine: string[]; used: string[]; focus: string; isManager: boolean
}) {
  const supabase = createClient()
  const router = useRouter()
  const { toast } = useToast()
  const [q, setQ] = useState('')
  const [subjects, setSubjects] = useState<string[]>([])
  const [levels, setLevels] = useState<string[]>([])
  const [kind, setKind] = useState('')
  const [onlyMine, setOnlyMine] = useState(false)
  const [sort, setSort] = useState<'new' | 'used'>('new')
  const [upload, setUpload] = useState(false)
  const [myUses, setMyUses] = useState<string[]>(used)
  const [counts, setCounts] = useState<Record<string, number>>({})
  const mineSet = useMemo(() => new Set(mine), [mine])

  // Фокусът на текущите посещения на час → бърз филтър
  const focusSubject = focus ? SUBJECTS.find(s => focus.startsWith(s) || s.startsWith(focus)) || '' : ''

  const usesOf = (i: BankItem) => counts[i.id] ?? i.uses_count
  const shown = useMemo(() => {
    const list = items.filter(i =>
      (!subjects.length || i.subjects.some(s => subjects.includes(s))) &&
      (!levels.length || i.levels.some(l => levels.includes(l))) &&
      (!kind || i.kind === kind) &&
      (!onlyMine || mineSet.has(i.id)) &&
      (!q || smartMatch(`${i.title} ${i.file_name} ${i.subjects.join(' ')}`, q)))
    return sort === 'used' ? [...list].sort((a, b) => usesOf(b) - usesOf(a)) : list
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items, subjects, levels, kind, onlyMine, q, sort, counts, mineSet])

  async function open(i: BankItem, download: boolean) {
    const { data } = await supabase.storage.from(BUCKET).createSignedUrl(i.file_path, 120, download ? { download: i.file_name } : undefined)
    if (data?.signedUrl) window.open(data.signedUrl, '_blank')
    else toast('Файлът не може да се отвори', 'error')
  }

  async function toggleUse(i: BankItem) {
    const { data, error } = await supabase.rpc('lesson_bank_toggle_use', { p_item: i.id })
    if (error) { toast(error.message, 'error'); return }
    setCounts(c => ({ ...c, [i.id]: data as number }))
    setMyUses(u => toggleIn(u, i.id))
  }

  async function setName(i: BankItem, show: boolean) {
    const { error } = await supabase.rpc('lesson_bank_set_name', { p_item: i.id, p_show_name: show })
    if (error) { toast(error.message, 'error'); return }
    toast(show ? 'Вече се вижда името ви' : 'Вече е анонимно'); router.refresh()
  }

  async function remove(i: BankItem) {
    if (!await confirmDialog(`Да се изтрие ли „${i.title}“ от банката?`)) return
    const r = await removeItem(i.id)
    if (r.error) { toast(r.error, 'error'); return }
    toast('Изтрито'); router.refresh()
  }

  const chip = (on: boolean) => `px-3 py-1.5 rounded-lg text-[13px] transition-all ${on ? 'bg-white text-[#0f2240] shadow-sm ring-1 ring-slate-200' : 'text-slate-500 hover:text-slate-700'}`
  const anyFilter = subjects.length || levels.length || kind || onlyMine || q

  return (
    <div className="space-y-4">
      {/* Търсене + качване */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-2 flex-1 min-w-[240px] px-3 py-2 bg-white border border-slate-200 rounded-xl focus-within:border-[#0f2240]">
          <Search size={15} className="text-slate-400" />
          <input value={q} onChange={e => setQ(e.target.value)} placeholder="Търси — напр. „събиране до 10“, „сезони“, „буквата М“"
            className="flex-1 min-w-0 text-[14px] focus:outline-none" />
          {q && <button type="button" onClick={() => setQ('')} className="text-slate-400 hover:text-slate-700"><X size={14} /></button>}
        </div>
        <button type="button" onClick={() => setUpload(true)}
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-white text-sm hover:opacity-90" style={{ backgroundColor: '#0f2240' }}>
          <Upload size={15} /> Сподели урок
        </button>
      </div>

      {/* Фокус от посещенията на час */}
      {focusSubject && !(subjects.length === 1 && subjects[0] === focusSubject) && (
        <button type="button" onClick={() => setSubjects([focusSubject])}
          className="w-full flex items-center gap-3 px-4 py-2.5 rounded-xl bg-amber-50 border border-amber-200 text-left hover:bg-amber-100/60 transition-colors">
          <Target size={16} className="text-amber-600 shrink-0" />
          <span className="text-[13.5px] text-amber-900">Сега текат посещения на час по <b className="font-medium">{focusSubject}</b> — виж уроците по {focusSubject.toLowerCase()}</span>
        </button>
      )}

      {/* Филтри с отметки */}
      <div className="bg-white border border-slate-200/80 rounded-2xl p-3 space-y-2 shadow-sm">
        <div className="flex flex-wrap items-center gap-1">
          <span className="text-[12px] text-slate-400 w-16 shrink-0">Предмет</span>
          <div className="flex flex-wrap gap-1 p-1 bg-slate-100 rounded-xl">
            {SUBJECTS.map(s => <button key={s} type="button" onClick={() => setSubjects(toggleIn(subjects, s))} className={chip(subjects.includes(s))}>{s}</button>)}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-1">
          <span className="text-[12px] text-slate-400 w-16 shrink-0">Възраст</span>
          <div className="flex flex-wrap gap-1 p-1 bg-slate-100 rounded-xl">
            {LEVELS.map(l => <button key={l.key} type="button" onClick={() => setLevels(toggleIn(levels, l.key))} className={chip(levels.includes(l.key))}>{l.label}</button>)}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-1">
          <span className="text-[12px] text-slate-400 w-16 shrink-0">Вид</span>
          <div className="flex flex-wrap gap-1 p-1 bg-slate-100 rounded-xl">
            <button type="button" onClick={() => setKind('')} className={chip(!kind)}>Всички</button>
            {Object.entries(KINDS).map(([k, l]) => <button key={k} type="button" onClick={() => setKind(kind === k ? '' : k)} className={chip(kind === k)}>{l}</button>)}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-100">
          {mine.length > 0 && (
            <button type="button" onClick={() => setOnlyMine(!onlyMine)}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[13px] border transition-colors ${onlyMine ? 'border-[#0f2240] bg-slate-50 text-[#0f2240]' : 'border-slate-200 text-slate-500 hover:border-slate-400'}`}>
              <UserRound size={13} /> Моите ({mine.length})
            </button>
          )}
          <div className="ml-auto flex gap-1 p-1 bg-slate-100 rounded-xl">
            <button type="button" onClick={() => setSort('new')} className={chip(sort === 'new')}>Най-нови</button>
            <button type="button" onClick={() => setSort('used')} className={chip(sort === 'used')}>Най-ползвани</button>
          </div>
          {anyFilter ? (
            <button type="button" onClick={() => { setSubjects([]); setLevels([]); setKind(''); setOnlyMine(false); setQ('') }}
              className="text-[12.5px] text-slate-400 hover:text-slate-700">изчисти</button>
          ) : null}
        </div>
      </div>

      {/* Файловете */}
      {shown.length === 0 ? (
        <div className="bg-white border border-dashed border-slate-300 rounded-2xl p-12 text-center">
          <p className="text-sm text-slate-500">{items.length ? 'Няма уроци по този избор.' : 'Банката още е празна.'}</p>
          {!items.length && <p className="text-[12.5px] text-slate-400 mt-1">Споделете първия си урок — може напълно анонимно.</p>}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {shown.map(i => {
            const isMine = mineSet.has(i.id)
            const iUsed = myUses.includes(i.id)
            return (
              <div key={i.id} className="bg-white rounded-2xl border border-slate-200/80 shadow-sm flex flex-col hover:shadow-md hover:-translate-y-0.5 transition-all">
                <div className="px-4 pt-4 pb-3 flex-1 flex flex-col">
                  <div className="flex items-start gap-3">
                    <button type="button" onClick={() => open(i, false)} title="Отвори"
                      className="shrink-0 w-11 h-12 rounded-lg bg-slate-50 border border-slate-200 flex flex-col items-center justify-center text-slate-400 hover:border-[#0f2240]">
                      <FileText size={18} />
                      <span className="text-[9px] uppercase tracking-wider mt-0.5">{(i.file_name.split('.').pop() || '').slice(0, 4)}</span>
                    </button>
                    <div className="min-w-0 flex-1">
                      <button type="button" onClick={() => open(i, false)} className="text-left text-[14px] text-slate-800 leading-snug hover:text-[#0f2240]">{i.title}</button>
                      <div className="text-[12px] text-slate-500 mt-0.5">{KINDS[i.kind] || i.kind}</div>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-1 mt-2.5">
                    {i.subjects.map(s => <span key={s} className="text-[11px] px-2 py-0.5 rounded-full bg-sky-50 text-sky-700 border border-sky-100">{s}</span>)}
                    {i.levels.map(l => <span key={l} className="text-[11px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">{levelLabel(l)}</span>)}
                  </div>
                  <div className="text-[11.5px] text-slate-400 mt-auto pt-3 flex items-center gap-1.5">
                    <span>{i.author_label || 'Анонимен колега'} · {new Date(i.created_at).toLocaleDateString('bg-BG')}</span>
                    {isMine && <span className="ml-auto text-[10.5px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-500">ваше · виждате само вие</span>}
                  </div>
                </div>
                <div className="flex items-center gap-1.5 px-4 py-2.5 border-t border-slate-100">
                  <button type="button" onClick={() => open(i, false)} className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border border-slate-300 text-[12.5px] text-slate-700 hover:border-[#0f2240]"><Eye size={13} /> Отвори</button>
                  <button type="button" onClick={() => open(i, true)} className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border border-slate-300 text-[12.5px] text-slate-700 hover:border-[#0f2240]"><Download size={13} /> Изтегли</button>
                  <button type="button" onClick={() => toggleUse(i)} title={iUsed ? 'Махни отметката' : 'Ползвах този урок и беше полезен'}
                    className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl border text-[12.5px] transition-colors ${iUsed ? 'border-emerald-300 bg-emerald-50 text-emerald-700' : 'border-slate-200 text-slate-500 hover:border-slate-400'}`}>
                    <ThumbsUp size={13} /> {usesOf(i) || ''}
                  </button>
                  <div className="ml-auto flex items-center">
                    {isMine && (
                      <button type="button" onClick={() => setName(i, !i.author_label)} title={i.author_label ? 'Направи анонимно' : 'Покажи името ми'}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-[#0f2240] hover:bg-slate-100">
                        {i.author_label ? <EyeOff size={14} /> : <UserRound size={14} />}
                      </button>
                    )}
                    {(isMine || isManager) && (
                      <button type="button" onClick={() => remove(i)} title="Изтрий" className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50"><Trash2 size={14} /></button>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      <p className="text-[11.5px] text-slate-400 text-center pt-2">Кой отваря или изтегля файлове не се записва. Палецът брои само колко колеги са ползвали урока.</p>

      {upload && <UploadModal onClose={() => setUpload(false)} onDone={() => { setUpload(false); router.refresh() }} />}
    </div>
  )
}

function UploadModal({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const supabase = createClient()
  const { toast } = useToast()
  const [file, setFile] = useState<File | null>(null)
  const [title, setTitle] = useState('')
  const [kind, setKind] = useState('lesson')
  const [subjects, setSubjects] = useState<string[]>([])
  const [levels, setLevels] = useState<string[]>([])
  const [showName, setShowName] = useState(false)
  const [busy, setBusy] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  async function save() {
    if (!file) { toast('Изберете файл', 'error'); return }
    if (!title.trim()) { toast('Напишете заглавие', 'error'); return }
    if (!subjects.length) { toast('Отметнете поне един предмет', 'error'); return }
    if (file.size > MAX_MB * 1024 * 1024) { toast(`Файлът е над ${MAX_MB} MB`, 'error'); return }
    setBusy(true)
    const prep = await getUploadUrl(file.name.split('.').pop() || 'bin')
    if (prep.error || !prep.path || !prep.token) { setBusy(false); toast(prep.error || 'Грешка', 'error'); return }
    const up = await supabase.storage.from(BUCKET).uploadToSignedUrl(prep.path, prep.token, file, { contentType: file.type || undefined })
    if (up.error) { setBusy(false); toast('Грешка при качване: ' + up.error.message, 'error'); return }
    const { error } = await supabase.rpc('lesson_bank_add', {
      p_title: title.trim(), p_description: null, p_kind: kind,
      p_subjects: subjects, p_levels: levels, p_checks: [],
      p_show_name: showName, p_file_path: prep.path, p_file_name: file.name, p_mime_type: file.type || null, p_size: file.size,
    })
    setBusy(false)
    if (error) { await discardUpload(prep.path); toast('Грешка: ' + error.message, 'error'); return }
    toast(showName ? 'Споделено с вашето име — благодарим!' : 'Споделено анонимно — благодарим!')
    onDone()
  }

  const pill = (on: boolean) => `px-3 py-1.5 rounded-full text-[13px] border transition-colors ${on ? 'border-[#0f2240] text-[#0f2240] bg-slate-50 ring-1 ring-[#0f2240]/20' : 'border-slate-200 text-slate-500 hover:border-slate-400'}`
  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm overflow-y-auto" onClick={onClose}>
      <div className="max-w-2xl mx-auto my-0 md:my-10 bg-white md:rounded-3xl shadow-2xl overflow-hidden" onClick={e => e.stopPropagation()}>
        <div className="flex items-center gap-3 px-6 py-3.5 border-b border-slate-200">
          <Upload size={17} className="text-slate-500" />
          <h2 className="text-base font-medium text-[#0f2240] flex-1">Сподели урок</h2>
          <button type="button" onClick={onClose} className="p-2 rounded-xl text-slate-500 hover:bg-slate-100"><X size={18} /></button>
        </div>
        <div className="px-6 py-5 space-y-4">
          <div>
            <input ref={fileRef} type="file" className="hidden" onChange={e => {
              const f = e.target.files?.[0] || null; setFile(f)
              if (f && !title) setTitle(f.name.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' '))
            }} />
            <button type="button" onClick={() => fileRef.current?.click()}
              className="w-full px-4 py-4 rounded-xl border-2 border-dashed border-slate-300 text-[14px] text-slate-600 hover:border-[#0f2240]">
              {file ? <>📎 {file.name}</> : 'Изберете файл — Word, PDF, PowerPoint, картинка…'}
            </button>
          </div>
          <div>
            <div className="text-sm font-medium text-slate-800 mb-1.5">Заглавие</div>
            <input value={title} onChange={e => setTitle(e.target.value)} placeholder="напр. Събиране до 10 с предмети"
              className="w-full px-3 py-2 border border-slate-200 rounded-xl text-[14px] focus:outline-none focus:border-[#0f2240]" />
          </div>
          <div>
            <div className="text-sm font-medium text-slate-800 mb-1.5">Вид</div>
            <div className="flex flex-wrap gap-1.5">{Object.entries(KINDS).map(([k, l]) => <button key={k} type="button" onClick={() => setKind(k)} className={pill(kind === k)}>{l}</button>)}</div>
          </div>
          <div>
            <div className="text-sm font-medium text-slate-800 mb-1.5">Предмет <span className="text-[12px] font-normal text-slate-400">може няколко</span></div>
            <div className="flex flex-wrap gap-1.5">{SUBJECTS.map(s => <button key={s} type="button" onClick={() => setSubjects(toggleIn(subjects, s))} className={pill(subjects.includes(s))}>{s}</button>)}</div>
          </div>
          <div>
            <div className="text-sm font-medium text-slate-800 mb-1.5">Възраст <span className="text-[12px] font-normal text-slate-400">може няколко</span></div>
            <div className="flex flex-wrap gap-1.5">{LEVELS.map(l => <button key={l.key} type="button" onClick={() => setLevels(toggleIn(levels, l.key))} className={pill(levels.includes(l.key))}>{l.label}</button>)}</div>
          </div>
          {/* Анонимно / С моето име — плъзгач с два етикета */}
          <div className="flex items-center gap-3">
            <div className="relative inline-flex p-1 bg-slate-100 rounded-full text-[13px]">
              <span className={`absolute top-1 bottom-1 w-[calc(50%-4px)] rounded-full bg-white shadow-sm ring-1 ring-slate-200 transition-all ${showName ? 'left-[50%]' : 'left-1'}`} />
              <button type="button" onClick={() => setShowName(false)} className={`relative z-10 w-32 py-1.5 rounded-full transition-colors ${!showName ? 'text-[#0f2240]' : 'text-slate-500'}`}>Анонимно</button>
              <button type="button" onClick={() => setShowName(true)} className={`relative z-10 w-32 py-1.5 rounded-full transition-colors ${showName ? 'text-[#0f2240]' : 'text-slate-500'}`}>С моето име</button>
            </div>
            <span className="text-[12px] text-slate-400">{showName ? 'колегите ще виждат името ви' : 'в ЕИС никой не вижда кой е споделил, дори ръководството'}</span>
          </div>
        </div>
        <div className="flex justify-end gap-2 px-6 py-4 border-t border-slate-100">
          <button type="button" onClick={onClose} className="px-4 py-2 rounded-xl text-sm text-slate-600 hover:bg-slate-100">Отказ</button>
          <button type="button" onClick={save} disabled={busy}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-white text-sm hover:opacity-90 disabled:opacity-50" style={{ backgroundColor: '#0f2240' }}>
            {busy ? <Loader2 size={15} className="animate-spin" /> : <Upload size={15} />} Сподели
          </button>
        </div>
      </div>
    </div>
  )
}
