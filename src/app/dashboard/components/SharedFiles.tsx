'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { listSharedStaffDocs } from '@/app/my-files/staff-drive-actions'
import { Share2, Download, ArrowRight, File, FileText, FileSpreadsheet, FileImage, Eye, Globe, DoorOpen, Lightbulb, PartyPopper, BookOpen } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { DocViewer } from '@/components/registry/DocViewer'

type Row = {
  id: string
  name: string
  path: string
  mime_type: string | null
  created_at: string
  url?: string
  owner: { first_name: string; last_name: string } | null
}

// „днес 10:24“ / „вчера“ / „3 окт.“
function when(iso: string) {
  if (!iso) return ''
  const d = new Date(iso), now = new Date()
  const days = Math.floor((new Date(now.toDateString()).getTime() - new Date(d.toDateString()).getTime()) / 864e5)
  if (days === 0) return `днес ${d.toLocaleTimeString('bg-BG', { hour: '2-digit', minute: '2-digit' })}`
  if (days === 1) return 'вчера'
  return d.toLocaleDateString('bg-BG', { day: 'numeric', month: 'short' })
}
const isFresh = (iso: string) => !!iso && Date.now() - new Date(iso).getTime() < 2 * 864e5

function icon(name: string, mime: string | null) {
  const m = (mime || '').toLowerCase(); const n = name.toLowerCase()
  if (m.includes('pdf') || n.endsWith('.pdf')) return <FileText size={16} style={{ color: '#dc2626' }} />
  if (m.includes('word') || m.includes('document') || n.endsWith('.doc') || n.endsWith('.docx')) return <FileText size={16} style={{ color: '#2563eb' }} />
  if (m.includes('sheet') || m.includes('excel') || n.endsWith('.xls') || n.endsWith('.xlsx') || n.endsWith('.csv')) return <FileSpreadsheet size={16} style={{ color: '#16a34a' }} />
  if (m.startsWith('image/') || /\.(png|jpe?g|gif|webp|svg)$/.test(n)) return <FileImage size={16} style={{ color: '#9333ea' }} />
  return <File size={16} style={{ color: '#64748b' }} />
}

// Публикация от Портфолио (в общия списък „Споделено от колеги“)
type PostRow = { id: string; title: string; kind: string; at: string; owner: string; site: boolean; thumb?: string }
const KIND: Record<string, { label: string; I: typeof File; cls: string }> = {
  cabinet: { label: 'Кабинет', I: DoorOpen, cls: 'text-teal-600 bg-teal-50' },
  project: { label: 'Проект', I: Lightbulb, cls: 'text-amber-600 bg-amber-50' },
  event: { label: 'Събитие', I: PartyPopper, cls: 'text-rose-600 bg-rose-50' },
  material: { label: 'Материал', I: BookOpen, cls: 'text-violet-600 bg-violet-50' },
}

async function loadPosts(): Promise<PostRow[]> {
  const supabase = createClient()
  const cols = 'id, title, kind, author_id, created_at, site_status, cover_path'
  const [{ data: recent }, { data: queue }] = await Promise.all([
    supabase.from('portfolio_posts').select(cols).order('created_at', { ascending: false }).limit(6),
    supabase.from('portfolio_posts').select(cols).eq('site_status', 'requested').order('site_requested_at', { ascending: true }).limit(6),
  ])
  const all = [...(queue || []), ...(recent || [])].filter((p: any, i, a) => a.findIndex((x: any) => x.id === p.id) === i)
  if (!all.length) return []
  const ids = all.map((p: any) => p.id)
  const authors = Array.from(new Set(all.map((p: any) => p.author_id).filter(Boolean)))
  const [{ data: staff }, { data: media }] = await Promise.all([
    authors.length ? supabase.from('staff_profiles').select('id, first_name, last_name').in('id', authors) : Promise.resolve({ data: [] as any[] }),
    supabase.from('portfolio_media').select('post_id, path, thumb_path, sort').in('post_id', ids).not('thumb_path', 'is', null).order('sort'),
  ])
  const name: Record<string, string> = {}
  ;(staff || []).forEach((s: any) => { name[s.id] = `${s.first_name} ${s.last_name}` })
  const thumbOf: Record<string, string> = {}
  ;(media || []).forEach((m: any) => {
    const p: any = all.find((x: any) => x.id === m.post_id)
    if (!thumbOf[m.post_id] || p?.cover_path === m.path) thumbOf[m.post_id] = m.thumb_path
  })
  const paths = Object.values(thumbOf)
  const signed: Record<string, string> = {}
  if (paths.length) {
    const { data } = await supabase.storage.from('portfolio').createSignedUrls(paths, 3600)
    ;(data || []).forEach((d: any) => { if (d.signedUrl && d.path) signed[d.path] = d.signedUrl })
  }
  return all.map((p: any) => ({
    id: p.id, title: p.title, kind: p.kind, at: p.created_at, owner: name[p.author_id] || 'ЦСОП',
    site: p.site_status === 'requested', thumb: thumbOf[p.id] ? signed[thumbOf[p.id]] : undefined,
  }))
}

