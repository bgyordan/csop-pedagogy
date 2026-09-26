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

// Качва .docx и го превръща в Google документ в папката
export async function uploadDocxAsGoogleDoc(title: string, folderId: string, base64: string) {
  const token = await accessToken()
  const boundary = 'eis' + Date.now()
  const meta = JSON.stringify({ name: title, mimeType: GDOC, parents: [folderId] })
  const body = Buffer.concat([
    Buffer.from(`--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${meta}\r\n`),
    Buffer.from(`--${boundary}\r\nContent-Type: application/vnd.openxmlformats-officedocument.wordprocessingml.document\r\n\r\n`),
    Buffer.from(base64, 'base64'),
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
