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

// Папка на детето в споделения диск (намира я по studentId или я създава)
export async function ensureStudentFolder(studentId: string, name: string) {
  const q = `mimeType='${FOLDER}' and trashed=false and appProperties has { key='studentId' and value='${studentId}' }`
  const found = await drive(
    `/files?q=${encodeURIComponent(q)}&corpora=drive&driveId=${driveId()}&includeItemsFromAllDrives=true&supportsAllDrives=true&fields=files(id,name)`
  )
  if (found.files?.length) return found.files[0].id as string
  const created = await drive(`/files?supportsAllDrives=true&fields=id`, {
    method: 'POST',
    body: JSON.stringify({ name, mimeType: FOLDER, parents: [driveId()], appProperties: { studentId } }),
  })
  return created.id as string
}

// Празен Google документ в папката
export async function createGoogleDoc(title: string, folderId: string) {
  const f = await drive(`/files?supportsAllDrives=true&fields=id,webViewLink`, {
    method: 'POST',
    body: JSON.stringify({ name: title, mimeType: GDOC, parents: [folderId] }),
  })
  return { id: f.id as string, url: f.webViewLink as string }
}

// Дава право за редакция, без имейл известие
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
