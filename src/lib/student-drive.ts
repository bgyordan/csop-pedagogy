// Сървърна логика за документите на дете в Drive (ползва се от drive-actions и от /api/student-docs/upload)

import { createClient } from '@/lib/supabase/server'
import {
  ensureStudentFolder, findStudentFolder, listFolder, uploadFile, createGoogleDoc,
  shareWriter, accountEmails, openAsEmail, getFileMeta, downloadFile, renameFile, trashFile, type DriveItem,
  findTemplatesFolder, copyFile, replaceMarkers, ensureYearFolder,
} from '@/lib/google-drive'
import { seesAllKids, ensureWriters } from '@/lib/drive-access'

// Тези роли могат да качват/създават документи за всяко дете; останалите — само ако са в ЕПЛР екипа му
const MANAGERS = ['admin', 'zdud', 'director', 'secretary']

export type StudentCtx = {
  supabase: Awaited<ReturnType<typeof createClient>>
  userEmail: string
  openEmail: string   // с този акаунт се отварят файловете в Drive
  meId: string | null
  myName: string
  studentName: string
  yearName: string
  className: string
  people: string[][]   // всеки член на екипа и терапевт по картон → [csop-varna.bg, edu.mon.bg]
  myAccounts: string[] // моите два акаунта
  isMember: boolean    // в ЕПЛР екипа или терапевт на детето по картон
  allKids: boolean     // психолог/логопед — редактира всички деца (право на папката на годината)
  canEdit: boolean
  canView: boolean     // виждане/сваляне: + учителите, които преподават на детето, + координаторите
}

