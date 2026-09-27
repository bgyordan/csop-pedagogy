// Прехвърляне на старите „Мои файлове“ (Supabase, bucket staff-files) в „Моите документи“ (Drive, Служители / Име)
//
// На сървъра, от папката на EIS:
//   node scripts/migrate-staff-files.mjs          ← ПРОБА: нищо не качва, само отчет
//   node scripts/migrate-staff-files.mjs --go     ← истинското прехвърляне
//
// Старите файлове НЕ се трият. Повторно пускане е безопасно: вече прехвърленият файл се прескача.
// Споделените си остават споделени.

import fs from 'node:fs'
import path from 'node:path'
import { createClient } from '@supabase/supabase-js'

const GO = process.argv.includes('--go')

for (const line of fs.readFileSync('.env.local', 'utf8').split('\n')) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '')
}
const env = k => { if (!process.env[k]) { console.error('Липсва ' + k + ' в .env.local'); process.exit(1) } return process.env[k] }
const DRIVE_ID = env('GOOGLE_EPLR_DRIVE_ID')
const sb = createClient(env('NEXT_PUBLIC_SUPABASE_URL'), env('SUPABASE_SERVICE_ROLE_KEY'), { auth: { persistSession: false } })

// ── Google Drive ────────────────────────────────────────────────────────
const API = 'https://www.googleapis.com/drive/v3'
const FOLDER = 'application/vnd.google-apps.folder'
let tok = null
async function token() {
  if (tok && tok.exp > Date.now() + 60_000) return tok.t
  const r = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: env('GOOGLE_CLIENT_ID'), client_secret: env('GOOGLE_CLIENT_SECRET'),
      refresh_token: env('GOOGLE_REFRESH_TOKEN'), grant_type: 'refresh_token',
    }),
  })
  const j = await r.json()
  if (!j.access_token) throw new Error('Google вход: ' + (j.error_description || j.error))
  tok = { t: j.access_token, exp: Date.now() + j.expires_in * 1000 }
  return tok.t
}
async function drive(p, init = {}) {
  const r = await fetch(API + p, { ...init, headers: { Authorization: `Bearer ${await token()}`, 'Content-Type': 'application/json', ...(init.headers || {}) } })
  const j = await r.json().catch(() => ({}))
  if (!r.ok) throw new Error(j?.error?.message || `Drive ${r.status}`)
  return j
}
const esc = v => v.replace(/\\/g, '\\\\').replace(/'/g, "\\'")
async function findFolder(props) {
  const cond = Object.entries(props).map(([k, v]) => `appProperties has { key='${k}' and value='${esc(v)}' }`).join(' and ')
  const q = `mimeType='${FOLDER}' and trashed=false and ${cond}`
  const r = await drive(`/files?q=${encodeURIComponent(q)}&corpora=drive&driveId=${DRIVE_ID}&includeItemsFromAllDrives=true&supportsAllDrives=true&fields=files(id)`)
  return r.files?.[0]?.id ?? null
}
async function createFolder(name, parent, props) {
  return (await drive(`/files?supportsAllDrives=true&fields=id`, { method: 'POST', body: JSON.stringify({ name, mimeType: FOLDER, parents: [parent], appProperties: props }) })).id
}
async function ensureStaffFolder(staffId, name) {
  const root = (await findFolder({ kind: 'staff-root' })) ?? await createFolder('Служители', DRIVE_ID, { kind: 'staff-root' })
  return (await findFolder({ kind: 'staff', staffId })) ?? await createFolder(name, root, { kind: 'staff', staffId })
}
async function legacyIn(folderId) {
  const q = `'${folderId}' in parents and trashed=false`
  const r = await drive(`/files?q=${encodeURIComponent(q)}&corpora=drive&driveId=${DRIVE_ID}&includeItemsFromAllDrives=true&supportsAllDrives=true&pageSize=1000&fields=files(appProperties)`)
  return new Set((r.files || []).map(f => f.appProperties?.legacyId).filter(Boolean))
}
async function share(folderId, email) {
  await drive(`/files/${folderId}/permissions?supportsAllDrives=true&sendNotificationEmail=false`, { method: 'POST', body: JSON.stringify({ type: 'user', role: 'writer', emailAddress: email }) })
}
function accounts(email) {
  const e = (email || '').trim().toLowerCase()
  const user = e.split('@')[0]
  if (!user || !/@(edu\.mon\.bg|csop-varna\.bg)$/.test(e)) return []
  return [`${user}@csop-varna.bg`, `${user}@edu.mon.bg`]
}

// Word/Excel/PowerPoint → Google документ (като при качването от EIS)
const GDOC = 'application/vnd.google-apps.document', GSHEET = 'application/vnd.google-apps.spreadsheet', GSLIDE = 'application/vnd.google-apps.presentation'
const CONVERT = {
  docx: GDOC, doc: GDOC, odt: GDOC, rtf: GDOC,
  xlsx: GSHEET, xls: GSHEET, pptx: GSLIDE, ppt: GSLIDE,
}
async function upload(name, mime, data, folderId, props) {
  const ext = path.extname(name).slice(1).toLowerCase()
  const target = CONVERT[ext]
  const b = 'eis' + Date.now()
  const meta = JSON.stringify({
    name: target ? path.basename(name, path.extname(name)) : name,
    parents: [folderId], ...(target ? { mimeType: target } : {}), appProperties: props,
  })
  const body = Buffer.concat([
    Buffer.from(`--${b}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${meta}\r\n--${b}\r\nContent-Type: ${mime || 'application/octet-stream'}\r\n\r\n`),
    data,
    Buffer.from(`\r\n--${b}--`),
  ])
  const r = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&supportsAllDrives=true&fields=id',
    { method: 'POST', headers: { Authorization: `Bearer ${await token()}`, 'Content-Type': `multipart/related; boundary=${b}` }, body })
  if (!r.ok) throw new Error((await r.json().catch(() => ({})))?.error?.message || `upload ${r.status}`)
}

