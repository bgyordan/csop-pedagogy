// Еднократен скрипт: взима refresh token за eis@csop-varna.bg и го записва в ~/eis-google.env
// Пуска се на сървъра:  node scripts/google-token.mjs
import readline from 'node:readline/promises'
import { stdin as input, stdout as output } from 'node:process'
import { writeFileSync, chmodSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'

const REDIRECT = 'https://developers.google.com/oauthplayground'
const SCOPE = 'https://www.googleapis.com/auth/drive'
const rl = readline.createInterface({ input, output })

const clientId = (await rl.question('\n1) Постави Client ID и Enter:\n> ')).trim()
const clientSecret = (await rl.question('\n2) Постави Client secret и Enter:\n> ')).trim()

const url =
  'https://accounts.google.com/o/oauth2/v2/auth?' +
  new URLSearchParams({
    client_id: clientId,
    redirect_uri: REDIRECT,
    response_type: 'code',
    scope: SCOPE,
    access_type: 'offline',
    prompt: 'consent',
    login_hint: 'eis@csop-varna.bg',
  })

console.log('\n3) Отвори този линк в ИНКОГНИТО прозорец, влез с eis@csop-varna.bg и натисни Allow:\n')
console.log(url)
console.log('\n   Ще излезе страница с грешка — това е нормално.')

const back = (await rl.question('\n4) Копирай ЦЕЛИЯ адрес от браузъра, постави го тук и Enter:\n> ')).trim()
rl.close()

let code = null
try {
  const decoded = decodeURIComponent(decodeURIComponent(back))
  const m = decoded.match(/[?&]code=([^&]+)/)
  if (m) code = m[1]
} catch {}
if (!code) {
  console.error('\nНе намерих код в адреса. Пусни скрипта отначало.')
  process.exit(1)
}

const res = await fetch('https://oauth2.googleapis.com/token', {
  method: 'POST',
  headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  body: new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    code,
    grant_type: 'authorization_code',
    redirect_uri: REDIRECT,
  }),
})
const tok = await res.json()

if (!tok.refresh_token) {
  console.error('\nНе се получи refresh token. Отговор от Google:')
  console.error(JSON.stringify({ error: tok.error, description: tok.error_description }, null, 2))
  console.error('\nАко пише invalid_grant — кодът е изтекъл, пусни скрипта отначало и действай по-бързо.')
  process.exit(1)
}

// проверка: виждаме ли споделените дискове
const drives = await fetch('https://www.googleapis.com/drive/v3/drives?pageSize=50', {
  headers: { Authorization: `Bearer ${tok.access_token}` },
}).then((r) => r.json())

const file = join(homedir(), 'eis-google.env')
writeFileSync(
  file,
  `GOOGLE_CLIENT_ID=${clientId}\nGOOGLE_CLIENT_SECRET=${clientSecret}\nGOOGLE_REFRESH_TOKEN=${tok.refresh_token}\n`
)
chmodSync(file, 0o600)

console.log(`\nГОТОВО. Ключовете са записани в ${file}`)
console.log('Споделени дискове, които eis@ вижда:')
for (const d of drives.drives ?? []) console.log(`  - ${d.name}   (id: ${d.id})`)
if (!drives.drives?.length) console.log('  (няма — провери дали eis@ е член на „ЕПЛР тест“)')
