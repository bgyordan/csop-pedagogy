// Брой документи в Drive по деца — обикновена заявка (fetch), НЕ server action.
// Server action, тръгнал при отваряне на списък, ако още върви, когато колегата щракне върху дете,
// връщаше Next.js обратно към списъка (първия път Drive е бавен). fetch не пипа навигацията.
import { NextRequest, NextResponse } from 'next/server'
import { docCountsForStudents, docCountsForClass } from '@/lib/class-drive'

export async function POST(req: NextRequest) {
  let body: any = {}
  try { body = await req.json() } catch { /* празно */ }
  const ids: string[] = Array.isArray(body.ids) ? body.ids.filter((x: unknown) => typeof x === 'string').slice(0, 600) : []
  if (!ids.length) return NextResponse.json({})
  const counts = typeof body.classId === 'string' && body.classId
    ? await docCountsForClass(body.classId, ids)
    : await docCountsForStudents(ids)
  return NextResponse.json(counts || {}, { headers: { 'Cache-Control': 'no-store' } })
}