// ── Данни ───────────────────────────────────────────────────────────────
const { data: files, error } = await sb.from('staff_files').select('id, staff_id, name, path, mime_type, size, is_shared').order('created_at')
if (error) { console.error(error.message); process.exit(1) }
const { data: staff } = await sb.from('staff_profiles').select('id, first_name, last_name, email')
const person = new Map((staff || []).map(s => [s.id, s]))

const byStaff = new Map()
for (const f of files || []) {
  if (!byStaff.has(f.staff_id)) byStaff.set(f.staff_id, [])
  byStaff.get(f.staff_id).push(f)
}

console.log(`Файлове в „Мои файлове“: ${(files || []).length} от ${byStaff.size} служители (споделени: ${(files || []).filter(f => f.is_shared).length})`)
for (const [sid, list] of byStaff) {
  const p = person.get(sid)
  console.log(`  ${p ? `${p.first_name} ${p.last_name}` : '(няма такъв служител)'}: ${list.length} файла, споделени ${list.filter(f => f.is_shared).length}`)
}
if (!GO) {
  console.log('\nТова беше ПРОБА — нищо не е прехвърлено. За истинското прехвърляне добави --go')
  process.exit(0)
}

let done = 0, same = 0, failed = 0
for (const [sid, list] of byStaff) {
  const p = person.get(sid)
  if (!p) { failed += list.length; console.log(`✗ няма служител ${sid} (${list.length} файла)`); continue }
  const name = `${p.first_name} ${p.last_name}`
  try {
    const folderId = await ensureStaffFolder(sid, name)
    for (const a of accounts(p.email)) { try { await share(folderId, a) } catch { /* няма такъв акаунт */ } }
    const already = await legacyIn(folderId)
    for (const f of list) {
      if (already.has(f.id)) { same++; continue }
      try {
        const { data, error: e } = await sb.storage.from('staff-files').download(f.path)
        if (e || !data) throw new Error(e?.message || 'не се свали от системата')
        const buf = Buffer.from(await data.arrayBuffer())
        await upload(f.name, f.mime_type, buf, folderId, {
          uploadedBy: name, legacyId: f.id, ...(f.is_shared ? { shared: 'true' } : {}),
        })
        done++
      } catch (e) { failed++; console.log(`  ✗ ${name}: ${f.name} — ${e.message}`) }
    }
    console.log(`✓ ${name}: ${list.length} файла`)
  } catch (e) {
    failed += list.length
    console.log(`✗ ${name}: ${e.message}`)
  }
}
console.log(`\nГОТОВО. Прехвърлени: ${done}, вече ги имаше: ${same}, грешки: ${failed}`)
console.log('Старите файлове в системата НЕ са изтрити.')
