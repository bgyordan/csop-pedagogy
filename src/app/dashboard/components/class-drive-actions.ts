'use server'

import { listForClass, createBlankForClass, renameForClass, trashForClass, docCountsForClass } from '@/lib/class-drive'

// Таб „Документи на паралелката“ в таблото на класния
export async function listClassDocs(classId: string) {
  return listForClass(classId)
}

export async function createBlankClassDoc(classId: string, name: string) {
  return createBlankForClass(classId, name)
}

export async function renameClassDoc(classId: string, fileId: string, name: string) {
  return renameForClass(classId, fileId, name)
}

export async function trashClassDocs(classId: string, fileIds: string[]) {
  return trashForClass(classId, fileIds)
}

export async function classDocCounts(classId: string, studentIds: string[]) {
  return docCountsForClass(classId, studentIds)
}
