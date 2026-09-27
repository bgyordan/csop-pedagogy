// Общите файлове на паралелката в Drive (папката 2026-2027 / 01, до папките на децата)
// Вижда и редактира САМО класният на паралелката + админ/директор/ЗДУД.

import { createClient } from '@/lib/supabase/server'
import {
  ensureClassFolder, findClassFolder, folderUrl, listFolder, uploadFile, createGoogleDoc,
  shareWriter, accountEmails, getFileMeta, downloadFile, renameFile, trashFile, countStudentFiles, type DriveItem,
} from '@/lib/google-drive'

const MANAGERS = ['admin', 'director', 'zdud']
const FOLDER = 'application/vnd.google-apps.folder'

type ClassCtx = {
  userEmail: string
  myName: string
  yearName: string
  className: string
  teachers: string[][]   // класните → [csop-varna.bg, edu.mon.bg]
}

async function classContext(classId: string): Promise<ClassCtx | { error: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Не сте влезли в системата' }

  const { data: me } = await supabase.from('staff_profiles').select('id, role, first_name, last_name').eq('user_id', user.id).maybeSingle()
  const { data: cls } = await supabase.from('classes').select('name').eq('id', classId).maybeSingle()
  if (!cls) return { error: 'Няма такава паралелка' }
  const { data: year } = await supabase.from('academic_years').select('id, name').eq('is_current', true).single()

  const { data: ct } = await supabase.from('class_teacher_assignments')
    .select('staff_id, staff:staff_profiles(email)')
    .eq('class_id', classId).eq('academic_year_id', year?.id)

  const isTeacher = !!me && (ct || []).some((a: any) => a.staff_id === me.id)
  if (!me || !(isTeacher || MANAGERS.includes(me.role))) return { error: 'Документите на паралелката вижда само класният ръководител.' }

  return {
    userEmail: user.email || '',
    myName: `${me.first_name} ${me.last_name}`,
    yearName: year?.name || '',
    className: cls.name || '',
    teachers: (ct || []).map((a: any) => accountEmails(a.staff?.email)).filter(a => a.length),
  }
}

// Папката на паралелката + права за класния (и двата му акаунта)
async function folderFor(ctx: ClassCtx) {
  const id = await ensureClassFolder(ctx.yearName, ctx.className)
  for (const accounts of ctx.teachers)
    for (const e of accounts) { try { await shareWriter(id, e) } catch { /* няма такъв акаунт */ } }
  return id
}

async function ownFile(ctx: ClassCtx, fileId: string) {
  const folderId = await findClassFolder(ctx.yearName, ctx.className)
  if (!folderId) return false
  const meta = await getFileMeta(fileId)
  return !!meta.parents?.includes(folderId)
}

// Само файловете на паралелката — папките на децата не се показват тук
export async function listForClass(classId: string): Promise<{ files?: DriveItem[]; folderUrl?: string; canEdit?: boolean; myEmail?: string; error?: string }> {
  const ctx = await classContext(classId)
  if ('error' in ctx) return { error: ctx.error }
  try {
    const folderId = await findClassFolder(ctx.yearName, ctx.className)
    if (!folderId) return { files: [], canEdit: true, myEmail: ctx.userEmail }
    const files = (await listFolder(folderId)).filter(f => f.mimeType !== FOLDER)
    return { files, folderUrl: folderUrl(folderId), canEdit: true, myEmail: ctx.userEmail }
  } catch (e: any) {
    return { error: e?.message || 'Грешка при връзката с Drive' }
  }
}

export async function uploadForClass(classId: string, name: string, mime: string, data: Buffer) {
  const ctx = await classContext(classId)
  if ('error' in ctx) return { error: ctx.error }
  try {
    const doc = await uploadFile(name, await folderFor(ctx), data, mime, { uploadedBy: ctx.myName })
    return { url: doc.url }
  } catch (e: any) {
    return { error: e?.message || 'Грешка при качването' }
  }
}

export async function createBlankForClass(classId: string, name: string) {
  const ctx = await classContext(classId)
  if ('error' in ctx) return { error: ctx.error }
  if (!name.trim()) return { error: 'Въведете име на документа.' }
  try {
    const doc = await createGoogleDoc(name.trim(), await folderFor(ctx))
    return { url: doc.url }
  } catch (e: any) {
    return { error: e?.message || 'Грешка при създаването' }
  }
}

export async function downloadForClass(classId: string, fileId: string, as: 'office' | 'pdf') {
  const ctx = await classContext(classId)
  if ('error' in ctx) return { error: ctx.error }
  try {
    if (!(await ownFile(ctx, fileId))) return { error: 'Файлът не е на тази паралелка' }
    return await downloadFile(fileId, as)
  } catch (e: any) {
    return { error: e?.message || 'Грешка при свалянето' }
  }
}

export async function renameForClass(classId: string, fileId: string, name: string) {
  const ctx = await classContext(classId)
  if ('error' in ctx) return { error: ctx.error }
  if (!name.trim()) return { error: 'Името не може да е празно.' }
  try {
    if (!(await ownFile(ctx, fileId))) return { error: 'Файлът не е на тази паралелка' }
    await renameFile(fileId, name.trim())
    return { ok: true }
  } catch (e: any) {
    return { error: e?.message || 'Грешка при преименуването' }
  }
}

export async function trashForClass(classId: string, fileIds: string[]) {
  const ctx = await classContext(classId)
  if ('error' in ctx) return { error: ctx.error }
  try {
    for (const id of fileIds) {
      if (!(await ownFile(ctx, id))) return { error: 'Файлът не е на тази паралелка' }
      await trashFile(id)
    }
    return { ok: true }
  } catch (e: any) {
    return { error: e?.message || 'Грешка при изтриването' }
  }
}

// Брой документи на всяко дете от паралелката (за картите в таблото)
export async function docCountsForClass(classId: string, studentIds: string[]): Promise<Record<string, number>> {
  const ctx = await classContext(classId)
  if ('error' in ctx) return {}
  try {
    return await countStudentFiles(studentIds, ctx.yearName)
  } catch {
    return {}
  }
}
