'use server'

import { googleOpenUrl } from '@/lib/drive-link'
import { ensureStudentFolder, createGoogleDoc, uploadDocxAsGoogleDoc } from '@/lib/google-drive'
import { studentContext, shareTeam, listForStudent, createBlankForStudent, renameForStudent, trashForStudent, listTemplates, createFromTemplateForStudent, yearsForStudent, copyFromYearForStudent } from '@/lib/student-drive'

type DriveResult = { url?: string; error?: string; shared?: string[]; failed?: string[]; existed?: boolean }

// ── Таб „Документи" в досието ──────────────────────────────────────────

// Файловете на детето за текущата година (направо от Drive)
export async function listStudentDocs(studentId: string, year?: string) {
  return listForStudent(studentId, year)
}

// Копира документите на детето от минала година в текущата
export async function copyFromYear(studentId: string, fromYear: string, fileIds?: string[]) {
  return copyFromYearForStudent(studentId, fromYear, fileIds)
}

// Годините за избора горе вдясно
export async function listDocYears() {
  return yearsForStudent()
}

// Нов празен документ с дадено име
export async function createBlankDoc(studentId: string, name: string, year?: string) {
  return createBlankForStudent(studentId, name, year)
}

// Бланките от папка „Бланки“ в диска
export async function listDocTemplates() {
  return listTemplates()
}

// Нов документ от бланка (с попълнени данни за детето)
export async function createFromTemplate(studentId: string, templateId: string) {
  return createFromTemplateForStudent(studentId, templateId)
}

export async function renameDoc(studentId: string, fileId: string, name: string, year?: string) {
  return renameForStudent(studentId, fileId, name, year)
}

// Към кошчето в Drive (възстановимо 30 дни)
export async function trashDocs(studentId: string, fileIds: string[], year?: string) {
  return trashForStudent(studentId, fileIds, year)
}

// ── Генераторът и старата карта с линкове ───────────────────────────────

// Празен Google документ (свободни бележки)
export async function createDriveDoc(studentId: string, title: string): Promise<DriveResult> {
  return makeDriveDoc(studentId, title, title, null)
}

// Документ от генератора: първия път го създава попълнен, после само връща линка
// driveName = името на файла в Drive (напр. „Протокол 1"), title = името в досието (с учебната година)
export async function openGeneratedInDrive(studentId: string, title: string, driveName: string, docxBase64: string): Promise<DriveResult> {
  const ctx = await studentContext(studentId)
  if ('error' in ctx) return { error: ctx.error }
  const { data: existing } = await ctx.supabase
    .from('student_drive_files').select('url')
    .eq('student_id', studentId).eq('title', title)
    .order('created_at', { ascending: false }).limit(1).maybeSingle()
  if (existing?.url) return { url: googleOpenUrl(existing.url, ctx.openEmail), existed: true }
  const r = await makeDriveDoc(studentId, title, driveName, docxBase64)
  if (r.url) r.url = googleOpenUrl(r.url, ctx.openEmail)   // отваря с училищния акаунт
  return r
}

// Създава документа в папката на детето, дава права на ЕПЛР екипа и го записва в досието
async function makeDriveDoc(studentId: string, title: string, driveName: string, docxBase64: string | null): Promise<DriveResult> {
  const ctx = await studentContext(studentId)
  if ('error' in ctx) return { error: ctx.error }

  try {
    const folderId = await ensureStudentFolder(studentId, ctx.studentName, ctx.yearName, ctx.className)
    const doc = docxBase64
      ? await uploadDocxAsGoogleDoc(driveName, folderId, docxBase64)
      : await createGoogleDoc(driveName, folderId)

    // правата са на ПАПКАТА на детето → екипът вижда всичките му документи
    const { shared, failed } = await shareTeam(folderId, ctx.people, doc.id)

    const { error } = await ctx.supabase.from('student_drive_files').insert({
      student_id: studentId, title, url: doc.url, created_by: ctx.meId,
    })
    if (error) return { error: 'Документът е създаден, но не се записа в досието: ' + error.message, url: doc.url }

    return { url: doc.url, shared, failed, existed: false }
  } catch (e: any) {
    return { error: e?.message || 'Грешка при връзката с Drive' }
  }
}
