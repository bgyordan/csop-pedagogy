// Пренасяне на документите на децата от Teams в Drive (само учебната 2026/2027)
//
// На сървъра, от папката на EIS:
//   unzip -q ~/teams.zip -d ~/teams
//   node scripts/import-teams.mjs ~/teams          ← ПРОБА: нищо не качва, само отчет
//   node scripts/import-teams.mjs ~/teams --go     ← истинското качване
//   + --bez-godina  → вземи и децата, които са направо под класа, без папка за година
//
// Повторно пускане е безопасно: файл със същото име в папката на детето се прескача.

import fs from 'node:fs'
import path from 'node:path'
import { createClient } from '@supabase/supabase-js'

const ROOT = process.argv[2]
const GO = process.argv.includes('--go')
const NOYEAR = process.argv.includes('--bez-godina')   // вземи и децата, които са направо под класа (без папка за година)

// Папка на ТЕКУЩАТА година — всички варианти от Teams:
// „2026-2027“, „2026 - 2027“, „2026-2027г“, „уч. 2026-2027 г“, „Ученици 2026-2027“, „УЧЕБНА 2026-2027г“, „26-27“,
// „2026-2027 Георгий Тоншин“ … но НЕ „2025-2026“, „25-26“, „2026 Протокол 2“, „архив 2025- 2026г“
function isCurrentYear(seg) {
  const s = seg.toLowerCase()
  if (/архив/.test(s)) return false
  return /2026\D{0,6}(20)?27(?!\d)/.test(s) || /(^|\D)26\s*[-–—\/]\s*27(?!\d)/.test(s)
}
// Папка на ДРУГА година (за да не я бъркаме с „без година“)
const anyYear = seg => /20\d\d|\b\d\d\s*[-–—\/,]\s*\d\d\b|архив/i.test(seg)
const MAX = 10 * 1024 * 1024        // 10 MB
const REPORT = path.join(process.env.HOME || '.', 'teams-report.txt')

if (!ROOT || !fs.existsSync(ROOT)) {
  console.error('Употреба: node scripts/import-teams.mjs <разархивирана папка> [--go]')
  process.exit(1)
}

// ── .env.local ──────────────────────────────────────────────────────────
for (const line of fs.readFileSync('.env.local', 'utf8').split('\n')) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '')
}
const env = k => { if (!process.env[k]) { console.error('Липсва ' + k + ' в .env.local'); process.exit(1) } return process.env[k] }
const DRIVE_ID = env('GOOGLE_EPLR_DRIVE_ID')
const sb = createClient(env('NEXT_PUBLIC_SUPABASE_URL'), env('SUPABASE_SERVICE_ROLE_KEY'), { auth: { persistSession: false } })

