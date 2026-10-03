import Link from 'next/link'
import { Globe, ArrowRight, Images } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'

const KIND: Record<string, string> = { cabinet: 'Кабинет', project: 'Проект', event: 'Събитие', material: 'Материал' }

// Портфолио на таблото: управата вижда последните публикации + чакащите за сайта;
// деловодителят — само опашката „За сайта“. Ако таблиците още ги няма — нищо.
export default async function PortfolioStrip({ mode }: { mode: 'manager' | 'secretary' }) {
  const supabase = await createClient()
  const [recentRes, queueRes] = await Promise.all([
    mode === 'manager'
      ? supabase.from('portfolio_posts').select('id, title, kind, cover_path, author_id, created_at').order('created_at', { ascending: false }).limit(6)
      : Promise.resolve({ data: [], error: null } as any),
    supabase.from('portfolio_posts').select('id, title, kind, author_id, site_requested_at, site_news_id').eq('site_status', 'requested').order('site_requested_at', { ascending: true }).limit(8),
  ])
  if (queueRes.error) return null
  const recent: any[] = recentRes.data || []
  const queue: any[] = queueRes.data || []
  if (mode === 'secretary' && queue.length === 0) return null
  if (mode === 'manager' && recent.length === 0 && queue.length === 0) return null

  const ids = Array.from(new Set([...recent, ...queue].map(p => p.author_id).filter(Boolean)))
  const [{ data: staff }, { data: media }] = await Promise.all([
    ids.length ? supabase.from('staff_profiles').select('id, first_name, last_name').in('id', ids) : Promise.resolve({ data: [] } as any),
    recent.length ? supabase.from('portfolio_media').select('post_id, path, thumb_path, sort').in('post_id', recent.map(p => p.id)).not('thumb_path', 'is', null).order('sort') : Promise.resolve({ data: [] } as any),
  ])
  const name: Record<string, string> = {}
  ;(staff || []).forEach((s: any) => { name[s.id] = `${s.first_name} ${s.last_name}` })
  const thumbOf: Record<string, string> = {}
  ;(media || []).forEach((m: any) => {
    const p = recent.find(r => r.id === m.post_id)
    if (!thumbOf[m.post_id] || (p && p.cover_path === m.path)) thumbOf[m.post_id] = m.thumb_path
  })
  const paths = Object.values(thumbOf)
  const signed: Record<string, string> = {}
  if (paths.length) {
    const { data } = await supabase.storage.from('portfolio').createSignedUrls(paths, 3600)
    ;(data || []).forEach((d: any) => { if (d.signedUrl && d.path) signed[d.path] = d.signedUrl })
  }

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
      <div className="flex items-center gap-3 mb-4">
        <span className="inline-flex items-center justify-center w-9 h-9 rounded-xl bg-amber-50 text-amber-600 shrink-0"><Images size={17} /></span>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium text-slate-800">{mode === 'secretary' ? 'За сайта — предложени от колегите' : 'Портфолио — нови публикации'}</div>
          {queue.length > 0 && mode === 'manager' && <div className="text-[12.5px] text-sky-700 mt-0.5">{queue.length} {queue.length === 1 ? 'чака' : 'чакат'} за сайта</div>}
        </div>
        <Link href={mode === 'secretary' ? '/portfolio?tab=site' : '/portfolio'} className="inline-flex items-center gap-1 text-xs font-medium text-[#0f2240] hover:gap-1.5 transition-all">
          Към портфолиото <ArrowRight size={13} />
        </Link>
      </div>

      {mode === 'manager' && recent.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {recent.map(p => (
            <Link key={p.id} href={`/portfolio?open=${p.id}`} className="group block">
              <div className="aspect-[4/3] rounded-xl overflow-hidden bg-gradient-to-br from-slate-200 to-slate-300">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                {thumbOf[p.id] && signed[thumbOf[p.id]] && <img src={signed[thumbOf[p.id]]} alt="" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />}
              </div>
              <div className="text-[12.5px] font-medium text-slate-800 mt-1.5 line-clamp-1">{p.title}</div>
              <div className="text-[11px] text-slate-500 truncate">{KIND[p.kind]} · {name[p.author_id] || 'ЦСОП'}</div>
            </Link>
          ))}
        </div>
      )}

      {queue.length > 0 && (
        <div className={`${mode === 'manager' && recent.length ? 'mt-4 pt-4 border-t border-slate-200' : ''} space-y-1.5`}>
          {queue.map(p => (
            <Link key={p.id} href={`/portfolio?tab=site&open=${p.id}`}
              className="flex items-center gap-3 px-3 py-2 rounded-xl hover:bg-sky-50 transition-colors">
              <Globe size={14} className="text-sky-600 shrink-0" />
              <span className="text-[13px] text-slate-800 truncate flex-1">{p.title}</span>
              <span className="text-[11.5px] text-slate-500 shrink-0">{KIND[p.kind]} · {name[p.author_id] || 'ЦСОП'}</span>
              {p.site_news_id && <span className="text-[10.5px] px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 shrink-0">чернова</span>}
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
