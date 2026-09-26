// Сървърен модул: EIS работи с Google Drive като eis@csop-varna.bg
// Ключовете са в .env.local на сървъра (GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REFRESH_TOKEN, GOOGLE_EPLR_DRIVE_ID)

const API = 'https://www.googleapis.com/drive/v3'
const FOLDER = 'application/vnd.google-apps.folder'
const GDOC = 'application/vnd.google-apps.document'

let cached: { token: string; exp: number } | null = null

async function accessToken() {
  if (cached && cached.exp > Date.now() + 60_000) return cached.token
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      refresh_token: process.env.GOOGLE_REFRESH_TOKEN!,
      grant_type: 'refresh_token',
    }),
    cache: 'no-store',
  })
  const j = await res.json()
  if (!j.access_token) throw new Error('Google вход неуспешен: ' + (j.error_description || j.error))
  cached = { token: j.access_token, exp: Date.now() + j.expires_in * 1000 }
  return cached.token
}

async function drive(path: string, init: RequestInit = {}) {
  const token = await accessToken()
  const res = await fetch(API + path, {
    ...init,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', ...(init.headers || {}) },
    cache: 'no-store',
  })
  const j = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(j?.error?.message || `Drive грешка ${res.status}`)
  return j
}

export function driveId() {
  const id = process.env.GOOGLE_EPLR_DRIVE_ID
  if (!id) throw new Error('Липсва GOOGLE_EPLR_DRIVE_ID в .env.local')
  return id
}

