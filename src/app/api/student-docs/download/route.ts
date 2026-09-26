// Сваляне на документ на дете: ?studentId=..&fileId=..&as=office|pdf
import { NextRequest, NextResponse } from 'next/server'
import { downloadForStudent } from '@/lib/student-drive'

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams
  const studentId = sp.get('studentId') || ''
  const fileId = sp.get('fileId') || ''
  const as = sp.get('as') === 'pdf' ? 'pdf' : 'office'
  if (!studentId || !fileId) return NextResponse.json({ error: 'Липсват данни' }, { status: 400 })

  const r = await downloadForStudent(studentId, fileId, as)
  if ('error' in r) return NextResponse.json({ error: r.error }, { status: 400 })

  const ascii = r.filename.replace(/[^\x20-\x7E]/g, '_').replace(/"/g, '')
  return new NextResponse(new Uint8Array(r.data), {
    headers: {
      'Content-Type': r.contentType,
      'Content-Disposition': `attachment; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(r.filename)}`,
      'Cache-Control': 'no-store',
    },
  })
}
