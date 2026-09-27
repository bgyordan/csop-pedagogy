// Качване на файл в личната папка на служителя в Drive („Моите документи“)
import { NextRequest, NextResponse } from 'next/server'
import { uploadMyDoc } from '@/lib/staff-drive'

const MAX = 10 * 1024 * 1024 // 10 MB

export async function POST(req: NextRequest) {
  const form = await req.formData().catch(() => null)
  const file = form?.get('file')
  if (!(file instanceof File)) return NextResponse.json({ error: 'Липсва файл' }, { status: 400 })
  if (file.size > MAX) return NextResponse.json({ error: `„${file.name}" е над 10 MB` }, { status: 400 })
  const folderId = String(form?.get('folderId') || '') || undefined
  const r = await uploadMyDoc(file.name, file.type, Buffer.from(await file.arrayBuffer()), folderId)
  return NextResponse.json(r, { status: r.error ? 400 : 200 })
}
