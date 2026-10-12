// Портфолио: видео от Google Drive.
//  GET    — пуска видеото през ЕИС (с превъртане — Range), за всеки влязъл колега
//  DELETE — мести видеото в кошчето на диска (автор или управа)
// И двете работят САМО с файлове, качени като видео за портфолиото (appProperties.kind).
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getFileMeta, streamDriveFile, trashFile, PORTFOLIO_VIDEO_KIND } from '@/lib/google-drive'

const MANAGERS = ['admin', 'zdud', 'director']

async function me() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data } = await supabase.from('staff_profiles').select('id, role').eq('user_id', user.id).single()
  return data as { id: string; role: string } | null
}

async function videoMeta(id: string) {
  if (!/^[\w-]{10,}$/.test(id)) return null
  const meta = await getFileMeta(id).catch(() => null)
  return meta && meta.appProperties?.kind === PORTFOLIO_VIDEO_KIND ? meta : null
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  if (!(await me())) return new NextResponse('Не сте влезли', { status: 401 })
  const meta = await videoMeta(id)
  if (!meta) return new NextResponse('Няма такова видео', { status: 404 })

  const res = await streamDriveFile(id, req.headers.get('range'))
  if (!res.ok && res.status !== 206) return new NextResponse('Видеото не може да се зареди', { status: 502 })
  const h = new Headers()
  h.set('Content-Type', meta.mimeType || res.headers.get('content-type') || 'video/mp4')
  h.set('Accept-Ranges', 'bytes')
  h.set('Cache-Control', 'private, max-age=3600')
  for (const k of ['content-length', 'content-range']) { const v = res.headers.get(k); if (v) h.set(k, v) }
  return new NextResponse(res.body, { status: res.status, headers: h })
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const user = await me()
  if (!user) return NextResponse.json({ error: 'Не сте влезли' }, { status: 401 })
  const meta = await videoMeta(id)
  if (!meta) return NextResponse.json({ ok: true }) // вече го няма
  if (meta.appProperties?.uploader !== user.id && !MANAGERS.includes(user.role)) return NextResponse.json({ error: 'Нямате права' }, { status: 403 })
  try { await trashFile(id) } catch (e: any) { return NextResponse.json({ error: e?.message || 'Грешка' }, { status: 500 }) }
  return NextResponse.json({ ok: true })
}
