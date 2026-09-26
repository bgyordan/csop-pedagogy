// Сървърна логика за документите на дете в Drive (ползва се от drive-actions и от /api/student-docs/upload)

import { createClient } from '@/lib/supabase/server'
import {
  ensureStudentFolder, findStudentFolder, listFolder, uploadFile, createGoogleDoc,
  shareWriter, accountEmails, getFileMeta, downloadFile, renameFile, trashFile, type DriveItem,
} from '@/lib/google-drive'

// Тези роли могат да качват/създават документи за всяко дете; останалите — само ако са в ЕПЛР екипа му
const MANAGERS = ['admin', 'zdud', 'director', 'secretary']

export type StudentCtx = {
  supabase: Awaited<ReturnType<typeof createClient>>
  userEmail: string
  meId: string | null
  myName: string
  studentName: string
  yearName: string
  className: string
  people: string[][]   // всеки член на екипа → [csop-varna.bg, edu.mon.bg]
  canEdit: boolean
}

export async function studentContext(studentId: string): Promise<StudentCtx | { error: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Не сте влезли в системата' }

  const { data: me } = await supabase.from('staff_profiles').select('id, role, first_name, last_name').eq('user_id', user.id).maybeSingle()

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
      psychologist:staff_profiles!eplr_teams_psychologist_id_fkey(id, email),
      speech_therapist:staff_profiles!eplr_teams_speech_therapist_id_fkey(id, email),
      rehabilitator:staff_profiles!eplr_teams_rehabilitator_id_fkey(id, email),
      class_teacher:staff_profiles!eplr_teams_class_teacher_id_fkey(id, email)
    `).eq('student_id', studentId).eq('academic_year_id', year?.id).maybeSingle()

  const members = [team?.psychologist, team?.speech_therapist, team?.rehabilitator, team?.class_teacher]
    .filter(Boolean) as any[]
  const emails = Array.from(new Set(members.map(m => m.email as string).filter(Boolean)))
  const people = emails.map(accountEmails).filter(a => a.length)

  const canEdit = !!me && (MANAGERS.includes(me.role) || members.some(m => m.id === me.id))

  return {
    supabase,
    userEmail: user.email || '',
    meId: me?.id ?? null,
    myName: me ? `${me.first_name} ${me.last_name}` : (user.email || ''),
    studentName: `${student.first_name} ${student.last_name}`,
    yearName: year?.name || '',
    className,
    people,
    canEdit,
  }
}

// Дава права на ЕПЛР екипа върху папката (и двата акаунта на всеки). Вече дадените не се дублират.
export async function shareTeam(folderId: string, people: string[][], fallbackFileId?: string) {
  const shared: string[] = []
  const failed: string[] = []
  for (const accounts of people) {
    let ok = false
    for (const e of accounts) {
      try { await shareWriter(folderId, e); shared.push(e); ok = true }
      catch {
        if (fallbackFileId) {
          try { await shareWriter(fallbackFileId, e); shared.push(e); ok = true } catch { /* няма такъв акаунт */ }
        }
      }
    }
    // „без достъп" само ако НИТО един от двата акаунта не е минал
    if (!ok) failed.push(accounts[accounts.length - 1])
  }
  return { shared, failed }
}

// Списък на документите на детето за текущата година — направо от папката му в Drive
export async function listForStudent(studentId: string): Promise<{
  files?: DriveItem[]; folderUrl?: string; canEdit?: boolean; myEmail?: string; error?: string
}> {
  const ctx = await studentContext(studentId)
  if ('error' in ctx) return { error: ctx.error }
  try {
    const folderId = await findStudentFolder(studentId, ctx.yearName)
    if (!folderId) return { files: [], canEdit: ctx.canEdit, myEmail: ctx.userEmail }
    const files = await listFolder(folderId)
    return {
      files,
      folderUrl: `https://drive.google.com/drive/folders/${folderId}`,
      canEdit: ctx.canEdit,
      myEmail: ctx.userEmail,
    }
  } catch (e: any) {
    return { error: e?.message || 'Грешка при връзката с Drive' }
  }
}

async function folderFor(ctx: StudentCtx, studentId: string) {
  const folderId = await ensureStudentFolder(studentId, ctx.studentName, ctx.yearName, ctx.className)
  await shareTeam(folderId, ctx.people)   // всеки път — така и нов член на екипа получава достъп
  return folderId
}

// Качва един файл (напр. от Teams) в папката на детето с оригиналното му име
export async function uploadForStudent(studentId: string, name: string, mime: string, data: Buffer) {
  const ctx = await studentContext(studentId)
  if ('error' in ctx) return { error: ctx.error }
  if (!ctx.canEdit) return { error: 'Само ЕПЛР екипът на детето може да качва документи.' }
  try {
    const folderId = await folderFor(ctx, studentId)
    const doc = await uploadFile(name, folderId, data, mime, { uploadedBy: ctx.myName })
    return { url: doc.url }
  } catch (e: any) {
    return { error: e?.message || 'Грешка при качването' }
  }
}

// Нов празен Google документ в папката на детето
export async function createBlankForStudent(studentId: string, name: string) {
  const ctx = await studentContext(studentId)
  if ('error' in ctx) return { error: ctx.error }
  if (!ctx.canEdit) return { error: 'Само ЕПЛР екипът на детето може да създава документи.' }
  if (!name.trim()) return { error: 'Въведете име на документа.' }
  try {
    const folderId = await folderFor(ctx, studentId)
    const doc = await createGoogleDoc(name.trim(), folderId)
    return { url: doc.url }
  } catch (e: any) {
    return { error: e?.message || 'Грешка при създаването' }
  }
}

// Проверка, че файлът е в папката на ТОВА дете (за да не може да се тегли/трие чужд файл по id)
async function ownFile(ctx: StudentCtx, studentId: string, fileId: string) {
  const folderId = await findStudentFolder(studentId, ctx.yearName)
  if (!folderId) return false
  const meta = await getFileMeta(fileId)
  return !!meta.parents?.includes(folderId)
}

export async function downloadForStudent(studentId: string, fileId: string, as: 'office' | 'pdf') {
  const ctx = await studentContext(studentId)
  if ('error' in ctx) return { error: ctx.error }
  try {
    if (!(await ownFile(ctx, studentId, fileId))) return { error: 'Файлът не е на това дете' }
    return await downloadFile(fileId, as)
  } catch (e: any) {
    return { error: e?.message || 'Грешка при свалянето' }
  }
}

export async function renameForStudent(studentId: string, fileId: string, name: string) {
  const ctx = await studentContext(studentId)
  if ('error' in ctx) return { error: ctx.error }
  if (!ctx.canEdit) return { error: 'Само ЕПЛР екипът на детето може да преименува.' }
  if (!name.trim()) return { error: 'Името не може да е празно.' }
  try {
    if (!(await ownFile(ctx, studentId, fileId))) return { error: 'Файлът не е на това дете' }
    await renameFile(fileId, name.trim())
    return { ok: true }
  } catch (e: any) {
    return { error: e?.message || 'Грешка при преименуването' }
  }
}

export async function trashForStudent(studentId: string, fileIds: string[]) {
  const ctx = await studentContext(studentId)
  if ('error' in ctx) return { error: ctx.error }
  if (!ctx.canEdit) return { error: 'Само ЕПЛР екипът на детето може да изтрива.' }
  try {
    for (const id of fileIds) {
      if (!(await ownFile(ctx, studentId, id))) return { error: 'Файлът не е на това дете' }
      await trashFile(id)
    }
    return { ok: true }
  } catch (e: any) {
    return { error: e?.message || 'Грешка при изтриването' }
  }
}
