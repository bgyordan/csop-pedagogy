// Портфолио: отваря сесия за качване на видео направо в Google Drive (браузърът качва файла сам —
// не минава през нашия сървър и през Cloudflare, затова няма ограничение от 100 MB)
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { ensurePortfolioVideoFolder, startResumableUpload, PORTFOLIO_VIDEO_KIND } from '@/lib/google-drive'
import { VIDEO_MAX_MB } from '@/app/portfolio/lib'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Не сте влезли' }, { status: 401 })
  const { data: me } = await supabase.from('staff_profiles').select('id').eq('user_id', user.id).single()
  if (!me) return NextResponse.json({ error: 'Профил не е намерен' }, { status: 403 })

  const b = await req.json().catch(() => ({}))
  const name = String(b.name || 'video').slice(0, 200)
  const mime = String(b.mime || '') || 'video/mp4'
  const size = Number(b.size) || 0
  const postId = String(b.postId || '')
  if (!mime.startsWith('video/')) return NextResponse.json({ error: 'Това не е видео файл' }, { status: 400 })
  if (!size || size > VIDEO_MAX_MB * 1024 * 1024) return NextResponse.json({ error: `Видеото е над ${VIDEO_MAX_MB} MB` }, { status: 400 })

  const origin = req.headers.get('origin') || req.nextUrl.origin
  try {
    const folderId = await ensurePortfolioVideoFolder()
    const uploadUrl = await startResumableUpload({
      name: `${new Date().toISOString().slice(0, 10)} ${name}`, mime, size, folderId, origin,
      props: { kind: PORTFOLIO_VIDEO_KIND, uploader: me.id, ...(postId ? { post: postId } : {}) },
    })
    return NextResponse.json({ uploadUrl })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Грешка при връзка с Google Drive' }, { status: 500 })
  }
}
