// „Моите документи“ — личната папка на всеки служител в Drive (Служители / Име Фамилия)
// Вижда я само служителят (и EIS). Споделените файлове се виждат от всички в „Споделено от колеги“.

import { createClient } from '@/lib/supabase/server'
import {
  ensureStaffFolder, findStaffFolder, folderUrl, listFolder, uploadFile, createGoogleDoc, shareWriter, accountEmails,
  getFileMeta, downloadFile, renameFile, trashFile, setFileShared, listSharedStaffFiles, type DriveItem, type SharedItem,
} from '@/lib/google-drive'

const FOLDER = 'application/vnd.google-apps.folder'

type StaffCtx = { staffId: string; name: string; email: string; accounts: string[] }

async function me(): Promise<StaffCtx | { error: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Не сте влезли в системата' }
  const { data: p } = await supabase.from('staff_profiles').select('id, first_name, last_name, email').eq('user_id', user.id).maybeSingle()
  if (!p) return { error: 'Няма профил на служител' }
  return {
    staffId: p.id,
    name: `${p.first_name} ${p.last_name}`,
    email: user.email || '',
    accounts: accountEmails(p.email || user.email),
  }
}

// Папката + права за самия служител (двата му акаунта), за да отваря файловете в Google Docs
async function folderFor(ctx: StaffCtx) {
  const id = await ensureStaffFolder(ctx.staffId, ctx.name)
  for (const e of ctx.accounts) { try { await shareWriter(id, e) } catch { /* няма такъв акаунт */ } }
  return id
}

async function ownFile(ctx: StaffCtx, fileId: string) {
  const folderId = await findStaffFolder(ctx.staffId)
  if (!folderId) return false
  const meta = await getFileMeta(fileId)
  return !!meta.parents?.includes(folderId)
}

export async function listMyDocs(): Promise<{ files?: DriveItem[]; folderUrl?: string; canEdit?: boolean; myEmail?: string; error?: string }> {
  const ctx = await me()
  if ('error' in ctx) return { error: ctx.error }
  try {
    const folderId = await findStaffFolder(ctx.staffId)
    if (!folderId) return { files: [], canEdit: true, myEmail: ctx.email }
    const files = (await listFolder(folderId)).filter(f => f.mimeType !== FOLDER)
    return { files, folderUrl: folderUrl(folderId), canEdit: true, myEmail: ctx.email }
  } catch (e: any) {
    return { error: e?.message || 'Грешка при връзката с Drive' }
  }
}

export async function uploadMyDoc(name: string, mime: string, data: Buffer) {
  const ctx = await me()
  if ('error' in ctx) return { error: ctx.error }
  try {
    const doc = await uploadFile(name, await folderFor(ctx), data, mime, { uploadedBy: ctx.name })
    return { url: doc.url }
  } catch (e: any) {
    return { error: e?.message || 'Грешка при качването' }
  }
}

export async function createMyBlank(name: string) {
  const ctx = await me()
  if ('error' in ctx) return { error: ctx.error }
  if (!name.trim()) return { error: 'Въведете име на документа.' }
  try {
    const doc = await createGoogleDoc(name.trim(), await folderFor(ctx))
    return { url: doc.url }
  } catch (e: any) {
    return { error: e?.message || 'Грешка при създаването' }
  }
}

export async function renameMyDoc(fileId: string, name: string) {
  const ctx = await me()
  if ('error' in ctx) return { error: ctx.error }
  if (!name.trim()) return { error: 'Името не може да е празно.' }
  try {
    if (!(await ownFile(ctx, fileId))) return { error: 'Файлът не е ваш' }
    await renameFile(fileId, name.trim())
    return { ok: true }
  } catch (e: any) {
    return { error: e?.message || 'Грешка при преименуването' }
  }
}

export async function trashMyDocs(fileIds: string[]) {
  const ctx = await me()
  if ('error' in ctx) return { error: ctx.error }
  try {
    for (const id of fileIds) {
      if (!(await ownFile(ctx, id))) return { error: 'Файлът не е ваш' }
      await trashFile(id)
    }
    return { ok: true }
  } catch (e: any) {
    return { error: e?.message || 'Грешка при изтриването' }
  }
}

export async function shareMyDoc(fileId: string, shared: boolean) {
  const ctx = await me()
  if ('error' in ctx) return { error: ctx.error }
  try {
    if (!(await ownFile(ctx, fileId))) return { error: 'Файлът не е ваш' }
    await setFileShared(fileId, shared)
    return { ok: true }
  } catch (e: any) {
    return { error: e?.message || 'Грешка при споделянето' }
  }
}

// Споделеното от всички колеги (за таблото и страницата „Споделени файлове“)
export async function listSharedDocs(): Promise<{ files?: SharedItem[]; error?: string }> {
  const ctx = await me()
  if ('error' in ctx) return { error: ctx.error }
  try {
    return { files: await listSharedStaffFiles() }
  } catch (e: any) {
    return { error: e?.message || 'Грешка при връзката с Drive' }
  }
}

// Сваляне: собствен файл или споделен от колега
export async function downloadStaffDoc(fileId: string, as: 'office' | 'pdf') {
  const ctx = await me()
  if ('error' in ctx) return { error: ctx.error }
  try {
    const mine = await ownFile(ctx, fileId)
    const shared = !mine && (await listSharedStaffFiles()).some(f => f.id === fileId)
    if (!mine && !shared) return { error: 'Нямате достъп до този файл' }
    return await downloadFile(fileId, as)
  } catch (e: any) {
    return { error: e?.message || 'Грешка при свалянето' }
  }
}
