import { createClient } from '@/lib/supabase/server'
import { School } from 'lucide-react'
import SchoolFilesCardClient from './SchoolFilesCardClient'

// Сървърен: взема училищата (с файлове) на децата от паралелките на класния
export default async function SchoolFilesCard({ profileId, currentYearId, bare = false }: { profileId: string; currentYearId: string; bare?: boolean }) {
  const supabase = await createClient()

  // моите паралелки
  const { data: cta } = await supabase
    .from('class_teacher_assignments').select('class_id')
    .eq('staff_id', profileId).eq('academic_year_id', currentYearId)
  const classIds = (cta || []).map(a => a.class_id)
  if (classIds.length === 0) return null

  // децата в тези паралелки → техните училища
  const { data: enr } = await supabase
    .from('student_enrollments')
    .select('student:students(sending_school_id, status, first_name, last_name)')
    .in('class_id', classIds).eq('academic_year_id', currentYearId)
  const kids = (enr || []).map((e: any) => e.student).filter((s: any) => s && s.status === 'active' && s.sending_school_id)
  const schoolIds = Array.from(new Set(kids.map((s: any) => s.sending_school_id)))
  // кои деца са от всяко училище (малки имена — за да се знае за кого е планът)
  const kidsBySchool: Record<string, string[]> = {}
  kids.forEach((s: any) => { (kidsBySchool[s.sending_school_id] ||= []).push(s.first_name || '') })
  if (schoolIds.length === 0) return null

  // файловете на тези училища
  const { data: files } = await supabase
    .from('school_files')
    .select('id, name, path, school_id, created_at, school:sending_schools(name)')
    .in('school_id', schoolIds)
    .order('created_at', { ascending: false })
  if (!files || files.length === 0) return null

  // групираме по училище
  const bySchool: Record<string, { name: string; kids: string[]; files: { id: string; name: string; path: string; created_at: string }[] }> = {}
  files.forEach((f: any) => {
    if (!bySchool[f.school_id]) bySchool[f.school_id] = { name: f.school?.name || 'Училище', kids: (kidsBySchool[f.school_id] || []).sort((a, b) => a.localeCompare(b, 'bg')), files: [] }
    bySchool[f.school_id].files.push({ id: f.id, name: f.name, path: f.path, created_at: f.created_at })
  })
  // най-новото отгоре
  const groups = Object.values(bySchool).sort((a, b) => (b.files[0]?.created_at || '').localeCompare(a.files[0]?.created_at || '') || a.name.localeCompare(b.name, 'bg'))

  return <SchoolFilesCardClient groups={groups} bare={bare} />
}
