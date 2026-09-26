'use server'

import { createClient } from '@/lib/supabase/server'
import { ensureStudentFolder, createGoogleDoc, uploadDocxAsGoogleDoc, shareWriter, accountEmails } from '@/lib/google-drive'

type DriveResult = { url?: string; error?: string; shared?: string[]; failed?: string[]; existed?: boolean }

// Празен Google документ (свободни бележки)
export async function createDriveDoc(studentId: string, title: string): Promise<DriveResult> {
  return makeDriveDoc(studentId, title, title, null)
}

// Документ от генератора: първия път го създава попълнен, после само връща линка
// driveName = името на файла в Drive (напр. „Протокол 1“), title = името в досието (с учебната година)
export async function openGeneratedInDrive(studentId: string, title: string, driveName: string, docxBase64: string): Promise<DriveResult> {
  const supabase = await createClient()
  const { data: existing } = await supabase
    .from('student_drive_files').select('url')
    .eq('student_id', studentId).eq('title', title)
    .order('created_at', { ascending: false }).limit(1).maybeSingle()
  if (existing?.url) return { url: existing.url, existed: true }
  return makeDriveDoc(studentId, title, driveName, docxBase64)
}

// Създава документа в папката на детето, дава права на ЕПЛР екипа и го записва в досието
async function makeDriveDoc(studentId: string, title: string, driveName: string, docxBase64: string | null): Promise<DriveResult> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Не сте влезли в системата' }

  const { data: me } = await supabase.from('staff_profiles').select('id').eq('user_id', user.id).maybeSingle()

  const { data: student } = await supabase
    .from('students').select('first_name, last_name').eq('id', studentId).single()
  if (!student) return { error: 'Няма такова дете' }

  const { data: year } = await supabase.from('academic_years').select('id, name').eq('is_current', true).single()
  const { data: enrollment } = await supabase
    .from('student_enrollments').select('class:classes(name)')
    .eq('student_id', studentId).eq('academic_year_id', year?.id).maybeSingle()
  const className = ((enrollment as any)?.class?.name as string) || ''
  const { data: team } = await supabase
    .from('eplr_teams').select(`
      psychologist:staff_profiles!eplr_teams_psychologist_id_fkey(email),
      speech_therapist:staff_profiles!eplr_teams_speech_therapist_id_fkey(email),
      rehabilitator:staff_profiles!eplr_teams_rehabilitator_id_fkey(email),
      class_teacher:staff_profiles!eplr_teams_class_teacher_id_fkey(email)
    `).eq('student_id', studentId).eq('academic_year_id', year?.id).maybeSingle()

  const raw = [team?.psychologist, team?.speech_therapist, team?.rehabilitator, team?.class_teacher]
    .map((m: any) => m?.email as string | undefined)
  // права и на csop-varna.bg, и на edu.mon.bg акаунта
  const emails = Array.from(new Set(raw.flatMap(accountEmails)))

  try {
    const folderId = await ensureStudentFolder(studentId, `${student.first_name} ${student.last_name}`, year?.name || '', className)
    const doc = docxBase64
      ? await uploadDocxAsGoogleDoc(driveName, folderId, docxBase64)
      : await createGoogleDoc(driveName, folderId)

    // правата са на ПАПКАТА на детето → екипът вижда всичките му документи
    const shared: string[] = []
    const failed: string[] = []
    for (const e of emails) {
      try { await shareWriter(folderId, e); shared.push(e) }
      catch {
        try { await shareWriter(doc.id, e); shared.push(e) } catch { failed.push(e) }
      }
    }

    const { error } = await supabase.from('student_drive_files').insert({
      student_id: studentId, title, url: doc.url, created_by: me?.id ?? null,
    })
    if (error) return { error: 'Документът е създаден, но не се записа в досието: ' + error.message, url: doc.url }

    return { url: doc.url, shared, failed, existed: false }
  } catch (e: any) {
    return { error: e?.message || 'Грешка при връзката с Drive' }
  }
}