// ── Google Drive (същата логика като src/lib/google-drive.ts) ───────────
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
  const r = await drive(`/files?q=${encodeURIComponent(q)}&corpora=drive&driveId=${DRIVE_ID}&includeItemsFromAllDrives=true&supportsAllDrives=true&fields=files(id,parents)`)
  return r.files?.[0] ?? null
}
async function createFolder(name, parent, props) {
  return (await drive(`/files?supportsAllDrives=true&fields=id`, { method: 'POST', body: JSON.stringify({ name, mimeType: FOLDER, parents: [parent], appProperties: props }) })).id
}
async function ensureStudentFolder(studentId, name, year, cls) {
  const y = year || 'Без година', c = cls || 'Без паралелка'
  const yId = (await findFolder({ kind: 'year', year: y }))?.id ?? await createFolder(y.replace(/\//g, '-'), DRIVE_ID, { kind: 'year', year: y })
  const cId = (await findFolder({ kind: 'class', year: y, cls: c }))?.id ?? await createFolder(c, yId, { kind: 'class', year: y, cls: c })
  return (await findFolder({ studentId, year: y }))?.id ?? await createFolder(name, cId, { studentId, year: y })
}
async function namesIn(folderId) {
  const q = `'${folderId}' in parents and trashed=false`
  const r = await drive(`/files?q=${encodeURIComponent(q)}&corpora=drive&driveId=${DRIVE_ID}&includeItemsFromAllDrives=true&supportsAllDrives=true&pageSize=500&fields=files(name)`)
  return new Set((r.files || []).map(f => f.name))
}
async function share(folderId, email) {
  await drive(`/files/${folderId}/permissions?supportsAllDrives=true&sendNotificationEmail=false`, { method: 'POST', body: JSON.stringify({ type: 'user', role: 'writer', emailAddress: email }) })
}

const GDOC = 'application/vnd.google-apps.document', GSHEET = 'application/vnd.google-apps.spreadsheet', GSLIDE = 'application/vnd.google-apps.presentation'
const TYPES = {
  docx: ['application/vnd.openxmlformats-officedocument.wordprocessingml.document', GDOC],
  doc: ['application/msword', GDOC],
  odt: ['application/vnd.oasis.opendocument.text', GDOC],
  rtf: ['application/rtf', GDOC],
  xlsx: ['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', GSHEET],
  xls: ['application/vnd.ms-excel', GSHEET],
  pptx: ['application/vnd.openxmlformats-officedocument.presentationml.presentation', GSLIDE],
  ppt: ['application/vnd.ms-powerpoint', GSLIDE],
  pdf: ['application/pdf', null],
  jpg: ['image/jpeg', null], jpeg: ['image/jpeg', null], png: ['image/png', null],
}
function driveName(file) {
  const ext = path.extname(file).slice(1).toLowerCase()
  return TYPES[ext]?.[1] ? path.basename(file, path.extname(file)) : path.basename(file)
}
async function upload(file, folderId) {
  const ext = path.extname(file).slice(1).toLowerCase()
  const [mime, target] = TYPES[ext]
  const b = 'eis' + Date.now()
  const meta = JSON.stringify({ name: driveName(file), parents: [folderId], ...(target ? { mimeType: target } : {}), appProperties: { uploadedBy: 'Пренесено от Teams' } })
  const body = Buffer.concat([
    Buffer.from(`--${b}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${meta}\r\n--${b}\r\nContent-Type: ${mime}\r\n\r\n`),
    fs.readFileSync(file),
    Buffer.from(`\r\n--${b}--`),
  ])
  const r = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&supportsAllDrives=true&fields=id',
    { method: 'POST', headers: { Authorization: `Bearer ${await token()}`, 'Content-Type': `multipart/related; boundary=${b}` }, body })
  if (!r.ok) throw new Error((await r.json().catch(() => ({})))?.error?.message || `upload ${r.status}`)
}

// ── Имена: „Иван Петров Иванов“ ~ „иванов иван“ ~ „Иван Иванов - 3 клас“ ─
const norm = s => (s || '').toLowerCase().replace(/ё/g, 'е').replace(/ѝ/g, 'и').replace(/[^a-zа-я\s-]/g, ' ').replace(/[-_]/g, ' ').split(/\s+/).filter(Boolean)

// ── Данни от EIS ────────────────────────────────────────────────────────
const { data: year } = await sb.from('academic_years').select('id, name').eq('is_current', true).single()
const { data: students } = await sb.from('students').select('id, first_name, middle_name, last_name, status')
const { data: enr } = await sb.from('student_enrollments').select('student_id, class:classes(name)').eq('academic_year_id', year.id)
const { data: teams } = await sb.from('eplr_teams').select('student_id, psychologist_id, speech_therapist_id, rehabilitator_id, class_teacher_id').eq('academic_year_id', year.id)
const { data: staff } = await sb.from('staff_profiles').select('id, email')
const classOf = new Map((enr || []).map(e => [e.student_id, e.class?.name || '']))
const emailOf = new Map((staff || []).map(s => [s.id, s.email]))
const teamOf = new Map((teams || []).map(t => [t.student_id,
  [t.psychologist_id, t.speech_therapist_id, t.rehabilitator_id, t.class_teacher_id].map(id => emailOf.get(id)).filter(Boolean)]))

function accounts(email) {
  const e = (email || '').trim().toLowerCase()
  const user = e.split('@')[0]
  if (!user || !/@(edu\.mon\.bg|csop-varna\.bg)$/.test(e)) return []
  return [`${user}@csop-varna.bg`, `${user}@edu.mon.bg`]
}

function match(segment) {
  const t = new Set(norm(segment))
  if (t.size < 2) return { kind: 'none' }
  const hits = (students || []).filter(s => t.has(norm(s.first_name)[0]) && t.has(norm(s.last_name)[0]))
  if (hits.length > 1) {
    const byMiddle = hits.filter(s => s.middle_name && t.has(norm(s.middle_name)[0]))
    if (byMiddle.length === 1) return { kind: 'ok', s: byMiddle[0] }
    const active = hits.filter(s => s.status === 'active')
    if (active.length === 1) return { kind: 'ok', s: active[0] }
    return { kind: 'many', list: hits }
  }
  if (hits.length === 1) return { kind: 'ok', s: hits[0] }
  return { kind: 'none' }
}

// ── Обхождане ───────────────────────────────────────────────────────────
function* walk(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name)
    if (e.isDirectory()) yield* walk(p)
    else yield p
  }
}

const plan = new Map()          // studentId → { s, files: [] }
const unmatched = new Map()     // папка → брой файлове
const ambiguous = new Map()
const inactive = new Map()
const skipped = []
const noYear = new Map()     // деца без папка за година (вземат се само с --bez-godina)