function esc(v: string) {
  return v.replace(/\\/g, '\\\\').replace(/'/g, "\\'")
}

async function findFolder(props: Record<string, string>) {
  const cond = Object.entries(props)
    .map(([k, v]) => `appProperties has { key='${k}' and value='${esc(v)}' }`)
    .join(' and ')
  const q = `mimeType='${FOLDER}' and trashed=false and ${cond}`
  const r = await drive(
    `/files?q=${encodeURIComponent(q)}&corpora=drive&driveId=${driveId()}&includeItemsFromAllDrives=true&supportsAllDrives=true&fields=files(id,name,parents)`
  )
  return (r.files?.[0] as { id: string; name: string; parents?: string[] } | undefined) ?? null
}

async function createFolder(name: string, parent: string, props: Record<string, string>) {
  const f = await drive(`/files?supportsAllDrives=true&fields=id`, {
    method: 'POST',
    body: JSON.stringify({ name, mimeType: FOLDER, parents: [parent], appProperties: props }),
  })
  return f.id as string
}

// Структура: 2026-2027 / 01 / Иван Иванов
export async function ensureStudentFolder(studentId: string, studentName: string, yearName: string, className: string) {
  const year = yearName || 'Без година'
  const cls = className || 'Без паралелка'

  const yProps = { kind: 'year', year }
  const yearId = (await findFolder(yProps))?.id ?? (await createFolder(year.replace(/\//g, '-'), driveId(), yProps))

  const cProps = { kind: 'class', year, cls }
  const classId = (await findFolder(cProps))?.id ?? (await createFolder(cls, yearId, cProps))

  const sProps = { studentId, year }
  const existing = await findFolder(sProps)
  if (!existing) return createFolder(studentName, classId, sProps)

  // детето е сменило паралелката през годината → местим папката
  if (existing.parents && !existing.parents.includes(classId)) {
    await drive(
      `/files/${existing.id}?supportsAllDrives=true&addParents=${classId}&removeParents=${existing.parents.join(',')}`,
      { method: 'PATCH', body: JSON.stringify({}) }
    )
  }
  return existing.id
}

// Празен Google документ в папката
export async function createGoogleDoc(title: string, folderId: string) {
  const f = await drive(`/files?supportsAllDrives=true&fields=id,webViewLink`, {
    method: 'POST',
    body: JSON.stringify({ name: title, mimeType: GDOC, parents: [folderId] }),
  })
  return { id: f.id as string, url: f.webViewLink as string }
}

// Office файлове → превръщат се в Google формат (за да се редактират заедно); другите се качват както са
const CONVERT: Record<string, string> = {
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': GDOC,
  'application/msword': GDOC,
  'application/vnd.oasis.opendocument.text': GDOC,
  'application/rtf': GDOC,
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'application/vnd.google-apps.spreadsheet',
  'application/vnd.ms-excel': 'application/vnd.google-apps.spreadsheet',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'application/vnd.google-apps.presentation',
  'application/vnd.ms-powerpoint': 'application/vnd.google-apps.presentation',
}

// Качва файл в папката; Word/Excel/PowerPoint стават Google документи с ОРИГИНАЛНОТО име (без разширението)
export async function uploadFile(name: string, folderId: string, data: Buffer, mime: string, props?: Record<string, string>) {
  const token = await accessToken()
  const target = CONVERT[mime]
  const cleanName = target ? name.replace(/\.(docx?|odt|rtf|xlsx?|pptx?)$/i, '') : name
  const boundary = 'eis' + Date.now()
  const meta = JSON.stringify({ name: cleanName, parents: [folderId], ...(target ? { mimeType: target } : {}), ...(props ? { appProperties: props } : {}) })
  const body = Buffer.concat([
    Buffer.from(`--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${meta}\r\n`),
    Buffer.from(`--${boundary}\r\nContent-Type: ${mime || 'application/octet-stream'}\r\n\r\n`),
    data,
    Buffer.from(`\r\n--${boundary}--`),
  ])
  const res = await fetch(
    'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&supportsAllDrives=true&fields=id,webViewLink',
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': `multipart/related; boundary=${boundary}` },
      body,
      cache: 'no-store',
    }
  )
  const j = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(j?.error?.message || `Drive грешка ${res.status}`)
  return { id: j.id as string, url: j.webViewLink as string }
}

// Качва .docx (base64 от генератора) и го превръща в Google документ
export async function uploadDocxAsGoogleDoc(title: string, folderId: string, base64: string) {
  return uploadFile(title, folderId, Buffer.from(base64, 'base64'),
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document')
}

// Папката на детето за годината, БЕЗ да я създава (null ако още няма)
export async function findStudentFolder(studentId: string, yearName: string) {
  const f = await findFolder({ studentId, year: yearName || 'Без година' })
  return f?.id ?? null
}

export type DriveItem = {
  id: string
  name: string
  mimeType: string
  modifiedTime: string
  modifiedBy: string
  url: string
}

// EIS качва файловете от името на eis@ → показваме истинския колега, записан при качването
function whoModified(f: any) {
  const u = f.lastModifyingUser
  if (u?.emailAddress && /^eis@/i.test(u.emailAddress)) return f.appProperties?.uploadedBy || 'EIS'
  return u?.displayName || ''
}

// Съдържанието на папка (без изтритите), подредено: първо папки, после по име
export async function listFolder(folderId: string): Promise<DriveItem[]> {
  const q = `'${folderId}' in parents and trashed=false`
  const r = await drive(
    `/files?q=${encodeURIComponent(q)}&corpora=drive&driveId=${driveId()}&includeItemsFromAllDrives=true&supportsAllDrives=true` +
    `&orderBy=${encodeURIComponent('folder,name_natural')}&pageSize=200` +
    `&fields=${encodeURIComponent('files(id,name,mimeType,modifiedTime,webViewLink,appProperties,lastModifyingUser(displayName,emailAddress))')}`
  )
  return (r.files ?? []).map((f: any) => ({
    id: f.id,
    name: f.name,
    mimeType: f.mimeType,
    modifiedTime: f.modifiedTime,
    modifiedBy: whoModified(f),
    url: f.webViewLink,
  }))
}

// ── Един файл: данни, сваляне, преименуване, изтриване ─────────────────

export async function getFileMeta(fileId: string) {
  return drive(`/files/${fileId}?supportsAllDrives=true&fields=id,name,mimeType,parents`) as Promise<
    { id: string; name: string; mimeType: string; parents?: string[] }
  >
}

// Google формат → Office формат при сваляне
const EXPORT_OFFICE: Record<string, { mime: string; ext: string }> = {
  [GDOC]: { mime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', ext: 'docx' },
  'application/vnd.google-apps.spreadsheet': { mime: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', ext: 'xlsx' },
  'application/vnd.google-apps.presentation': { mime: 'application/vnd.openxmlformats-officedocument.presentationml.presentation', ext: 'pptx' },
}

// as='office' → Word/Excel/PowerPoint (или оригиналът); as='pdf' → PDF
export async function downloadFile(fileId: string, as: 'office' | 'pdf') {
  const meta = await getFileMeta(fileId)
  const token = await accessToken()
  const isGoogle = meta.mimeType.startsWith('application/vnd.google-apps.')
  let url: string
  let contentType: string
  let filename = meta.name
  if (isGoogle) {
    const target = as === 'pdf' ? { mime: 'application/pdf', ext: 'pdf' } : EXPORT_OFFICE[meta.mimeType]
    if (!target) throw new Error('Този тип файл не може да се свали')
    url = `${API}/files/${fileId}/export?mimeType=${encodeURIComponent(target.mime)}`
    contentType = target.mime
    filename = `${meta.name}.${target.ext}`
  } else {
    url = `${API}/files/${fileId}?alt=media&supportsAllDrives=true`
    contentType = meta.mimeType || 'application/octet-stream'
  }
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` }, cache: 'no-store' })
  if (!res.ok) throw new Error(`Drive грешка ${res.status}`)
  return { data: Buffer.from(await res.arrayBuffer()), contentType, filename }
}

export async function renameFile(fileId: string, name: string) {
  await drive(`/files/${fileId}?supportsAllDrives=true`, { method: 'PATCH', body: JSON.stringify({ name }) })
}

// В кошчето на споделения диск (възстановява се от Drive до 30 дни)
export async function trashFile(fileId: string) {
  await drive(`/files/${fileId}?supportsAllDrives=true`, { method: 'PATCH', body: JSON.stringify({ trashed: true }) })
}

// Дава право за редакция, без имейл известие (на файл или папка)
export async function shareWriter(fileId: string, email: string) {
  await drive(`/files/${fileId}/permissions?supportsAllDrives=true&sendNotificationEmail=false`, {
    method: 'POST',
    body: JSON.stringify({ type: 'user', role: 'writer', emailAddress: email }),
  })
}

// ivan.ivanov@edu.mon.bg -> ivan.ivanov@csop-varna.bg ; други домейни -> null
export function schoolEmail(email?: string | null) {
  if (!email) return null
  const e = email.trim().toLowerCase()
  if (e.endsWith('@csop-varna.bg')) return e
  if (e.endsWith('@edu.mon.bg')) return e.replace('@edu.mon.bg', '@csop-varna.bg')
  return null
}

// ivan.ivanov@... -> [ivan.ivanov@csop-varna.bg, ivan.ivanov@edu.mon.bg]
// Колегата отваря документа с който от двата акаунта е влязъл в браузъра
export function accountEmails(email?: string | null) {
  const school = schoolEmail(email)
  if (!school) return []
  return [school, school.replace('@csop-varna.bg', '@edu.mon.bg')]
}