// year = учебна година на документите (напр. „2025/2026“); без нея — текущата
export async function studentContext(studentId: string, year?: string): Promise<StudentCtx | { error: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Не сте влезли в системата' }

  const { data: me } = await supabase.from('staff_profiles').select('id, role, therapy_role, first_name, last_name, email, is_coordinator').eq('user_id', user.id).maybeSingle()

  const { data: student } = await supabase
    .from('students').select('first_name, last_name, therapist_psychologist_id, therapist_speech_id, therapist_rehab_id, therapist_rehab2_id').eq('id', studentId).single()
  if (!student) return { error: 'Няма такова дете' }

  const { data: current } = await supabase.from('academic_years').select('id, name').eq('is_current', true).single()
  // избрана минала година → нейната паралелка (ако детето е било записано), иначе „Без паралелка“
  const other = !!year && year !== current?.name
  const { data: picked } = other
    ? await supabase.from('academic_years').select('id, name').eq('name', year).maybeSingle()
    : { data: null }
  const docYear: { id: string | null; name: string } | null = other ? (picked || { id: null, name: year! }) : current
  const { data: enrollment } = docYear?.id
    ? await supabase.from('student_enrollments').select('class:classes(name)')
        .eq('student_id', studentId).eq('academic_year_id', docYear.id).maybeSingle()
    : { data: null }
  const className = ((enrollment as any)?.class?.name as string) || ''
  const year_ = current   // ЕПЛР екипът (права) е винаги от текущата година

  const { data: team } = await supabase
    .from('eplr_teams').select(`
      psychologist:staff_profiles!eplr_teams_psychologist_id_fkey(id, email),
      speech_therapist:staff_profiles!eplr_teams_speech_therapist_id_fkey(id, email),
      rehabilitator:staff_profiles!eplr_teams_rehabilitator_id_fkey(id, email),
      class_teacher:staff_profiles!eplr_teams_class_teacher_id_fkey(id, email)
    `).eq('student_id', studentId).eq('academic_year_id', year_?.id).maybeSingle()

  // Терапевтите по картон (псих., лог., рех., рех. 2) редактират като ЕПЛР екипа —
  // така смяна на екип или преместване не оставя терапевта без права
  const st: any = student
  const therapistIds = [st.therapist_psychologist_id, st.therapist_speech_id, st.therapist_rehab_id, st.therapist_rehab2_id]
    .filter(Boolean) as string[]
  const { data: therapists } = therapistIds.length
    ? await supabase.from('staff_profiles').select('id, email').in('id', therapistIds)
    : { data: [] as any[] }

  const byId = new Map<string, any>()
  for (const m of [team?.psychologist, team?.speech_therapist, team?.rehabilitator, team?.class_teacher, ...(therapists || [])])
    if (m) byId.set((m as any).id, m)
  const members = Array.from(byId.values())
  const emails = Array.from(new Set(members.map(m => m.email as string).filter(Boolean)))
  const people = emails.map(accountEmails).filter(a => a.length)

  const isMember = !!me && byId.has(me.id)
  const allKids = seesAllKids(me)
  const canEdit = !!me && (MANAGERS.includes(me.role) || isMember || allKids)

  // Виждане и сваляне: ЕПЛР екипът и управата + координаторите + учителите, които преподават на детето
  // (разписание на паралелката му, ИФО часове, ЦОУД група) — без да могат да качват/трият
  let canView = canEdit || !!me?.is_coordinator
  if (!canView && me && year_?.id) {
    const { data: enr } = await supabase.from('student_enrollments').select('class_id')
      .eq('student_id', studentId).eq('academic_year_id', year_.id).maybeSingle()
    if (enr?.class_id) {
      const { data: scheds } = await supabase.from('class_schedules').select('id')
        .eq('class_id', enr.class_id).eq('academic_year_id', year_.id)
      const ids = (scheds || []).map((x: any) => x.id)
      if (ids.length) {
        const { count } = await supabase.from('schedule_slots').select('*', { count: 'exact', head: true })
          .in('schedule_id', ids).eq('staff_id', me.id)
        canView = (count || 0) > 0
      }
    }
    if (!canView) {
      const { count } = await supabase.from('teacher_ifo_slots').select('*', { count: 'exact', head: true })
        .eq('teacher_id', me.id).eq('student_id', studentId).eq('academic_year_id', year_.id)
      canView = (count || 0) > 0
    }
    if (!canView) {
      const { data: coud } = await supabase.from('coud_enrollments').select('coud_group:coud_groups(teacher_id)')
        .eq('student_id', studentId).eq('academic_year_id', year_.id)
      canView = (coud || []).some((c: any) => c.coud_group?.teacher_id === me.id)
    }
  }

  return {
    supabase,
    userEmail: user.email || '',
    openEmail: openAsEmail(me?.email, user.email),
    meId: me?.id ?? null,
    myName: me ? `${me.first_name} ${me.last_name}` : (user.email || ''),
    studentName: `${student.first_name} ${student.last_name}`,
    yearName: docYear?.name || '',
    className,
    people,
    myAccounts: accountEmails(me?.email),
    isMember,
    allKids,
    canEdit,
    canView,
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
export async function listForStudent(studentId: string, year?: string): Promise<{
  files?: DriveItem[]; folderUrl?: string; canEdit?: boolean; myEmail?: string; error?: string
}> {
  const ctx = await studentContext(studentId, year)
  if ('error' in ctx) return { error: ctx.error }
  if (!ctx.canView) return { error: 'Нямате достъп до документите на това дете.' }
  try {
    // Права в Drive се дават при отваряне на таба — не чакаме някой да качи файл
    if (ctx.allKids) await ensureWriters(await ensureYearFolder(ctx.yearName), ctx.myAccounts)
    const folderId = await findStudentFolder(studentId, ctx.yearName)
    if (!folderId) return { files: [], canEdit: ctx.canEdit, myEmail: ctx.openEmail }
    if (ctx.isMember) await ensureWriters(folderId, ctx.myAccounts)
    const files = await listFolder(folderId)
    return {
      files,
      folderUrl: `https://drive.google.com/drive/folders/${folderId}`,
      canEdit: ctx.canEdit,
      myEmail: ctx.openEmail,
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
export async function uploadForStudent(studentId: string, name: string, mime: string, data: Buffer, year?: string) {
  const ctx = await studentContext(studentId, year)
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
export async function createBlankForStudent(studentId: string, name: string, year?: string) {
  const ctx = await studentContext(studentId, year)
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

export async function downloadForStudent(studentId: string, fileId: string, as: 'office' | 'pdf', year?: string) {
  const ctx = await studentContext(studentId, year)
  if ('error' in ctx) return { error: ctx.error }
  if (!ctx.canView) return { error: 'Нямате достъп до документите на това дете.' }
  try {
    if (!(await ownFile(ctx, studentId, fileId))) return { error: 'Файлът не е на това дете' }
    return await downloadFile(fileId, as)
  } catch (e: any) {
    return { error: e?.message || 'Грешка при свалянето' }
  }
}

export async function renameForStudent(studentId: string, fileId: string, name: string, year?: string) {
  const ctx = await studentContext(studentId, year)
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

export async function trashForStudent(studentId: string, fileIds: string[], year?: string) {
  const ctx = await studentContext(studentId, year)
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

// ── Бланки ──────────────────────────────────────────────────────────────

const TEMPLATE_TYPES = /document|word|opendocument\.text|spreadsheet|excel|presentation|powerpoint/

// Списъкът с бланки от папка „Бланки“ (само документи/таблици)
export async function listTemplates(): Promise<{ id: string; name: string; mimeType: string }[]> {
  try {
    const folderId = await findTemplatesFolder()
    if (!folderId) return []
    const items = await listFolder(folderId)
    return items
      .filter(f => TEMPLATE_TYPES.test(f.mimeType))
      .map(f => ({ id: f.id, name: f.name.replace(/\.(docx?|odt|xlsx?|pptx?)$/i, ''), mimeType: f.mimeType }))
  } catch (e: any) {
    console.error('[drive] бланки', e?.message || e)
    return []
  }
}

const fullName = (p: any) => p ? [p.first_name, p.middle_name, p.last_name].filter(Boolean).join(' ') : ''

function ageOn(birth: string | null | undefined) {
  if (!birth) return ''
  const b = new Date(birth), n = new Date()
  let a = n.getFullYear() - b.getFullYear()
  if (n.getMonth() < b.getMonth() || (n.getMonth() === b.getMonth() && n.getDate() < b.getDate())) a--
  return String(a)
}
// "01" → "I паралелка"; нечислови имена (напр. "ПГ 3") остават както са
function paralelka(className: string) {
  const m = (className || '').trim().match(/^0*(\d+)$/)
  if (!m) return className || ''
  let n = parseInt(m[1]), r = ''
  for (const [v, s] of [[10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I']] as [number, string][]) while (n >= v) { r += s; n -= v }
  return `${r} паралелка`
}
const bgDate = (d: string | Date | null | undefined) =>
  d ? new Date(d).toLocaleDateString('bg-BG', { day: '2-digit', month: '2-digit', year: 'numeric' }) : ''

// Всички маркери, които могат да се ползват в бланките
async function markerValues(ctx: StudentCtx, studentId: string): Promise<Record<string, string>> {
  const sb = ctx.supabase
  const { data: st } = await sb.from('students')
    .select('first_name, middle_name, last_name, birth_date, external_class, external_class_letter, sending_school:sending_schools(name, city)')
    .eq('id', studentId).single()
  const { data: year } = await sb.from('academic_years').select('id').eq('is_current', true).single()
  const { data: team } = await sb.from('eplr_teams').select(`
      psychologist:staff_profiles!eplr_teams_psychologist_id_fkey(first_name, middle_name, last_name),
      speech_therapist:staff_profiles!eplr_teams_speech_therapist_id_fkey(first_name, middle_name, last_name),
      rehabilitator:staff_profiles!eplr_teams_rehabilitator_id_fkey(first_name, middle_name, last_name),
      class_teacher:staff_profiles!eplr_teams_class_teacher_id_fkey(first_name, middle_name, last_name)
    `).eq('student_id', studentId).eq('academic_year_id', year?.id).maybeSingle()
  const { data: guardians } = await sb.from('student_guardians').select('full_name').eq('student_id', studentId).order('relation')
  // Координиращ екип за годината: председателят (роля „Председател…“) + останалите по реда на добавяне
  const { data: ke } = await sb.from('coordinating_team')
    .select('role_in_team, created_at, staff:staff_profiles(first_name, last_name, position)')
    .eq('academic_year_id', year?.id).order('created_at')
  const keLine = (m: any) => {
    if (!m?.staff) return ''
    const pos = (m.staff.position || '').trim()
    return `${m.staff.first_name} ${m.staff.last_name}` + (pos ? ` /${pos.charAt(0).toLowerCase() + pos.slice(1)}/` : '')
  }
  const chair = (ke || []).find((m: any) => /председател/i.test(m.role_in_team || ''))
  const others = (ke || []).filter((m: any) => m !== chair)
  const school = (st as any)?.sending_school
  return {
    'ИМЕ': fullName(st),
    'ИМЕ_КРАТКО': st ? `${st.first_name} ${st.last_name}` : ctx.studentName,
    'ДАТА_РАЖДАНЕ': bgDate(st?.birth_date),
    'ВЪЗРАСТ': ageOn(st?.birth_date),
    'КЛАС': ctx.className,
    'ПАРАЛЕЛКА': paralelka(ctx.className),
    'КЛАС_УЧИЛИЩЕ': [((st as any)?.external_class || '').toString().trim(), (st as any)?.external_class_letter || ''].filter(Boolean).join(' '),
    'УЧИЛИЩЕ': school ? [school.name, school.city].filter(Boolean).join(', ') : '',
    'ГОДИНА': ctx.yearName,
    'ДАТА': bgDate(new Date()),
    'КЛАСЕН': fullName((team as any)?.class_teacher),
    'ПСИХОЛОГ': fullName((team as any)?.psychologist),
    'ЛОГОПЕД': fullName((team as any)?.speech_therapist),
    'РЕХАБИЛИТАТОР': fullName((team as any)?.rehabilitator),
    'РОДИТЕЛ': (guardians || []).map(g => g.full_name).filter(Boolean).join(', '),
    'КЕ_ПРЕДСЕДАТЕЛ': keLine(chair),
    'КЕ_ЧЛЕН_1': keLine(others[0]),
    'КЕ_ЧЛЕН_2': keLine(others[1]),
    'КЕ_ЧЛЕН_3': keLine(others[2]),
  }
}

// Нов документ от бланка: копие в папката на детето + попълнени маркери
export async function createFromTemplateForStudent(studentId: string, templateId: string) {
  const ctx = await studentContext(studentId)
  if ('error' in ctx) return { error: ctx.error }
  if (!ctx.canEdit) return { error: 'Само ЕПЛР екипът на детето може да създава документи.' }
  try {
    const tplFolder = await findTemplatesFolder()
    const tpl = await getFileMeta(templateId)
    if (!tplFolder || !tpl.parents?.includes(tplFolder)) return { error: 'Няма такава бланка' }
    const name = tpl.name.replace(/\.(docx?|odt|xlsx?|pptx?)$/i, '')

    const folderId = await folderFor(ctx, studentId)
    // вече има документ с това име → отваряме него, не правим дубликат
    const existing = (await listFolder(folderId)).find(f => f.name === name)
    if (existing) return { url: existing.url, existed: true }

    const copy = await copyFile(templateId, name, folderId, tpl.mimeType)
    if (copy.mimeType === 'application/vnd.google-apps.document') {
      await replaceMarkers(copy.id, await markerValues(ctx, studentId))
    }
    return { url: copy.url }
  } catch (e: any) {
    return { error: e?.message || 'Грешка при създаването от бланка' }
  }
}

// Годините за избора в таб „Документи“: текущата + минали учебни години в системата (най-новата първа)
export async function yearsForStudent(): Promise<{ years: string[]; current: string }> {
  const supabase = await createClient()
  const { data } = await supabase.from('academic_years').select('name, is_current').order('name', { ascending: false })
  const current = (data || []).find((y: any) => y.is_current)?.name || ''
  const years = (data || []).map((y: any) => y.name as string).filter(n => !current || n <= current)
  return { years, current }
}

// „Копирай от минала година“: всички файлове на детето от fromYear → в текущата година.
// Копия (оригиналите остават); файл със същото име в текущата година се прескача.
export async function copyFromYearForStudent(studentId: string, fromYear: string, onlyIds?: string[]) {
  const ctx = await studentContext(studentId)
  if ('error' in ctx) return { error: ctx.error }
  if (!ctx.canEdit) return { error: 'Само ЕПЛР екипът на детето може да копира документи.' }
  if (!fromYear || fromYear === ctx.yearName) return { error: 'Изберете минала година.' }
  try {
    const src = await findStudentFolder(studentId, fromYear)
    const files = src ? (await listFolder(src)).filter(f => f.mimeType !== 'application/vnd.google-apps.folder' && (!onlyIds?.length || onlyIds.includes(f.id))) : []
    if (!files.length) return { error: `Няма документи за ${fromYear}.` }
    const dest = await folderFor(ctx, studentId)
    const have = new Set((await listFolder(dest)).map(f => f.name))
    let copied = 0, skipped = 0
    for (const f of files) {
      const toGdoc = f.mimeType.includes('word') || f.mimeType === 'application/vnd.oasis.opendocument.text'
      const name = toGdoc ? f.name.replace(/\.(docx?|odt)$/i, '') : f.name
      if (have.has(name)) { skipped++; continue }
      await copyFile(f.id, name, dest, f.mimeType)
      have.add(name); copied++
    }
    return { copied, skipped }
  } catch (e: any) {
    return { error: e?.message || 'Грешка при копирането' }
  }
}