export default function SharedFiles({ bare = false, limit = 5, portfolio = false }: { bare?: boolean; limit?: number; portfolio?: boolean } = {}) {
  const [rows, setRows] = useState<Row[]>([])
  const [posts, setPosts] = useState<PostRow[]>([])
  const [loading, setLoading] = useState(true)
  const [viewing, setViewing] = useState<{ id: string; name: string } | null>(null)

  useEffect(() => {
    (async () => {
      // споделените лични документи на колегите — от Drive
      const [r, p] = await Promise.all([
        listSharedStaffDocs().catch(() => ({ files: [] as any[] })),
        portfolio ? loadPosts().catch(() => [] as PostRow[]) : Promise.resolve([] as PostRow[]),
      ])
      setPosts(p)
      setRows(((r as any).files || []).slice(0, limit).map((f: any) => ({
        id: f.id, name: f.name, path: '', mime_type: f.mimeType, created_at: f.modifiedTime, url: f.url,
        owner: { first_name: f.owner, last_name: '' },
      })))
      setLoading(false)
    })()
  }, [])

  function download(r: Row) {
    window.location.href = `/api/staff-docs/download?fileId=${r.id}&as=office`
  }

  // Пълна карта (таблото): компактна; клик на ред = преглед „само за четене“ (без нужда от Drive)
  if (!bare) {
    // Общ списък: първо чакащите за сайта, после най-новото — файлове и публикации, по дата
    type Item = { t: 'file'; at: string; r: Row } | { t: 'post'; at: string; p: PostRow }
    const pinned: Item[] = posts.filter(p => p.site).map(p => ({ t: 'post', at: p.at, p }))
    const rest: Item[] = [
      ...rows.map(r => ({ t: 'file' as const, at: r.created_at, r })),
      ...posts.filter(p => !p.site).map(p => ({ t: 'post' as const, at: p.at, p })),
    ].sort((a, b) => (b.at || '').localeCompare(a.at || ''))
    const items = [...pinned, ...rest].slice(0, limit)
    const fresh = items.filter(i => isFresh(i.at)).length
    return (
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm">
        <div className="flex items-center gap-2 px-4 py-2.5 border-b border-slate-100">
          <Share2 size={14} className="text-[#0f2240]" />
          <h2 className="text-[11px] font-semibold text-[#0f2240] uppercase tracking-widest flex-1">Споделено от колеги</h2>
          {fresh > 0 && <span className="text-[11px] px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">{fresh} нови</span>}
          <Link href={portfolio ? '/portfolio' : '/portfolio?tab=files'} className="text-xs text-slate-500 hover:text-[#0f2240] inline-flex items-center gap-1">Всички <ArrowRight size={13} /></Link>
        </div>
        <div className="p-1.5">
          {loading ? (
            <p className="text-sm text-slate-400 px-3 py-3">Зареждане…</p>
          ) : items.length === 0 ? (
            <p className="text-sm text-slate-400 px-3 py-3">Колегите още не са споделили нищо.</p>
          ) : items.map(it => it.t === 'post' ? (() => {
            const p = it.p; const k = KIND[p.kind] || KIND.cabinet
            return (
              <Link key={'p' + p.id} href={p.site ? `/portfolio?tab=site&open=${p.id}` : `/portfolio?open=${p.id}`}
                className={`flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg transition-colors hover:bg-slate-50 ${p.site ? 'bg-sky-50/60' : isFresh(p.at) ? 'bg-emerald-50/50' : ''}`}>
                {p.thumb
                  // eslint-disable-next-line @next/next/no-img-element
                  ? <img src={p.thumb} alt="" className="w-6 h-6 rounded-md object-cover flex-shrink-0" />
                  : <span className={`w-6 h-6 rounded-md flex items-center justify-center flex-shrink-0 ${k.cls}`}><k.I size={13} /></span>}
                <span className="text-sm text-slate-900 truncate flex-1 min-w-0">{p.title}</span>
                {p.site
                  ? <span className="text-[10px] px-1.5 py-0.5 rounded bg-sky-600 text-white flex-shrink-0 inline-flex items-center gap-1"><Globe size={10} /> за сайта</span>
                  : <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 flex-shrink-0">{k.label}</span>}
                <span className="text-xs text-slate-500 flex-shrink-0 hidden sm:block truncate max-w-[180px]">{p.owner} · {when(p.at)}</span>
                <span className="w-[60px] flex-shrink-0" />
              </Link>
            )
          })() : (() => {
            const r = it.r
            return (
              <div key={r.id} onClick={() => setViewing({ id: r.id, name: r.name })} title="Преглед"
                className={`flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg cursor-pointer transition-colors hover:bg-slate-50 ${isFresh(r.created_at) ? 'bg-emerald-50/50' : ''}`}>
                {portfolio ? <span className="w-6 h-6 flex items-center justify-center flex-shrink-0">{icon(r.name, r.mime_type)}</span> : icon(r.name, r.mime_type)}
                <span className="text-sm text-slate-900 truncate flex-1 min-w-0">{r.name}</span>
                {isFresh(r.created_at) && <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800 flex-shrink-0">ново</span>}
                <span className="text-xs text-slate-500 flex-shrink-0 hidden sm:block truncate max-w-[180px]">
                  {r.owner ? `${r.owner.first_name} ${r.owner.last_name}`.trim() : '—'} · {when(r.created_at)}
                </span>
                <button onClick={e => { e.stopPropagation(); setViewing({ id: r.id, name: r.name }) }} title="Преглед"
                  className="p-1.5 rounded-md text-slate-400 hover:text-[#0f2240] hover:bg-white flex-shrink-0"><Eye size={14} /></button>
                <button onClick={e => { e.stopPropagation(); download(r) }} title="Изтегли"
                  className="p-1.5 rounded-md text-slate-400 hover:text-[#0f2240] hover:bg-white flex-shrink-0"><Download size={14} /></button>
              </div>
            )
          })())}
        </div>
        <DocViewer file={viewing} onClose={() => setViewing(null)} />
      </div>
    )
  }

  return (
    <div className={bare ? '' : 'bg-white rounded-2xl border border-slate-200/70 p-6 shadow-sm'}>
      <div className={`flex items-center justify-between ${bare ? 'mb-2' : 'mb-4 pb-3 border-b border-slate-100'}`}>
        <div className="flex items-center gap-2">
          <Share2 size={bare ? 14 : 18} className="text-slate-400" />
          <h2 className={bare ? 'text-xs font-medium text-slate-500' : 'font-bold text-slate-800 text-sm uppercase tracking-wider'}>Споделено от колеги</h2>
        </div>
        <Link href="/portfolio?tab=files" className="text-[10px] font-bold text-blue-600 uppercase tracking-wider hover:text-blue-800 flex items-center gap-1">
          Виж всички <ArrowRight size={12} />
        </Link>
      </div>
      {loading ? (
        <p className="text-sm text-slate-400">Зареждане…</p>
      ) : rows.length === 0 ? (
        <p className="text-sm text-slate-400">Няма споделени файлове</p>
      ) : (
        <div className="divide-y divide-slate-50">
          {rows.map(r => (
            <div key={r.id} className="flex items-center gap-3 py-2 group">
              {icon(r.name, r.mime_type)}
              <span className="text-sm font-medium text-slate-700 truncate flex-1">{r.name}</span>
              <span className="text-[11px] text-slate-400 shrink-0 hidden sm:block">{r.owner ? `${r.owner.first_name} ${r.owner.last_name}`.trim() : '—'}</span>
              <button onClick={() => setViewing({ id: r.id, name: r.name })} title="Преглед" className="p-1 rounded hover:bg-slate-200 text-slate-400 shrink-0"><Eye size={15} /></button>
              <button onClick={() => download(r)} title="Изтегли" className="p-1 rounded hover:bg-slate-200 text-slate-400 shrink-0"><Download size={15} /></button>
            </div>
          ))}
        </div>
      )}
      <DocViewer file={viewing} onClose={() => setViewing(null)} />
    </div>
  )
}
