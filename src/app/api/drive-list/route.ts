// Списъкът с документи в Drive (досие, паралелка, мои документи) и годините — обикновена заявка, НЕ server action.
// Server action при отваряне на страницата, ако още върви, когато колегата смени таба или страницата,
// връщаше Next.js обратно (първия път Drive е бавен). fetch не пипа навигацията.
import { NextRequest, NextResponse } from 'next/server'
import { listForStudent, yearsForStudent } from '@/lib/student-drive'
import { listForClass } from '@/lib/class-drive'
import { listMyDocs } from '@/lib/staff-drive'

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams
  const kind = sp.get('kind') || 'student'
  const owner = sp.get('owner') || ''
  const year = sp.get('year') || undefined
  const H = { headers: { 'Cache-Control': 'no-store' } }
  try {
    if (sp.get('years')) return NextResponse.json(await yearsForStudent(), H)
    if (kind === 'staff') return NextResponse.json(await listMyDocs(), H)
    if (!owner) return NextResponse.json({ error: 'Липсват данни', files: [] }, H)
    if (kind === 'class') return NextResponse.json(await listForClass(owner), H)
    return NextResponse.json(await listForStudent(owner, year), H)
  } catch (e: any) {
    return NextResponse.json({ error: 'Няма връзка с Drive', files: [] }, H)
  }
}
