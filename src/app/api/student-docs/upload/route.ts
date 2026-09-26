// Качване на файл в папката на дете в Drive (отделен маршрут, защото server actions имат лимит 1 MB)
import { NextRequest, NextResponse } from 'next/server'
import { uploadForStudent } from '@/lib/student-drive'

const MAX = 10 * 1024 * 1024 // 10 MB

export async function POST(req: NextRequest) {
  const form = await req.formData().catch(() => null)
  const studentId = String(form?.get('studentId') || '')
  const file = form?.get('file')
  if (!studentId || !(file instanceof File)) {
    return NextResponse.json({ error: 'Липсва файл' }, { status: 400 })
  }
  if (file.size > MAX) {
    return NextResponse.json({ error: `„${file.name}" е над 10 MB` }, { status: 400 })
  }
  const data = Buffer.from(await file.arrayBuffer())
  const r = await uploadForStudent(studentId, file.name, file.type, data)
  return NextResponse.json(r, { status: r.error ? 400 : 200 })
}
