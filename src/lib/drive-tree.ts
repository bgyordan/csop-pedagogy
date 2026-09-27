// Папка с ЕДНО ниво потребителски подпапки („Моите документи“, документите на паралелката).
// Системните папки (напр. папките на децата в папката на паралелката) не се показват.

import { listFolder, getFileMeta, type DriveItem } from '@/lib/google-drive'

const FOLDER = 'application/vnd.google-apps.folder'
// системна папка на EIS (папка на дете, година, паралелка…) — не се пипа оттук
const isSystem = (m: { appProperties?: Record<string, string> }) => !!(m.appProperties?.studentId || m.appProperties?.kind)

export type FolderGroup = DriveItem & { children: DriveItem[] }

export async function listTree(rootId: string): Promise<{ files: DriveItem[]; folders: FolderGroup[] }> {
  const all = await listFolder(rootId)
  const subs = all.filter(f => f.mimeType === FOLDER && !f.system)
  const files = all.filter(f => f.mimeType !== FOLDER)
  const folders = await Promise.all(subs.map(async f => ({
    ...f,
    children: (await listFolder(f.id)).filter(c => c.mimeType !== FOLDER),
  })))
  return { files, folders }
}

// Потребителска подпапка точно под root-а?
export async function isSubfolder(rootId: string, folderId: string) {
  if (folderId === rootId) return true
  const m = await getFileMeta(folderId)
  return m.mimeType === FOLDER && !isSystem(m) && !!m.parents?.includes(rootId)
}

// Файлът (или подпапката) е в root-а или в негова подпапка?
export async function inTree(rootId: string, fileId: string) {
  const m = await getFileMeta(fileId)
  if (isSystem(m)) return false
  const parents = m.parents ?? []
  if (parents.includes(rootId)) return true
  for (const p of parents) {
    const pm = await getFileMeta(p)
    if (pm.mimeType === FOLDER && !isSystem(pm) && pm.parents?.includes(rootId)) return true
  }
  return false
}
