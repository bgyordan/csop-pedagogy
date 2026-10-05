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
  if (!j.access_token) {
    console.error('[drive] token', res.status, JSON.stringify(j).slice(0, 300))
    throw new Error('Google вход неуспешен: ' + (j.error_description || j.error))
  }
  cached = { token: j.access_token, exp: Date.now() + j.expires_in * 1000 }
  return cached.token
}

// Google понякога връща временна грешка („Internal Error“ 500, 502/503, 429 — твърде много заявки).
// Тогава опитваме пак до 3 пъти с кратка пауза; постоянните грешки (404, 403…) се връщат веднага.
const RETRY = new Set([429, 500, 502, 503, 504])
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))

async function drive(path: string, init: RequestInit = {}) {
  for (let attempt = 0; ; attempt++) {
    const token = await accessToken()
    const res = await fetch(API + path, {
      ...init,
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', ...(init.headers || {}) },
      cache: 'no-store',
    })
    const j = await res.json().catch(() => ({}))
    if (res.ok) return j
    // изтекъл токен — нов и пак
    if (res.status === 401 && attempt === 0) { cached = null; continue }
    // четене — винаги; запис (POST/PATCH) — само при 429/503, когато Google със сигурност не е изпълнил заявката (без дубликати)
    const safe = !init.method || init.method === 'GET' || res.status === 429 || res.status === 503
    if (RETRY.has(res.status) && safe && attempt < 3) { await sleep(400 * 2 ** attempt + Math.random() * 300); continue }
    // в лога на сървъра (pm2 logs csop) — коя заявка и какво точно казва Google
    console.error('[drive]', res.status, init.method || 'GET', decodeURIComponent(path).slice(0, 300), JSON.stringify(j?.error || {}).slice(0, 500))
    throw new Error(j?.error?.message || `Drive грешка ${res.status}`)
  }
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

// Папката на годината (2026-2027) — правото на нея се наследява от всички деца отдолу
export async function ensureYearFolder(yearName: string) {
  const year = yearName || 'Без година'
  const yProps = { kind: 'year', year }
  return (await findFolder(yProps))?.id ?? (await createFolder(year.replace(/\//g, '-'), driveId(), yProps))
}

// Всички папки от дадена година (паралелки + деца) — за махане на права при неактивен служител
export async function listYearFolders(yearName: string): Promise<string[]> {
  const year = yearName || 'Без година'
  const q = `mimeType='${FOLDER}' and trashed=false and appProperties has { key='year' and value='${esc(year)}' }`
  const ids: string[] = []
  let page = ''
  do {
    const r = await drive(
      `/files?q=${encodeURIComponent(q)}&corpora=drive&driveId=${driveId()}&includeItemsFromAllDrives=true&supportsAllDrives=true&pageSize=1000&fields=nextPageToken,files(id)${page ? `&pageToken=${page}` : ''}`
    )
    for (const f of (r.files || []) as any[]) ids.push(f.id)
    page = r.nextPageToken || ''
  } while (page)
  return ids
}

// Папката на детето за годината, БЕЗ да я създава (null ако още няма)
export async function findStudentFolder(studentId: string, yearName: string) {
  const f = await findFolder({ studentId, year: yearName || 'Без година' })
  return f?.id ?? null
}

// Папката на паралелката (2026-2027 / 01) — там стоят и общите файлове на паралелката
export async function ensureClassFolder(yearName: string, className: string) {
  const year = yearName || 'Без година'
  const cls = className || 'Без паралелка'
  const yProps = { kind: 'year', year }
  const yearId = (await findFolder(yProps))?.id ?? (await createFolder(year.replace(/\//g, '-'), driveId(), yProps))
  const cProps = { kind: 'class', year, cls }
  return (await findFolder(cProps))?.id ?? (await createFolder(cls, yearId, cProps))
}

export async function findClassFolder(yearName: string, className: string) {
  const f = await findFolder({ kind: 'class', year: yearName || 'Без година', cls: className || 'Без паралелка' })
  return f?.id ?? null
}

export function folderUrl(folderId: string) {
  return `https://drive.google.com/drive/folders/${folderId}`
}

// Брой файлове в папките на децата за годината → { studentId: брой } (без значение в коя паралелка е папката)
export async function countStudentFiles(studentIds: string[], yearName: string): Promise<Record<string, number>> {
  const out: Record<string, number> = {}
  for (const sid of studentIds) out[sid] = 0
  if (!studentIds.length) return out
  const year = yearName || 'Без година'
  const list = async (q: string, fields: string, each: (f: any) => void) => {
    let page = ''
    do {
      const r = await drive(
        `/files?q=${encodeURIComponent(q)}&corpora=drive&driveId=${driveId()}&includeItemsFromAllDrives=true&supportsAllDrives=true` +
        `&pageSize=1000&fields=${encodeURIComponent(`nextPageToken,files(${fields})`)}${page ? `&pageToken=${page}` : ''}`
      )
      for (const f of r.files ?? []) each(f)
      page = r.nextPageToken || ''
    } while (page)
  }
  // 1) папките на децата за годината
  const folderOf: Record<string, string> = {}
  await list(`mimeType='${FOLDER}' and trashed=false and appProperties has { key='year' and value='${esc(year)}' }`, 'id,appProperties', f => {
    const sid = f.appProperties?.studentId
    if (sid && sid in out) folderOf[f.id] = sid
  })
  // 2) файловете в тях — на порции, заради дължината на заявката
  const ids = Object.keys(folderOf)
  for (let i = 0; i < ids.length; i += 40) {
    const chunk = ids.slice(i, i + 40)
    await list(`(${chunk.map(id => `'${id}' in parents`).join(' or ')}) and trashed=false and mimeType!='${FOLDER}'`, 'parents', f => {
      for (const p of f.parents ?? []) if (folderOf[p]) out[folderOf[p]]++
    })
  }
  return out
}

// ── Лични документи на служителите: Служители / Иван Иванов (без година) ──

export async function ensureStaffFolder(staffId: string, staffName: string) {
  const rProps = { kind: 'staff-root' }
  const rootId = (await findFolder(rProps))?.id ?? (await createFolder('Служители', driveId(), rProps))
  const f = await findFolder({ kind: 'staff', staffId })
  if (f) return f.id
  return createFolder(staffName || 'Служител', rootId, { kind: 'staff', staffId })
}

export async function findStaffFolder(staffId: string) {
  return (await findFolder({ kind: 'staff', staffId }))?.id ?? null
}

// Отбелязва файла като споделен / несподелен с колегите
export async function setFileShared(fileId: string, shared: boolean) {
  await drive(`/files/${fileId}?supportsAllDrives=true`, {
    method: 'PATCH',
    body: JSON.stringify({ appProperties: { shared: shared ? 'true' : null } }),
  })
}

// ── Потребителски подпапки (едно ниво) в „Моите документи“ и в папката на паралелката ──

export async function createSubfolder(name: string, parentId: string) {
  return createFolder(name, parentId, { sub: '1' })
}

// Мести файл в друга папка (махаме старите родители)
export async function moveFile(fileId: string, toFolderId: string) {
  const meta = await getFileMeta(fileId)
  const from = (meta.parents ?? []).join(',')
  await drive(
    `/files/${fileId}?supportsAllDrives=true&addParents=${toFolderId}${from ? `&removeParents=${from}` : ''}`,
    { method: 'PATCH', body: JSON.stringify({}) }
  )
}

export type SharedItem = DriveItem & { staffId: string; owner: string }

// Всички споделени лични файлове (от папките на служителите), най-новите първо
export async function listSharedStaffFiles(): Promise<SharedItem[]> {
  // папките на служителите → staffId + име
  const fq = `mimeType='${FOLDER}' and trashed=false and appProperties has { key='kind' and value='staff' }`
  const fr = await drive(
    `/files?q=${encodeURIComponent(fq)}&corpora=drive&driveId=${driveId()}&includeItemsFromAllDrives=true&supportsAllDrives=true` +
    `&pageSize=1000&fields=${encodeURIComponent('files(id,name,appProperties)')}`
  )
  const folders: Record<string, { staffId: string; owner: string }> = {}
  for (const f of fr.files ?? []) folders[f.id] = { staffId: f.appProperties?.staffId || '', owner: f.name }
  // подпапките в личните папки (едно ниво) → същият собственик
  const roots = Object.keys(folders)
  for (let i = 0; i < roots.length; i += 40) {
    const chunk = roots.slice(i, i + 40)
    const sq = `mimeType='${FOLDER}' and trashed=false and (${chunk.map(id => `'${id}' in parents`).join(' or ')})`
    const sr = await drive(
      `/files?q=${encodeURIComponent(sq)}&corpora=drive&driveId=${driveId()}&includeItemsFromAllDrives=true&supportsAllDrives=true` +
      `&pageSize=1000&fields=${encodeURIComponent('files(id,parents)')}`
    )
    for (const f of sr.files ?? []) {
      const parent = (f.parents ?? []).find((p: string) => folders[p])
      if (parent) folders[f.id] = folders[parent]
    }
  }
  const q = `trashed=false and appProperties has { key='shared' and value='true' }`
  const r = await drive(
    `/files?q=${encodeURIComponent(q)}&corpora=drive&driveId=${driveId()}&includeItemsFromAllDrives=true&supportsAllDrives=true` +
    `&orderBy=${encodeURIComponent('modifiedTime desc')}&pageSize=500` +
    `&fields=${encodeURIComponent('files(id,name,mimeType,modifiedTime,webViewLink,parents,appProperties,lastModifyingUser(displayName,emailAddress))')}`
  )
  const names = await staffNames()
  return (r.files ?? [])
    .map((f: any) => {
      const own = folders[(f.parents ?? []).find((p: string) => folders[p]) || '']
      if (!own) return null
      return {
        id: f.id, name: f.name, mimeType: f.mimeType, modifiedTime: f.modifiedTime,
        modifiedBy: whoModified(f, names), url: f.webViewLink, shared: true, staffId: own.staffId, owner: own.owner,
      }
    })
    .filter(Boolean) as SharedItem[]
}

export type DriveItem = {
  id: string
  name: string
  mimeType: string
  modifiedTime: string
  modifiedBy: string
  url: string
  shared?: boolean   // споделен с всички колеги (Моите документи)
  system?: boolean   // системна папка на EIS (папка на дете и т.н.), не е потребителска
}

// Имената на колегите по имейл — Google показва колегите с edu.mon.bg само като „penka.bo…“,
// затова свързваме имейла на последния редактирал със служителя в ЕИС (кеш 10 мин.)
let namesCache: { at: number; byEmail: Record<string, string>; byLocal: Record<string, string> } | null = null
async function staffNames() {
  if (namesCache && Date.now() - namesCache.at < 10 * 60_000) return namesCache
  const byEmail: Record<string, string> = {}, byLocal: Record<string, string> = {}
  try {
    const { createAdminClient } = await import('@/lib/supabase/admin')
    const { data } = await createAdminClient().from('staff_profiles').select('email, first_name, last_name')
    for (const p of data || []) {
      const e = String(p.email || '').toLowerCase().trim(); if (!e) continue
      const name = `${p.first_name || ''} ${p.last_name || ''}`.trim()
      byEmail[e] = name
      // ivan.ivanov@edu.mon.bg ↔ ivan.ivanov@csop-varna.bg — едно и също име преди @
      const local = e.split('@')[0]
      if (byLocal[local] === undefined) byLocal[local] = name
      else if (byLocal[local] !== name) byLocal[local] = ''   // двама с еднакво начало → не гадаем
    }
  } catch { /* без база — показваме каквото дава Google */ }
  namesCache = { at: Date.now(), byEmail, byLocal }
  return namesCache
}

// EIS качва файловете от името на eis@ → показваме истинския колега, записан при качването;
// иначе — името на колегата от ЕИС по имейла му; накрая — каквото дава Google
function whoModified(f: any, names?: { byEmail: Record<string, string>; byLocal: Record<string, string> }) {
  const u = f.lastModifyingUser
  const email = String(u?.emailAddress || '').toLowerCase()
  if (email && /^eis@/.test(email)) return f.appProperties?.uploadedBy || 'EIS'
  if (email && names) {
    const n = names.byEmail[email] || names.byLocal[email.split('@')[0]]
    if (n) return n
  }
  return u?.displayName || (email ? email.split('@')[0] : '')
}

// Съдържанието на папка (без изтритите), подредено: първо папки, после по име
export async function listFolder(folderId: string): Promise<DriveItem[]> {
  const q = `'${folderId}' in parents and trashed=false`
  const r = await drive(
    `/files?q=${encodeURIComponent(q)}&corpora=drive&driveId=${driveId()}&includeItemsFromAllDrives=true&supportsAllDrives=true` +
    `&orderBy=${encodeURIComponent('folder,name_natural')}&pageSize=200` +
    `&fields=${encodeURIComponent('files(id,name,mimeType,modifiedTime,webViewLink,appProperties,lastModifyingUser(displayName,emailAddress))')}`
  )
  const names = await staffNames()
  return (r.files ?? []).map((f: any) => ({
    id: f.id,
    name: f.name,
    mimeType: f.mimeType,
    modifiedTime: f.modifiedTime,
    modifiedBy: whoModified(f, names),
    url: f.webViewLink,
    shared: f.appProperties?.shared === 'true',
    system: !!(f.appProperties?.studentId || f.appProperties?.kind),
  }))
}

// ── Бланки: папка „Бланки“ в корена на диска ───────────────────────────

export async function findTemplatesFolder() {
  const q = `mimeType='${FOLDER}' and trashed=false and name='Бланки' and '${driveId()}' in parents`
  const r = await drive(
    `/files?q=${encodeURIComponent(q)}&corpora=drive&driveId=${driveId()}&includeItemsFromAllDrives=true&supportsAllDrives=true&fields=files(id)`
  )
  return (r.files?.[0]?.id as string | undefined) ?? null
}

// Копие на файл в друга папка; Word бланка се превръща в Google документ
export async function copyFile(fileId: string, name: string, folderId: string, sourceMime: string) {
  const toGdoc = sourceMime.includes('word') || sourceMime === 'application/vnd.oasis.opendocument.text'
  const f = await drive(`/files/${fileId}/copy?supportsAllDrives=true&fields=id,webViewLink,mimeType`, {
    method: 'POST',
    body: JSON.stringify({ name, parents: [folderId], ...(toGdoc ? { mimeType: GDOC } : {}) }),
  })
  return { id: f.id as string, url: f.webViewLink as string, mimeType: f.mimeType as string }
}

// Замяна на маркерите {{ИМЕ}} и т.н. в Google документ (Google Docs API)
export async function replaceMarkers(docId: string, values: Record<string, string>) {
  const requests = Object.entries(values).map(([k, v]) => ({
    replaceAllText: { containsText: { text: `{{${k}}}`, matchCase: true }, replaceText: v || '' },
  }))
  if (!requests.length) return
  const res = await fetch(`https://docs.googleapis.com/v1/documents/${docId}:batchUpdate`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${await accessToken()}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ requests }),
    cache: 'no-store',
  })
  if (!res.ok) {
    const j = await res.json().catch(() => ({}))
    throw new Error('Маркерите не се попълниха: ' + (j?.error?.message || res.status))
  }
}

// ── Един файл: данни, сваляне, преименуване, изтриване ─────────────────

export async function getFileMeta(fileId: string) {
  return drive(`/files/${fileId}?supportsAllDrives=true&fields=id,name,mimeType,parents,appProperties`) as Promise<
    { id: string; name: string; mimeType: string; parents?: string[]; appProperties?: Record<string, string> }
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

// С кой акаунт да се отварят файловете в Drive: училищният edu.mon.bg (правата са дадени на него),
// дори ако колегата е влязъл в EIS с друг имейл. Ако няма училищен — имейлът за вход.
// Изключение: записан в ЕИС с @csop-varna.bg (няма Google в edu.mon.bg, напр. Ванина) → отваря с него.
export function openAsEmail(profileEmail?: string | null, loginEmail?: string | null) {
  const p = (profileEmail || '').trim().toLowerCase()
  if (p.endsWith('@csop-varna.bg')) return p
  const acc = accountEmails(profileEmail).length ? accountEmails(profileEmail) : accountEmails(loginEmail)
  return acc[1] || loginEmail || ''
}

// ivan.ivanov@... -> [ivan.ivanov@csop-varna.bg, ivan.ivanov@edu.mon.bg]
// Колегата отваря документа с който от двата акаунта е влязъл в браузъра
export function accountEmails(email?: string | null) {
  const school = schoolEmail(email)
  if (!school) return []
  return [school, school.replace('@csop-varna.bg', '@edu.mon.bg')]
}

// Маха прякото право на тези имейли върху файл/папка (наследените от горната папка не се пипат).
// Ползва се при преместване на дете: старият класен губи достъп до папката му.
export async function unshareEmails(fileId: string, emails: string[]) {
  const want = new Set(emails.map(e => e.toLowerCase()))
  if (want.size === 0) return 0
  const r = await drive(`/files/${fileId}/permissions?supportsAllDrives=true&fields=permissions(id,emailAddress,permissionDetails)`)
  let removed = 0
  for (const p of (r.permissions || []) as any[]) {
    if (!p.emailAddress || !want.has(String(p.emailAddress).toLowerCase())) continue
    const inherited = (p.permissionDetails || []).length > 0 && (p.permissionDetails || []).every((d: any) => d.inherited)
    if (inherited) continue
    try { await drive(`/files/${fileId}/permissions/${p.id}?supportsAllDrives=true`, { method: 'DELETE' }); removed++ } catch { /* нищо */ }
  }
  return removed
}
