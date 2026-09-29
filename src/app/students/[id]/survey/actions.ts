'use server'
import { studentContext, shareTeam } from '@/lib/student-drive'
import { ensureStudentFolder, listFolder, trashFile, uploadDocxAsGoogleDoc } from '@/lib/google-drive'

// Името на анкетата в Drive — едно и също, за да се подменя, а не да се трупат копия
const SURVEY_DRIVE_NAME = 'Анкета – оценка на потребностите'

// Записва генерираната анкета (Word) в „Документи“ на детето в Drive (папката на паралелката).
// Ако вече има анкета там — старата отива в кошчето и се качва новата.
export async function saveSurveyToDrive(studentId: string, docxBase64: string): Promise<{ url?: string; error?: string; replaced?: boolean }> {
  const ctx = await studentContext(studentId)
  if ('error' in ctx) return { error: ctx.error }
  // анкетата я попълват терапевтите и координаторите — и те могат да я запишат
  const { data: me } = await ctx.supabase.from('staff_profiles').select('role, is_coordinator').eq('id', ctx.meId || '').maybeSingle()
  const allowed = ctx.canEdit || me?.is_coordinator === true || ['psychologist', 'speech_therapist', 'rehabilitator'].includes(me?.role || '')
  if (!allowed) return { error: 'Нямате права да записвате документи за това дете.' }
  try {
    const folderId = await ensureStudentFolder(studentId, ctx.studentName, ctx.yearName, ctx.className)
    const old = (await listFolder(folderId)).filter(f => f.name === SURVEY_DRIVE_NAME)
    for (const f of old) { try { await trashFile(f.id) } catch { /* нищо */ } }
    const doc = await uploadDocxAsGoogleDoc(SURVEY_DRIVE_NAME, folderId, docxBase64)
    await shareTeam(folderId, ctx.people, doc.id)
    return { url: doc.url, replaced: old.length > 0 }
  } catch (e: any) {
    return { error: e?.message || 'Грешка при връзката с Drive' }
  }
}
