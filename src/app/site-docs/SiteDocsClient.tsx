```tsx
'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import {
  FileText,
  Upload,
  Loader2,
  Trash2,
  Download,
  Globe,
  EyeOff,
  Plus,
  CheckCircle2,
  FileUp,
  X,
} from 'lucide-react'

interface Doc {
  id: string
  name: string
  file_url: string
  academic_year: string | null
  section: string
  category: string | null
  on_site: boolean
  sort_order: number
}

const SECTIONS: { id: string; label: string }[] = [
  { id: 'internal', label: 'Нормативни документи' },
  { id: 'budget', label: 'Бюджет и финанси' },
  { id: 'admission', label: 'Прием' },
  { id: 'zdoi', label: 'Достъп до информация (ЗДОИ)' },
  { id: 'privacy', label: 'Лични данни (ЗЗЛД)' },
  { id: 'signali', label: 'Сигнали (ЗЗЛПСПОИН)' },
]

const RUBRICS: { key: string; title: string; color: string }[] = [
  { key: 'strategy', title: 'Стратегия и планове', color: '#7c3aed' },
  { key: 'rules', title: 'Правилници и вътрешни правила', color: '#0d9488' },
  { key: 'programs', title: 'Програми', color: '#2563eb' },
  { key: 'ethics', title: 'Етика и приобщаване', color: '#db2777' },
  { key: 'safety', title: 'Безопасност', color: '#ea580c' },
  { key: 'data', title: 'Защита на данните', color: '#475569' },
  { key: 'other', title: 'Общи', color: '#64748b' },
]

function suggestName(filename: string): string {
  let n = filename.replace(/\.[a-z0-9]+$/i, '')
  n = n.replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').trim()

  return n.charAt(0).toUpperCase() + n.slice(1)
}

export default function SiteDocsClient({
  docs,
  defaultYear,
}: {
  docs: Doc[]
  defaultYear: string
}) {
  const supabase = createClient()
  const router = useRouter()

  const [list, setList] = useState<Doc[]>(docs)
  const [tab, setTab] = useState('internal')
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [name, setName] = useState('')
  const [category, setCategory] = useState('other')
  const [onSite, setOnSite] = useState(true)
  const [file, setFile] = useState<File | null>(null)

  const isInternal = tab === 'internal'
  const sectionDocs = list.filter(d => d.section === tab)

  const currentSection = SECTIONS.find(s => s.id === tab)

  const totalDocs = list.length
  const publicDocs = list.filter(d => d.on_site).length

  function resetForm() {
    setName('')
    setFile(null)
    setCategory('other')
    setOnSite(true)

    const input = document.getElementById('sd-file') as HTMLInputElement | null
    if (input) input.value = ''
  }

  async function upload() {
    if (!name.trim() || !file) {
      alert('Име и файл са задължителни')
      return
    }

    setBusy(true)

    const ext = file.name.split('.').pop()
    const path = `${tab}/${Date.now()}-${Math.random()
      .toString(36)
      .slice(2)}.${ext}`

    const { error: upErr } = await supabase.storage
      .from('public-docs')
      .upload(path, file)

    if (upErr) {
      alert('Грешка при качване: ' + upErr.message)
      setBusy(false)
      return
    }

    const { data: pub } = supabase.storage
      .from('public-docs')
      .getPublicUrl(path)

    const sort =
      list
        .filter(d => d.section === tab)
        .reduce((m, d) => Math.max(m, d.sort_order), 0) + 1

    const { data, error } = await supabase
      .from('site_documents')
      .insert({
        name: name.trim(),
        file_url: pub.publicUrl,
        academic_year: defaultYear || null,
        section: tab,
        category: isInternal ? category : null,
        on_site: onSite,
        sort_order: sort,
      })
      .select('*')
      .single()

    setBusy(false)

    if (error || !data) {
      alert('Грешка при запис: ' + (error?.message || ''))
      return
    }

    setList(prev => [...prev, data as Doc])
    resetForm()
    setOpen(false)
    router.refresh()
  }

  async function toggleSite(d: Doc) {
    const next = !d.on_site

    setList(prev =>
      prev.map(x => (x.id === d.id ? { ...x, on_site: next } : x)),
    )

    await supabase
      .from('site_documents')
      .update({ on_site: next })
      .eq('id', d.id)

    router.refresh()
  }

  async function changeCategory(d: Doc, cat: string) {
    setList(prev =>
      prev.map(x => (x.id === d.id ? { ...x, category: cat } : x)),
    )

    await supabase
      .from('site_documents')
      .update({ category: cat })
      .eq('id', d.id)

    router.refresh()
  }

  async function remove(d: Doc) {
    if (!confirm(`Изтриване на „${d.name}"?`)) return

    const m = d.file_url.split('/public-docs/')[1]

    if (m) {
      await supabase.storage.from('public-docs').remove([m])
    }

    await supabase
      .from('site_documents')
      .delete()
      .eq('id', d.id)

    setList(prev => prev.filter(x => x.id !== d.id))
    router.refresh()
  }

  function DocRow({
    d,
    color,
  }: {
    d: Doc
    color: string
  }) {
    return (
      <div
        className="
          group
          flex flex-col gap-3
          rounded-2xl
          border border-slate-200
          bg-white
          p-3
          shadow-[0_1px_2px_rgba(15,34,64,0.04)]
          transition-all
          hover:border-slate-300
          hover:shadow-md
          sm:flex-row
          sm:items-center
        "
      >
        <div
          className="hidden h-10 w-1 shrink-0 rounded-full sm:block"
          style={{ backgroundColor: color }}
          aria-hidden="true"
        />

        <div className="flex min-w-0 flex-1 items-center gap-3">
          <div
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
            style={{
              backgroundColor: `${color}12`,
              color,
            }}
          >
            <FileText size={19} strokeWidth={1.8} />
          </div>

          <a
            href={d.file_url}
            target="_blank"
            rel="noopener noreferrer"
            className="min-w-0 flex-1"
          >
            <span className="block truncate text-sm font-semibold text-slate-700 transition-colors group-hover:text-[#0f2240]">
              {d.name}
            </span>

            <span className="mt-0.5 block text-[11px] text-slate-400">
              PDF
              {d.academic_year ? ` · ${d.academic_year}` : ''}
            </span>
          </a>
        </div>

        <div className="flex flex-wrap items-center gap-2 sm:justify-end">
          {isInternal && (
            <select
              value={d.category || 'other'}
              onChange={e => changeCategory(d, e.target.value)}
              className="
                min-w-0
                max-w-full
                cursor-pointer
                rounded-lg
                border
                border-slate-200
                bg-white
                px-2.5
                py-1.5
                text-[11px]
                font-medium
                text-slate-600
                outline-none
                transition
                hover:border-slate-300
                focus:border-slate-400
                focus:ring-2
                focus:ring-slate-100
              "
              title="Рубрика"
              aria-label={`Рубрика за ${d.name}`}
            >
              {RUBRICS.map(c => (
                <option key={c.key} value={c.key}>
                  {c.title}
                </option>
              ))}
            </select>
          )}

          <button
            onClick={() => toggleSite(d)}
            title={
              d.on_site
                ? 'Показва се на сайта — изключи'
                : 'Само в ЕИС — покажи на сайта'
            }
            aria-label={
              d.on_site
                ? `Скрий ${d.name} от сайта`
                : `Покажи ${d.name} на сайта`
            }
            className={`
              inline-flex
              items-center
              gap-1.5
              rounded-lg
              border
              px-2.5
              py-1.5
              text-[11px]
              font-semibold
              transition-all
              ${
                d.on_site
                  ? 'border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                  : 'border-slate-200 bg-slate-50 text-slate-400 hover:bg-slate-100'
              }
            `}
          >
            {d.on_site ? (
              <>
                <Globe size={13} />
                <span>На сайта</span>
              </>
            ) : (
              <>
                <EyeOff size={13} />
                <span>Скрит</span>
              </>
            )}
          </button>

          <a
            href={d.file_url}
            target="_blank"
            rel="noopener noreferrer"
            className="
              inline-flex
              h-8
              w-8
              items-center
              justify-center
              rounded-lg
              border
              border-slate-200
              text-slate-400
              transition
              hover:border-slate-300
              hover:bg-slate-50
              hover:text-[#0f2240]
            "
            title="Отвори документа"
            aria-label={`Отвори ${d.name}`}
          >
            <Download size={15} />
          </a>

          <button
            onClick={() => remove(d)}
            className="
              inline-flex
              h-8
              w-8
              items-center
              justify-center
              rounded-lg
              border
              border-transparent
              text-slate-300
              transition
              hover:border-rose-100
              hover:bg-rose-50
              hover:text-rose-500
            "
            title="Изтрий"
            aria-label={`Изтрий ${d.name}`}
          >
            <Trash2 size={15} />
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-full bg-slate-50/60">
      <div className="mx-auto max-w-5xl px-4 py-5 md:px-8 md:py-8">
        {/* Header */}
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#0f2240] shadow-sm">
              <Globe size={20} className="text-white" />
            </div>

            <div className="min-w-0">
              <h1 className="text-xl font-bold tracking-tight text-slate-800 md:text-2xl">
                Сайт — документи
              </h1>

              <p className="mt-0.5 text-xs text-slate-500 md:text-sm">
                Управление на публичните документи и съдържанието по раздели
              </p>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            <div className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-center shadow-sm">
              <div className="text-sm font-bold text-slate-700">
                {totalDocs}
              </div>
              <div className="text-[9px] font-medium uppercase tracking-wide text-slate-400">
                общо
              </div>
            </div>

            <div className="rounded-xl border border-emerald-100 bg-emerald-50 px-3 py-2 text-center shadow-sm">
              <div className="text-sm font-bold text-emerald-700">
                {publicDocs}
              </div>
              <div className="text-[9px] font-medium uppercase tracking-wide text-emerald-600/70">
                публични
              </div>
            </div>
          </div>
        </div>

        {/* Section navigation */}
        <div className="mb-5 overflow-x-auto rounded-2xl border border-slate-200 bg-white p-1.5 shadow-sm">
          <div className="flex min-w-max gap-1">
            {SECTIONS.map(s => {
              const cnt = list.filter(d => d.section === s.id).length
              const active = tab === s.id

              return (
                <button
                  key={s.id}
                  onClick={() => {
                    setTab(s.id)
                    setOpen(false)
                  }}
                  className={`
                    whitespace-nowrap
                    rounded-xl
                    px-3
                    py-2
                    text-xs
                    font-semibold
                    transition-all
                    ${
                      active
                        ? 'bg-[#0f2240] text-white shadow-sm'
                        : 'text-slate-500 hover:bg-slate-50 hover:text-slate-700'
                    }
                  `}
                >
                  {s.label}

                  <span
                    className={`
                      ml-1.5
                      rounded-full
                      px-1.5
                      py-0.5
                      text-[9px]
                      ${
                        active
                          ? 'bg-white/15 text-white'
                          : 'bg-slate-100 text-slate-400'
                      }
                    `}
                  >
                    {cnt}
                  </span>
                </button>
              )
            })}
          </div>
        </div>

        {/* Current section header */}
        <div className="mb-3 flex items-center justify-between gap-3">
          <div className="min-w-0">
            <h2 className="truncate text-sm font-bold text-slate-700">
              {currentSection?.label}
            </h2>

            <p className="mt-0.5 text-[11px] text-slate-400">
              {sectionDocs.length === 0
                ? 'Няма добавени документи'
                : `${sectionDocs.length} ${
                    sectionDocs.length === 1 ? 'документ' : 'документа'
                  }`}
            </p>
          </div>

          <button
            onClick={() => setOpen(v => !v)}
            className="
              inline-flex
              shrink-0
              items-center
              gap-1.5
              rounded-xl
              bg-[#0f2240]
              px-3.5
              py-2
              text-xs
              font-semibold
              text-white
              shadow-sm
              transition-all
              hover:bg-[#172f55]
              hover:shadow
              focus:outline-none
              focus:ring-2
              focus:ring-[#0f2240]/20
            "
          >
            {open ? (
              <X size={15} />
            ) : (
              <Plus size={15} />
            )}

            <span className="hidden sm:inline">
              {open ? 'Затвори' : 'Добави документ'}
            </span>

            <span className="sm:hidden">
              {open ? 'Затвори' : 'Добави'}
            </span>
          </button>
        </div>

        {/* Upload panel */}
        {open && (
          <div className="mb-5 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-100 bg-slate-50/70 px-4 py-3 md:px-5">
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#0f2240]/10 text-[#0f2240]">
                  <FileUp size={16} />
                </div>

                <div>
                  <h3 className="text-sm font-semibold text-slate-700">
                    Нов документ
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    Качване в „{currentSection?.label}“
                  </p>
                </div>
              </div>
            </div>

            <div className="space-y-4 p-4 md:p-5">
              {/* File picker */}
              <div>
                <label
                  htmlFor="sd-file"
                  className="
                    group
                    flex
                    cursor-pointer
                    flex-col
                    items-center
                    justify-center
                    rounded-2xl
                    border-2
                    border-dashed
                    border-slate-200
                    bg-slate-50/50
                    px-4
                    py-7
                    text-center
                    transition
                    hover:border-slate-300
                    hover:bg-slate-50
                  "
                >
                  <div className="mb-2 flex h-11 w-11 items-center justify-center rounded-xl bg-white text-slate-400 shadow-sm transition group-hover:text-[#0f2240]">
                    {file ? (
                      <CheckCircle2 size={21} className="text-emerald-500" />
                    ) : (
                      <Upload size={21} />
                    )}
                  </div>

                  {file ? (
                    <>
                      <span className="max-w-full truncate text-sm font-semibold text-slate-700">
                        {file.name}
                      </span>

                      <span className="mt-1 text-[11px] text-emerald-600">
                        Файлът е избран
                      </span>
                    </>
                  ) : (
                    <>
                      <span className="text-sm font-semibold text-slate-600">
                        Избери PDF файл
                      </span>

                      <span className="mt-1 text-[11px] text-slate-400">
                        Кликни тук, за да избереш документ
                      </span>
                    </>
                  )}

                  <input
                    id="sd-file"
                    type="file"
                    accept="application/pdf"
                    className="sr-only"
                    onChange={e => {
                      const f = e.target.files?.[0] || null

                      setFile(f)

                      if (f && !name.trim()) {
                        setName(suggestName(f.name))
                      }
                    }}
                  />
                </label>
              </div>

              {/* Metadata */}
              <div
                className={`grid grid-cols-1 gap-3 ${
                  isInternal ? 'sm:grid-cols-2' : ''
                }`}
              >
                <div>
                  <label
                    htmlFor="sd-name"
                    className="mb-1.5 block text-[10px] font-bold uppercase tracking-wide text-slate-400"
                  >
                    Име на документа
                  </label>

                  <input
                    id="sd-name"
                    value={name}
                    onChange={e => setName(e.target.value)}
                    placeholder="Името се предлага автоматично"
                    className="
                      w-full
                      rounded-xl
                      border
                      border-slate-200
                      bg-white
                      px-3
                      py-2.5
                      text-sm
                      text-slate-700
                      outline-none
                      transition
                      placeholder:text-slate-300
                      focus:border-slate-400
                      focus:ring-4
                      focus:ring-slate-100
                    "
                  />
                </div>

                {isInternal && (
                  <div>
                    <label
                      htmlFor="sd-category"
                      className="mb-1.5 block text-[10px] font-bold uppercase tracking-wide text-slate-400"
                    >
                      Рубрика
                    </label>

                    <select
                      id="sd-category"
                      value={category}
                      onChange={e => setCategory(e.target.value)}
                      className="
                        w-full
                        cursor-pointer
                        rounded-xl
                        border
                        border-slate-200
                        bg-white
                        px-3
                        py-2.5
                        text-sm
                        text-slate-700
                        outline-none
                        transition
                        focus:border-slate-400
                        focus:ring-4
                        focus:ring-slate-100
                      "
                    >
                      {RUBRICS.map(c => (
                        <option key={c.key} value={c.key}>
                          {c.title}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

              {/* Public toggle */}
              <label
                className="
                  flex
                  cursor-pointer
                  items-center
                  justify-between
                  gap-4
                  rounded-xl
                  border
                  border-slate-200
                  bg-slate-50/70
                  px-3.5
                  py-3
                  transition
                  hover:bg-slate-50
                "
              >
                <div className="flex min-w-0 items-center gap-3">
                  <div
                    className={`
                      flex
                      h-8
                      w-8
                      shrink-0
                      items-center
                      justify-center
                      rounded-lg
                      ${
                        onSite
                          ? 'bg-emerald-100 text-emerald-600'
                          : 'bg-slate-200 text-slate-400'
                      }
                    `}
                  >
                    {onSite ? (
                      <Globe size={15} />
                    ) : (
                      <EyeOff size={15} />
                    )}
                  </div>

                  <div className="min-w-0">
                    <div className="text-xs font-semibold text-slate-700">
                      Показвай на публичния сайт
                    </div>

                    <div className="mt-0.5 text-[10px] text-slate-400">
                      {onSite
                        ? 'Документът ще бъде видим за посетителите.'
                        : 'Документът ще остане само в ЕИС.'}
                    </div>
                  </div>
                </div>

                <div className="relative shrink-0">
                  <input
                    type="checkbox"
                    checked={onSite}
                    onChange={e => setOnSite(e.target.checked)}
                    className="peer sr-only"
                  />

                  <div
                    className="
                      h-6
                      w-11
                      rounded-full
                      bg-slate-300
                      transition
                      peer-checked:bg-emerald-500
                      peer-focus:ring-4
                      peer-focus:ring-emerald-100
                    "
                  />

                  <div
                    className="
                      absolute
                      left-0.5
                      top-0.5
                      h-5
                      w-5
                      rounded-full
                      bg-white
                      shadow-sm
                      transition-transform
                      peer-checked:translate-x-5
                    "
                  />
                </div>
              </label>

              {/* Footer */}
              <div className="flex flex-col-reverse gap-2 border-t border-slate-100 pt-4 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-[10px] text-slate-400">
                  Приемат се само PDF файлове.
                </p>

                <button
                  onClick={upload}
                  disabled={busy || !name.trim() || !file}
                  className="
                    inline-flex
                    items-center
                    justify-center
                    gap-2
                    rounded-xl
                    bg-[#0f2240]
                    px-5
                    py-2.5
                    text-xs
                    font-semibold
                    text-white
                    shadow-sm
                    transition
                    hover:bg-[#172f55]
                    disabled:cursor-not-allowed
                    disabled:opacity-40
                  "
                >
                  {busy ? (
                    <>
                      <Loader2 size={15} className="animate-spin" />
                      Качване…
                    </>
                  ) : (
                    <>
                      <Upload size={15} />
                      Качи документа
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Documents */}
        {sectionDocs.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-200 bg-white px-5 py-14 text-center shadow-sm">
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-50 text-slate-300">
              <FileText size={22} />
            </div>

            <h3 className="text-sm font-semibold text-slate-600">
              Няма документи в този раздел
            </h3>

            <p className="mx-auto mt-1 max-w-sm text-xs leading-5 text-slate-400">
              Добави първия PDF документ, за да се появи в този раздел.
            </p>

            {!open && (
              <button
                onClick={() => setOpen(true)}
                className="
                  mt-4
                  inline-flex
                  items-center
                  gap-1.5
                  rounded-xl
                  bg-[#0f2240]
                  px-4
                  py-2
                  text-xs
                  font-semibold
                  text-white
                  transition
                  hover:bg-[#172f55]
                "
              >
                <Plus size={14} />
                Добави документ
              </button>
            )}
          </div>
        ) : isInternal ? (
          <div className="space-y-5">
            {RUBRICS.map(r => {
              const items = sectionDocs.filter(
                d => (d.category || 'other') === r.key,
              )

              if (items.length === 0) return null

              return (
                <section key={r.key}>
                  <div className="mb-2.5 flex items-center gap-2 px-1">
                    <span
                      className="h-2.5 w-2.5 rounded-full"
                      style={{ backgroundColor: r.color }}
                      aria-hidden="true"
                    />

                    <h3 className="text-[11px] font-bold uppercase tracking-wide text-slate-500">
                      {r.title}
                    </h3>

                    <span className="rounded-full bg-slate-100 px-1.5 py-0.5 text-[9px] font-semibold text-slate-400">
                      {items.length}
                    </span>
                  </div>

                  <div className="space-y-2">
                    {items.map(d => (
                      <DocRow key={d.id} d={d} color={r.color} />
                    ))}
                  </div>
                </section>
              )
            })}
          </div>
        ) : (
          <div className="space-y-2">
            {sectionDocs.map(d => (
              <DocRow key={d.id} d={d} color="#64748b" />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
```