for (const file of walk(ROOT)) {
  const segs = path.relative(ROOT, file).split(path.sep)
  const base = path.basename(file)
  if (base.startsWith('~$') || base.startsWith('.')) continue  // временни файлове на Office
  const dirs = segs.slice(0, -1)                               // папките по пътя (без файла)
  const yi = dirs.findIndex(isCurrentYear)

  let hit = null, candidate = '', label = ''
  if (yi >= 0) {
    // детето: първо СЛЕД годината, после МЕЖДУ класа и годината, накрая в самото име на годината
    const order = [...dirs.slice(yi + 1), ...dirs.slice(2, yi), dirs[yi]]
    for (const seg of order) {
      const m = match(seg)
      if (m.kind !== 'none') { hit = m; candidate = seg; break }
    }
    candidate = candidate || dirs[yi + 1] || '(файлове направо в папката на годината)'
    label = dirs.slice(0, yi + 1).join(' / ') + ' / ' + candidate
  } else {
    // няма папка за 2026/2027: дете направо под класа?
    if (dirs.length < 3 || dirs.slice(1).some(anyYear)) continue   // друга година или не е в клас
    const m = match(dirs[2])
    if (m.kind === 'none') continue
    if (!NOYEAR) { noYear.set(dirs.slice(0, 3).join(' / '), (noYear.get(dirs.slice(0, 3).join(' / ')) || 0) + 1); continue }
    hit = m; candidate = dirs[2]; label = dirs.slice(0, 3).join(' / ')
  }

  if (!hit) { unmatched.set(label, (unmatched.get(label) || 0) + 1); continue }
  if (hit.kind === 'many') { ambiguous.set(label, hit.list.map(s => `${s.first_name} ${s.middle_name || ''} ${s.last_name}`.replace(/\s+/g, ' ')).join(' | ')); continue }
  if (hit.s.status !== 'active') { inactive.set(label, (inactive.get(label) || 0) + 1); continue }

  const ext = path.extname(file).slice(1).toLowerCase()
  const size = fs.statSync(file).size
  if (!TYPES[ext]) { skipped.push(`[тип .${ext || '?'}] ${path.relative(ROOT, file)}`); continue }
  if (size > MAX) { skipped.push(`[${(size / 1048576).toFixed(1)} MB] ${path.relative(ROOT, file)}`); continue }

  if (!plan.has(hit.s.id)) plan.set(hit.s.id, { s: hit.s, files: [] })
  plan.get(hit.s.id).files.push(file)
}

// ── Отчет ───────────────────────────────────────────────────────────────
const out = []
const log = s => { out.push(s); console.log(s) }
const fileCount = [...plan.values()].reduce((a, p) => a + p.files.length, 0)
log(`Учебна година в EIS: ${year.name}`)
log(`РАЗПОЗНАТИ деца: ${plan.size}, файлове за качване: ${fileCount}`)
log(`БЕЗ ПАПКА ЗА ГОДИНА (не се качват без --bez-godina): ${noYear.size}`)
log(`НЕРАЗПОЗНАТИ папки: ${unmatched.size}   ЕДНАКВИ ИМЕНА: ${ambiguous.size}   НЕАКТИВНИ (напуснали/архив): ${inactive.size}   ПРЕСКОЧЕНИ файлове: ${skipped.length}`)
log('')
log('── Разпознати ──')
for (const { s, files } of [...plan.values()].sort((a, b) => a.s.last_name.localeCompare(b.s.last_name, 'bg')))
  log(`  ${s.first_name} ${s.last_name}  [${classOf.get(s.id) || 'без паралелка'}]  ${files.length} файла${teamOf.get(s.id)?.length ? '' : '  ⚠ няма ЕПЛР екип'}`)
log('\n── Неразпознати папки (няма такова дете в EIS) ──')
for (const [k, n] of unmatched) log(`  ${k}  (${n} файла)`)
log('\n── Еднакви имена (оправи ръчно) ──')
for (const [k, v] of ambiguous) log(`  ${k}  →  ${v}`)
log('\n── Неактивни деца (не се качват) ──')
for (const [k, n] of inactive) log(`  ${k}  (${n} файла)`)
log('\n── Деца без папка за година (провери дали файловете са от тази година) ──')
for (const [k, n] of noYear) log(`  ${k}  (${n} файла)`)
log('\n── Прескочени файлове ──')
for (const s of skipped) log('  ' + s)
fs.writeFileSync(REPORT, out.join('\n'))
console.log(`\nОтчетът е записан в ${REPORT}`)

if (!GO) {
  console.log('\nТова беше ПРОБА — нищо не е качено. За истинското качване добави --go')
  process.exit(0)
}

// ── Качване ─────────────────────────────────────────────────────────────
let done = 0, same = 0, failed = 0
for (const { s, files } of plan.values()) {
  const name = `${s.first_name} ${s.last_name}`
  try {
    const folderId = await ensureStudentFolder(s.id, name, year.name, classOf.get(s.id) || '')
    for (const email of teamOf.get(s.id) || [])
      for (const a of accounts(email)) { try { await share(folderId, a) } catch { /* няма такъв акаунт */ } }
    const existing = await namesIn(folderId)
    for (const f of files) {
      if (existing.has(driveName(f))) { same++; continue }
      try { await upload(f, folderId); existing.add(driveName(f)); done++ }
      catch (e) { failed++; console.log(`  ✗ ${name}: ${path.basename(f)} — ${e.message}`) }
    }
    console.log(`✓ ${name}: ${files.length} файла`)
  } catch (e) {
    failed += files.length
    console.log(`✗ ${name}: ${e.message}`)
  }
}
console.log(`\nГОТОВО. Качени: ${done}, вече ги имаше: ${same}, грешки: ${failed}`)
