'use server'

import { listMyDocs, createMyBlank, renameMyDoc, trashMyDocs, shareMyDoc, listSharedDocs } from '@/lib/staff-drive'

// „Моите документи“ (лична папка в Drive) — ownerId не се ползва, служителят е влезлият
export async function listStaffDocs(_ownerId?: string) {
  return listMyDocs()
}
export async function createBlankStaffDoc(_ownerId: string, name: string) {
  return createMyBlank(name)
}
export async function renameStaffDoc(_ownerId: string, fileId: string, name: string) {
  return renameMyDoc(fileId, name)
}
export async function trashStaffDocs(_ownerId: string, fileIds: string[]) {
  return trashMyDocs(fileIds)
}
export async function shareStaffDoc(fileId: string, shared: boolean) {
  return shareMyDoc(fileId, shared)
}
export async function listSharedStaffDocs() {
  return listSharedDocs()
}
