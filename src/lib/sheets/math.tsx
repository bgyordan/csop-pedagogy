// Листовете по смятане. Всеки генератор първо подготвя данните (със „семето“), после ги рисува —
// така листът с отговорите е точно същият лист, само с попълнени отговори.
import type { ReactNode } from 'react'
import { BODY, INK, ANS, FONT, T, TL, Box, Line, Num, scatter, rows5, wrap } from './core'
import { Icon, Coin, Note, Clock, moneyLabel } from './icons'
import { noun } from './themes'
import { LEVEL_LABEL, type Gen, type Opts } from './types'

const { x: X0, y: Y0, w: BW } = BODY
const R_SMALL = [{ v: 5, label: 'до 5' }, { v: 10, label: 'до 10' }, { v: 20, label: 'до 20' }]
const card = (x: number, y: number, w: number, h: number, color: string, fill = '#fff') =>
  <rect x={x} y={y} width={w} height={h} rx={22} fill={fill} stroke={color} strokeWidth={2.5} />
const ring = (cx: number, cy: number, r: number) => <circle cx={cx} cy={cy} r={r} fill="none" stroke={ANS} strokeWidth={4} />
/** цифра за трасиране — пунктирен контур */
const Trace = ({ x, y, s, n, color }: { x: number; y: number; s: number; n: string | number; color: string }) =>
  <text x={x} y={y} fontSize={s} fontWeight={900} fill="none" stroke={color} strokeWidth={2.4} strokeDasharray="4 5" textAnchor="middle" fontFamily={FONT}>{n}</text>
const distinct = (o: Opts, n: number, lo: number, hi: number) => {
  const pool = o.r.shuffle(Array.from({ length: hi - lo + 1 }, (_, i) => lo + i))
  return Array.from({ length: n }, (_, i) => pool[i % pool.length])
}
const meta = (o: Opts, title: string, instr: string, tip: string, code: string, icon?: string) =>
  ({ title, instr, tip, code, levelLabel: LEVEL_LABEL[o.level], icon })

// ═══ 1. Преброй ═══
const count: Gen = {
  id: 'count', title: 'Преброй', part: 'math', area: 'Броене и количество', skills: ['С1.1', 'С1.2', 'С1.4'], levels: [1, 2, 3], ranges: R_SMALL,
  desc: 'Табло за броене с истински предмети · преброй и огради числото · преброй и напиши',
  make(o) {
    const { theme: th, r } = o
    const top = Math.min(o.range, o.level === 1 ? 10 : 20)
    if (o.level === 1) {
      const ns = distinct(o, 6, 1, top), ics = ns.map(() => r.pick(th.icons))
      return {
        meta: meta(o, 'Табло за броене', 'Сложи толкова предмета, колкото показва числото. Преброй ги на глас.', 'Използвайте истински предмети (капачки, кубчета, жълъди). Детето слага по един предмет в кръгче и брои на глас; накрая трасира цифрата с пръст.', 'С1.2', ics[0]),
        body: () => <>{ns.map((n, i) => {
          const cx = X0 + (i % 2) * 362, cy = Y0 + 16 + Math.floor(i / 2) * 270, w = 352, h = 256
          return <g key={i}>
            {card(cx, cy, w, h, th.color, th.soft)}
            <Trace x={cx + 68} y={cy + 146} s={n >= 10 ? 84 : 140} n={n} color={th.color} />
            <Icon id={ics[i]} x={cx + 30} y={cy + 178} s={60} />
            {rows5(n, cx + 138, cy + (n <= 5 ? 104 : 74), 36, 6).map((p, j) => <circle key={j} cx={p.x + 18} cy={p.y + 18} r={17} fill="#fff" stroke={INK} strokeWidth={2} strokeDasharray="4 4" />)}
          </g>
        })}</>,
      }
    }
    if (o.level === 2) {
      const cells = distinct(o, 6, 1, top).map(n => {
        const opts = r.shuffle(Array.from(new Set([n, Math.max(1, n - r.int(1, 2)), Math.min(top + 2, n + r.int(1, 2))])).concat([n + 3]).slice(0, 3))
        if (!opts.includes(n)) opts[0] = n
        return { n, ic: r.pick(th.icons), opts: r.shuffle(opts) }
      })
      return {
        meta: meta(o, 'Преброй и огради', 'Преброй рисунките в квадрата. Огради вярното число.', 'Ако детето брои отначало или пропуска — нека докосва и задрасква всяка рисунка с молив, докато брои. При затруднение се върнете към таблото с предмети.', 'С1.2', cells[0].ic),
        body: (ans) => <>{cells.map((c, i) => {
          const cx = X0 + (i % 2) * 362, cy = Y0 + 16 + Math.floor(i / 2) * 270, w = 352, h = 256
          const size = c.n <= 5 ? 64 : c.n <= 10 ? 50 : 36
          const pos = scatter(r, c.n, cx + 18, cy + 14, w - 36, h - 100, size)
          return <g key={i}>
            {card(cx, cy, w, h, th.color)}
            {pos.map((p, j) => <Icon key={j} id={c.ic} x={p.x} y={p.y} s={size} rot={(j * 37) % 20 - 10} />)}
            <line x1={cx + 20} y1={cy + h - 76} x2={cx + w - 20} y2={cy + h - 76} stroke="#e2e8f0" strokeWidth={2} />
            {c.opts.map((v, j) => { const ox = cx + w / 2 + (j - 1) * 96, oy = cy + h - 38; return <g key={j}>
              <circle cx={ox} cy={oy} r={27} fill={th.soft} stroke={th.color} strokeWidth={2.5} />
              <T x={ox} y={oy + 11} s={30} w={900} a="middle">{v}</T>
              {ans && v === c.n && ring(ox, oy, 34)}
            </g> })}
          </g>
        })}</>,
      }
    }
    // ниво 3 — подредени по 5 (лесни за „виждане“), напиши числото + трасиране на цифрите
    const cells = distinct(o, 6, 1, top).map(n => ({ n, ic: r.pick(th.icons) }))
    const traceTo = Math.min(top, 10)
    return {
      meta: meta(o, 'Преброй и напиши', 'Преброй рисунките и напиши числото в квадратчето. Долу трасирай цифрите.', 'Рисунките са подредени по пет — научете детето да „вижда“ пет наведнъж, вместо да брои по една. Цифрите се трасират от горе надолу.', 'С1.4', cells[0].ic),
      body: (ans) => <>
        {cells.map((c, i) => {
          const cx = X0 + (i % 2) * 362, cy = Y0 + 10 + Math.floor(i / 2) * 200, w = 352, h = 186
          const size = c.n <= 10 ? 40 : 28
          return <g key={i}>
            {card(cx, cy, w, h, th.color)}
            {rows5(c.n, cx + 18, cy + 20 + (c.n <= 5 ? 50 : c.n <= 10 ? 26 : 8), size, 6).map((p, j) => <Icon key={j} id={c.ic} x={p.x} y={p.y} s={size} />)}
            <Box x={cx + w - 98} y={cy + h / 2 - 40} w={78} h={80} ans={c.n} show={ans} r={16} />
          </g>
        })}
        <rect x={X0} y={Y0 + 616} width={BW} height={190} rx={22} fill={th.soft} stroke={th.color} strokeWidth={2.5} />
        <T x={X0 + 22} y={Y0 + 648} s={18} w={800} fill={th.deep}>Трасирай цифрите:</T>
        {Array.from({ length: traceTo }, (_, i) => <Trace key={i} x={X0 + 44 + i * 62 + (i === 9 ? 26 : 0)} y={Y0 + 756} s={80} n={i + 1} color={INK} />)}
      </>,
    }
  },
}

// ═══ 2. Свържи ═══
const match: Gen = {
  id: 'match', title: 'Свържи', part: 'math', area: 'Броене и количество', skills: ['С1.4', 'С2.1'], levels: [2, 3], ranges: [{ v: 10, label: 'до 10' }, { v: 20, label: 'до 20' }],
  desc: 'Количество ↔ цифра · цифра ↔ думата за числото',
  make(o) {
    const { theme: th, r } = o
    const WORDS = ['нула', 'едно', 'две', 'три', 'четири', 'пет', 'шест', 'седем', 'осем', 'девет', 'десет', 'единайсет', 'дванайсет', 'тринайсет', 'четиринайсет', 'петнайсет', 'шестнайсет', 'седемнайсет', 'осемнайсет', 'деветнайсет', 'двайсет']
    const ns = distinct(o, 6, 1, Math.min(o.range, 20)), right = r.shuffle(ns.map((_, i) => i)), ics = ns.map(() => r.pick(th.icons))
    const rowH = 128, top = Y0 + 20
    const L = o.level === 2
    return {
      meta: L ? meta(o, 'Свържи с числото', 'Преброй рисунките и ги свържи с линия с вярното число.', 'Линията се тегли от точка до точка. Ако детето се колебае — нека първо напише числото до рисунките, после да търси същото вдясно.', 'С1.4', ics[0])
        : meta(o, 'Число и дума', 'Свържи всяко число с думата, с която се казва.', 'Четете думите заедно на глас. За деца, които още не четат — учителят чете, детето посочва цифрата.', 'С2.1'),
      body: (ans) => <>{ns.map((n, i) => {
        const y = top + i * rowH, j = right.indexOf(i), yr = top + j * rowH
        return <g key={i}>
          {card(X0, y, 330, rowH - 16, th.color, i % 2 ? '#fff' : th.soft)}
          {L ? (n <= 10 ? rows5(n, X0 + 18, y + (n <= 5 ? 32 : 12), 42, 6) : rows5(n, X0 + 14, y + 6, 28, 3, 10)).map((p, k) => <Icon key={k} id={ics[i]} x={p.x} y={p.y} s={n <= 10 ? 42 : 28} />)
            : <T x={X0 + 165} y={y + 76} s={56} w={900} fill={th.deep} a="middle">{n}</T>}
          <circle cx={X0 + 352} cy={y + (rowH - 16) / 2} r={8} fill={INK} />
          {/* дясно */}
          <circle cx={X0 + BW - 250} cy={top + i * rowH + (rowH - 16) / 2} r={8} fill={INK} />
          {card(X0 + BW - 230, top + i * rowH, 230, rowH - 16, th.color, i % 2 ? th.soft : '#fff')}
          <T x={X0 + BW - 115} y={top + i * rowH + (L ? 78 : 70)} s={L ? 54 : 30} w={900} a="middle">{L ? ns[right[i]] : WORDS[ns[right[i]]]}</T>
          {ans && <line x1={X0 + 352} y1={y + (rowH - 16) / 2} x2={X0 + BW - 250} y2={yr + (rowH - 16) / 2} stroke={ANS} strokeWidth={4} strokeLinecap="round" />}
        </g>
      })}</>,
    }
  },
}

// ═══ 3. Къде са повече? / Сравни ═══
const compare: Gen = {
  id: 'compare', title: 'Сравни', part: 'math', area: 'Броене и количество', skills: ['С1.3', 'С2.3'], levels: [2, 3], ranges: [{ v: 10, label: 'до 10' }, { v: 20, label: 'до 20' }, { v: 100, label: 'до 100' }],
  variants: [{ v: 'more', label: 'Повече' }, { v: 'less', label: 'По-малко' }],
  desc: 'Огради групата с повече/по-малко · знаците <, >, =',
  make(o) {
    const { theme: th, r } = o
    if (o.level === 2) {
      const more = o.variant !== 'less', top = Math.min(o.range, 10)
      const rows = Array.from({ length: 4 }, () => { let a = r.int(1, top), b = r.int(1, top); while (a === b) b = r.int(1, top); return { a, b, ia: r.pick(th.icons), ib: r.pick(th.icons) } })
      return {
        meta: meta(o, more ? 'Къде са повече?' : 'Къде са по-малко?', more ? 'Огради квадрата, в който рисунките са ПОВЕЧЕ.' : 'Огради квадрата, в който рисунките са ПО-МАЛКО.', 'Първо без броене — „на око“. После проверете, като свържете рисунките по двойки с линия: на която страна останат без двойка — там са повече.', 'С1.3', rows[0].ia),
        body: (ans) => <>{rows.map((rw, i) => {
          const y = Y0 + 14 + i * 200, w = 330, h = 184
          const win = more ? (rw.a > rw.b ? 0 : 1) : (rw.a < rw.b ? 0 : 1)
          return <g key={i}>
            {[0, 1].map(k => { const x = X0 + k * (w + 54), n = k ? rw.b : rw.a, ic = k ? rw.ib : rw.ia, size = n <= 5 ? 56 : 44
              return <g key={k}>{card(x, y, w, h, th.color)}{scatter(r, n, x + 14, y + 12, w - 28, h - 24, size).map((p, j) => <Icon key={j} id={ic} x={p.x} y={p.y} s={size} />)}
                {ans && win === k && <rect x={x - 7} y={y - 7} width={w + 14} height={h + 14} rx={28} fill="none" stroke={ANS} strokeWidth={4} />}</g> })}
            <T x={X0 + w + 27} y={y + h / 2 + 12} s={30} w={900} fill="#cbd5e1" a="middle">?</T>
          </g>
        })}</>,
      }
    }
    const pairs = Array.from({ length: 12 }, (_, i) => { const a = r.int(0, o.range); const b = i % 6 === 5 ? a : r.int(0, o.range); return { a, b } })
    const sign = (a: number, b: number) => (a > b ? '>' : a < b ? '<' : '=')
    return {
      meta: meta(o, 'По-голямо, по-малко, равно', 'Сложи знак: > (по-голямо), < (по-малко) или = (равно).', 'Знакът „гледа“ с отворената страна към по-голямото число. Ако детето се обърква — сравнете с пръчици или монети.', 'С2.3'),
      body: (ans) => <>
        <rect x={X0} y={Y0 + 10} width={BW} height={130} rx={22} fill={th.soft} stroke={th.color} strokeWidth={2.5} />
        {[['7', '>', '3', 'по-голямо'], ['2', '<', '6', 'по-малко'], ['5', '=', '5', 'равно']].map(([a, s, b, l], i) => <g key={i}>
          <T x={X0 + 120 + i * 238} y={Y0 + 82} s={42} w={900} a="middle">{a}  {s}  {b}</T>
          <T x={X0 + 120 + i * 238} y={Y0 + 118} s={17} w={700} fill={th.deep} a="middle">{l}</T>
        </g>)}
        {pairs.map((p, i) => { const x = X0 + (i % 2) * 362 + 30, y = Y0 + 176 + Math.floor(i / 2) * 106
          return <g key={i}><Num x={x} y={y + 34} n={i + 1} color={th.color} />
            <T x={x + 92} y={y + 50} s={44} w={800} a="middle">{p.a}</T>
            <circle cx={x + 170} cy={y + 34} r={30} fill="#fff" stroke={INK} strokeWidth={2.5} />
            {ans && <T x={x + 170} y={y + 48} s={38} w={900} fill={ANS} a="middle">{sign(p.a, p.b)}</T>}
            <T x={x + 248} y={y + 50} s={44} w={800} a="middle">{p.b}</T></g> })}
      </>,
    }
  },
}

// ═══ 4. Рамка от 10 ═══
const Frame = ({ x, y, cell, filled, icon, color, dots }: { x: number; y: number; cell: number; filled: number; icon?: string; color: string; dots?: boolean }) => <g>
  <rect x={x} y={y} width={cell * 5} height={cell * 2} rx={8} fill="#fff" stroke={INK} strokeWidth={2.5} />
  {Array.from({ length: 10 }, (_, i) => <g key={i}>
    {i % 5 && <line x1={x + (i % 5) * cell} y1={y} x2={x + (i % 5) * cell} y2={y + cell * 2} stroke={INK} strokeWidth={1.6} />}
    {i < filled && (dots || !icon ? <circle cx={x + (i % 5) * cell + cell / 2} cy={y + Math.floor(i / 5) * cell + cell / 2} r={cell * 0.32} fill={color} />
      : <Icon id={icon} x={x + (i % 5) * cell + cell * 0.1} y={y + Math.floor(i / 5) * cell + cell * 0.1} s={cell * 0.8} />)}
  </g>)}
  <line x1={x} y1={y + cell} x2={x + cell * 5} y2={y + cell} stroke={INK} strokeWidth={1.6} />
</g>
const tenframe: Gen = {
  id: 'tenframe', title: 'Рамка от 10', part: 'math', area: 'Събиране и изваждане', skills: ['С3.1', 'С3.3', 'С1.2'], levels: [1, 2, 3, 4],
  desc: 'Табло с две рамки · колко има и колко липсват до 10 · допълни до 10',
  make(o) {
    const { theme: th, r } = o
    if (o.level === 1) return {
      meta: meta(o, 'Рамка от 10 — табло', 'Сложи предметите в квадратчетата. Колко има? Колко липсват до 10?', 'Пълнете винаги отляво надясно, първо горния ред. Питайте: „Колко има? Колко празни? Колко стават заедно?“ — така детето „вижда“ числата до 10 и до 20.', 'С3.3', th.icons[0]),
      body: () => <>{[0, 1].map(k => <g key={k}>
        <Frame x={X0 + 10} y={Y0 + 50 + k * 390} cell={122} filled={0} color={th.color} />
        <Icon id={th.icons[k % th.icons.length]} x={X0 + BW - 70} y={Y0 + 50 + k * 390} s={66} />
      </g>)}</>,
    }
    if (o.level === 2) {
      const ks = distinct(o, 6, 1, 9), ic = r.pick(th.icons)
      return {
        meta: meta(o, 'Колко липсват до 10?', 'Преброй колко има в рамката и колко квадратчета са празни.', 'Двете числа винаги правят 10 — това са „приятелите на десетката“ (7 и 3, 6 и 4…). Те са ключът за събиране с преминаване.', 'С3.3', ic),
        body: (ans) => <>{ks.map((k, i) => { const x = X0 + (i % 2) * 362, y = Y0 + 10 + Math.floor(i / 2) * 270
          return <g key={i}>{card(x, y, 352, 256, th.color, th.soft)}
            <Frame x={x + 26} y={y + 22} cell={60} filled={k} icon={ic} color={th.color} />
            <T x={x + 34} y={y + 202} s={20} w={800}>Има</T><Box x={x + 86} y={y + 168} w={58} h={52} ans={k} show={ans} />
            <T x={x + 166} y={y + 202} s={20} w={800}>Липсват</T><Box x={x + 264} y={y + 168} w={58} h={52} ans={10 - k} show={ans} />
          </g> })}</>,
      }
    }
    const n = o.level === 3 ? 12 : 20
    const items = Array.from({ length: n }, (_, i) => { const k = r.int(1, 9); const form = o.level === 3 ? 0 : i % 3; return { k, form } })
    return {
      meta: meta(o, o.level === 3 ? 'Допълни до 10' : 'Приятелите на 10', o.level === 3 ? 'Кое число допълва до 10? Рамката подсказва.' : 'Попълни бързо. Засечи колко време ти отне.', 'Кажете на глас: „7 и колко правят 10?“. Когато детето отговаря бързо и сигурно, минете към 8 + 5 = 8 + 2 + 3.', 'С3.3'),
      body: (ans) => <>
        {o.level === 4 && <g><Icon id="clockIcon" x={X0 + BW - 190} y={Y0 + 2} s={44} /><T x={X0 + BW - 140} y={Y0 + 32} s={18} w={800}>Време:</T><Line x={X0 + BW - 74} y={Y0 + 34} w={70} /></g>}
        {items.map((it, i) => {
          const cols = 2, x = X0 + (i % cols) * 362 + 14, y = Y0 + (o.level === 4 ? 60 : 16) + Math.floor(i / cols) * (o.level === 3 ? 132 : 74)
          const eq = it.form === 0 ? [String(it.k), '+', '?', '=', '10'] : it.form === 1 ? ['?', '+', String(it.k), '=', '10'] : ['10', '−', String(it.k), '=', '?']
          const answer = 10 - it.k
          return <g key={i}>
            {o.level === 3 && <Frame x={x} y={y + 8} cell={22} filled={it.k} color={th.color} dots />}
            {eq.map((t, j) => { const ex = x + (o.level === 3 ? 140 : 20) + j * 42
              return t === '?' ? <Box key={j} x={ex - 4} y={y + 6} w={50} h={50} ans={answer} show={ans} /> : <T key={j} x={ex + 20} y={y + 44} s={34} w={800} a="middle">{t}</T> })}
          </g>
        })}
      </>,
    }
  },
}

// ═══ 5. Влакче с числа ═══
const train: Gen = {
  id: 'train', title: 'Влакче с числа', part: 'math', area: 'Броене и количество', skills: ['С1.1', 'С1.5', 'С2.1', 'С4.2'], levels: [2, 3],
  ranges: [{ v: 10, label: 'до 10' }, { v: 20, label: 'до 20' }, { v: 100, label: 'до 100' }],
  variants: [{ v: '1', label: 'през 1' }, { v: '2', label: 'през 2' }, { v: '5', label: 'през 5' }, { v: '10', label: 'през 10' }],
  desc: 'Липсващите числа във вагончетата — напред и назад, през 1, 2, 5, 10',
  make(o) {
    const { theme: th, r } = o
    const step = Number(o.variant) || 1
    const trains = Array.from({ length: 5 }, (_, i) => {
      const back = o.level === 3 && i >= 3
      const maxStart = Math.max(0, o.range - step * 5)
      let start = Math.floor(r.int(step === 1 ? 1 : 0, Math.max(step === 1 ? 1 : 0, maxStart)) / step) * step
      if (step === 1 && start < 1) start = 1
      let nums = Array.from({ length: 6 }, (_, j) => start + j * step)
      if (back) nums = nums.reverse()
      const hide = new Set(r.shuffle([1, 2, 3, 4, 5]).slice(0, o.level === 2 ? 2 : 3))
      return { nums, hide, back }
    })
    const wagon = (x: number, y: number, n: number, hidden: boolean, show: boolean, c: string) => <g>
      <rect x={x} y={y} width={88} height={70} rx={10} fill={hidden ? '#fff' : c} stroke={INK} strokeWidth={2.5} />
      <circle cx={x + 22} cy={y + 78} r={11} fill={INK} /><circle cx={x + 66} cy={y + 78} r={11} fill={INK} />
      <circle cx={x + 22} cy={y + 78} r={4} fill="#cbd5e1" /><circle cx={x + 66} cy={y + 78} r={4} fill="#cbd5e1" />
      {!hidden && <T x={x + 44} y={y + 47} s={n >= 100 ? 26 : 32} w={900} a="middle">{n}</T>}
      {hidden && show && <T x={x + 44} y={y + 47} s={32} w={900} fill={ANS} a="middle">{n}</T>}
    </g>
    const colors = [th.soft, '#fef9c3', '#e0f2fe', '#dcfce7', '#fae8ff', '#ffe4e6']
    return {
      meta: meta(o, 'Влакче с числа', step === 1 ? 'Кои числа липсват във вагончетата? Напиши ги.' : `Броим през ${step}. Кои числа липсват? Напиши ги.`, step === 1 ? 'Нека детето чете числата на глас и „пътува“ с пръст. Обърнатите влакчета (назад) са по-трудни — оставете ги за накрая.' : `Броенето през ${step} е основата на таблицата за умножение. Пляскайте или скачайте на всяко число.`, step === 1 ? 'С1.5' : 'С4.2'),
      body: (ans) => <>{trains.map((t, i) => { const y = Y0 + 20 + i * 160
        return <g key={i}>
          {/* локомотив */}
          <g>
            <rect x={X0} y={y + 6} width={70} height={64} rx={10} fill={th.color} stroke={INK} strokeWidth={2.5} />
            <rect x={X0 + 40} y={y - 22} width={26} height={30} rx={4} fill={th.color} stroke={INK} strokeWidth={2.5} />
            <rect x={X0 + 10} y={y + 16} width={26} height={22} rx={4} fill="#e0f2fe" stroke={INK} strokeWidth={2} />
            <path d={`M${X0 + 46} ${y - 30} C${X0 + 40} ${y - 46} ${X0 + 60} ${y - 52} ${X0 + 56} ${y - 66}`} fill="none" stroke="#cbd5e1" strokeWidth={6} strokeLinecap="round" />
            <circle cx={X0 + 20} cy={y + 78} r={11} fill={INK} /><circle cx={X0 + 54} cy={y + 78} r={11} fill={INK} />
          </g>
          {t.nums.map((n, j) => <g key={j}>
            <line x1={X0 + 70 + j * 104} y1={y + 52} x2={X0 + 86 + j * 104} y2={y + 52} stroke={INK} strokeWidth={3} />
            {wagon(X0 + 86 + j * 104, y, n, t.hide.has(j), ans, colors[j % colors.length])}
          </g>)}
          {t.back && <T x={X0 + BW} y={y - 14} s={14} w={800} fill={th.deep} a="end">назад ←</T>}
        </g> })}</>,
    }
  },
}

// ═══ 6–7. Събиране / Изваждане ═══
function eqGen(kind: 'add' | 'sub'): Gen {
  const add = kind === 'add'
  return {
    id: kind, title: add ? 'Събиране' : 'Изваждане', part: 'math', area: 'Събиране и изваждане', skills: add ? ['С3.1', 'С3.2', 'С3.3', 'С3.4'] : ['С3.1', 'С3.2', 'С3.4'],
    levels: [2, 3, 4], ranges: [{ v: 5, label: 'до 5' }, { v: 10, label: 'до 10' }, { v: 20, label: 'до 20' }, { v: 100, label: 'до 100' }],
    variants: [{ v: 'any', label: 'смесено' }, { v: 'nocarry', label: 'без преминаване' }, { v: 'carry', label: 'с преминаване' }],
    desc: add ? 'С картинки · с числова права · бързо смятане' : 'Задраскай и преброй · с числова права · бързо смятане',
    make(o) {
      const { theme: th, r } = o
      const top = o.level === 2 ? Math.min(o.range, 10) : o.range
      const pair = () => {
        for (let t = 0; t < 200; t++) {
          let a = r.int(add ? 1 : 2, top), b = r.int(1, add ? top - 1 : a)
          if (add && a + b > top) continue
          if (!add && b > a) continue
          const carry = add ? (a % 10) + (b % 10) >= 10 : (a % 10) < (b % 10)
          if (o.variant === 'nocarry' && carry) continue
          if (o.variant === 'carry' && !carry && top > 10) continue
          if (top > 20 && o.variant === 'any' && t < 50 && a < 10 && b < 10) continue
          if (!add && a === b && t < 100) continue
          return { a, b, c: add ? a + b : a - b }
        }
        return { a: 2, b: 1, c: add ? 3 : 1 }
      }
      if (o.level === 2) {
        const rows = Array.from({ length: 6 }, () => ({ ...pair(), ic: r.pick(th.icons) }))
        return {
          meta: meta(o, add ? 'Събери рисунките' : 'Задраскай и преброй', add ? 'Колко са общо? Преброй и напиши в квадратчето.' : 'Задраскай толкова рисунки, колкото казва задачата. Колко остават?', add ? 'Първо с истински предмети: „имаше 3, дойдоха още 2“. Насърчавайте детето да брои нататък от по-голямото число, без да брои отначало.' : 'Задрасква се отзад напред. Разказвайте историята: „Имаше 7 ябълки, изядохме 3…“.', 'С3.1', rows[0].ic),
          body: (ans) => <>{rows.map((q, i) => { const y = Y0 + 10 + i * 134, h = 120
            if (add) return <g key={i}>
              {card(X0, y, 268, h, th.color)}{rows5(q.a, X0 + 16, y + (q.a <= 5 ? 36 : 12), 44, 6).map((p, j) => <Icon key={j} id={q.ic} x={p.x} y={p.y} s={44} />)}
              <T x={X0 + 296} y={y + 74} s={48} w={900} fill={th.deep} a="middle">+</T>
              {card(X0 + 324, y, 268, h, th.color)}{rows5(q.b, X0 + 340, y + (q.b <= 5 ? 36 : 12), 44, 6).map((p, j) => <Icon key={j} id={q.ic} x={p.x} y={p.y} s={44} />)}
              <T x={X0 + 618} y={y + 74} s={48} w={900} fill={th.deep} a="middle">=</T>
              <Box x={X0 + 640} y={y + 26} w={72} h={70} ans={q.c} show={ans} r={14} />
            </g>
            const pos = rows5(q.a, X0 + 20, y + (q.a <= 5 ? 36 : 12), 44, 8)
            return <g key={i}>
              {card(X0, y, 360, h, th.color)}
              {pos.map((p, j) => <g key={j}><Icon id={q.ic} x={p.x} y={p.y} s={44} />{ans && j >= q.a - q.b && <path d={`M${p.x} ${p.y} L${p.x + 44} ${p.y + 44} M${p.x + 44} ${p.y} L${p.x} ${p.y + 44}`} stroke={ANS} strokeWidth={4} strokeLinecap="round" />}</g>)}
              <T x={X0 + 400} y={y + 74} s={40} w={900} a="start">{q.a} − {q.b} =</T>
              <Box x={X0 + 600} y={y + 26} w={72} h={70} ans={q.c} show={ans} r={14} />
            </g>
          })}</>,
        }
      }
      const n = o.level === 3 ? 12 : 20
      const qs = Array.from({ length: n }, pair)
      const lineMax = top <= 10 ? 10 : 20
      return {
        meta: meta(o, add ? (o.level === 3 ? 'Събиране с числова права' : 'Бързо събиране') : (o.level === 3 ? 'Изваждане с числова права' : 'Бързо изваждане'),
          o.level === 3 ? (add ? 'Скачай по правата напред и напиши резултата.' : 'Скачай по правата назад и напиши резултата.') : 'Реши задачите. Засечи колко време ти отне.',
          o.level === 3 ? 'Правата е опора — с пръст или с моливче, със скокове. Когато детето вече не я ползва — минете към ниво „наум“.' : 'Целта е бързо и сигурно припомняне. Повторете листа след няколко дни и сравнете времето — детето вижда напредъка си.',
          o.range > 20 ? 'С3.4' : o.variant === 'carry' ? 'С3.3' : o.range > 10 ? 'С3.2' : 'С3.1'),
        body: (ans) => <>
          {o.level === 3 && top <= 20 && <g>
            <line x1={X0 + 20} y1={Y0 + 60} x2={X0 + BW - 20} y2={Y0 + 60} stroke={INK} strokeWidth={3} />
            {Array.from({ length: lineMax + 1 }, (_, i) => { const x = X0 + 20 + i * (BW - 40) / lineMax; return <g key={i}><line x1={x} y1={Y0 + 48} x2={x} y2={Y0 + 72} stroke={INK} strokeWidth={i % 5 ? 2 : 3.5} /><T x={x} y={Y0 + 100} s={i % 5 ? 18 : 21} w={i % 5 ? 600 : 900} a="middle" fill={i % 10 ? INK : th.deep}>{i}</T></g> })}
          </g>}
          {o.level === 4 && <g><Icon id="clockIcon" x={X0 + BW - 190} y={Y0 + 2} s={44} /><T x={X0 + BW - 140} y={Y0 + 32} s={18} w={800}>Време:</T><Line x={X0 + BW - 74} y={Y0 + 34} w={70} /></g>}
          {qs.map((q, i) => { const x = X0 + (i % 2) * 362 + 20, y = Y0 + (o.level === 3 ? 136 : 60) + Math.floor(i / 2) * (o.level === 3 ? 108 : 74)
            return <g key={i}>
              {o.level === 3 && <Num x={x + 4} y={y + 30} n={i + 1} color={th.color} />}
              <T x={x + (o.level === 3 ? 34 : 0)} y={y + 44} s={36} w={800}>{q.a} {add ? '+' : '−'} {q.b} =</T>
              <Box x={x + (o.level === 3 ? 230 : 200)} y={y + 4} w={84} h={54} ans={q.c} show={ans} />
            </g> })}
        </>,
      }
    },
  }
}

// ═══ 8. Десетици и единици ═══
const Bundle = ({ x, y, h = 90, color }: { x: number; y: number; h?: number; color: string }) => <g>
  {Array.from({ length: 10 }, (_, i) => <rect key={i} x={x + i * 5} y={y} width={5} height={h} rx={2} fill={color} stroke={INK} strokeWidth={0.9} />)}
  <rect x={x - 2} y={y + h / 2 - 6} width={54} height={12} rx={4} fill="#ef4444" stroke={INK} strokeWidth={1.6} />
</g>
const Stick = ({ x, y, h = 90, color }: { x: number; y: number; h?: number; color: string }) => <rect x={x} y={y} width={6} height={h} rx={2.5} fill={color} stroke={INK} strokeWidth={1.2} />
const tens: Gen = {
  id: 'tens', title: 'Десетици и единици', part: 'math', area: 'Числа и място', skills: ['С2.1', 'С2.2', 'С2.4'], levels: [2, 3],
  ranges: [{ v: 50, label: 'до 50' }, { v: 100, label: 'до 100' }, { v: 1000, label: 'до 1000' }],
  desc: 'Снопчета по 10 и отделни пръчици · разложи числото',
  make(o) {
    const { theme: th, r } = o
    if (o.level === 2) {
      const top = Math.min(o.range, 59)
      const ns = distinct(o, 5, 11, top)
      return {
        meta: meta(o, 'Снопчета и пръчици', 'Всяко снопче има 10 пръчици. Колко са десетиците, колко — единиците? Кое е числото?', 'Направете истински снопчета от клечки с ластик. Първо се казват десетиците: „3 десетици и 7 единици — 37“. Внимавайте за размяна на цифрите (37 → 73).', 'С2.2'),
        body: (ans) => <>{ns.map((n, i) => { const y = Y0 + 8 + i * 162, t = Math.floor(n / 10), u = n % 10
          return <g key={i}>
            {card(X0, y, BW, 148, th.color, i % 2 ? '#fff' : th.soft)}
            {Array.from({ length: t }, (_, j) => <Bundle key={j} x={X0 + 20 + j * 60} y={y + 28} color="#fcd34d" />)}
            {Array.from({ length: u }, (_, j) => <Stick key={j} x={X0 + 30 + t * 60 + j * 12} y={y + 28} color="#93c5fd" />)}
            <Box x={X0 + BW - 290} y={y + 30} w={56} h={52} ans={t} show={ans} /><T x={X0 + BW - 262} y={y + 112} s={15} w={800} a="middle">дес.</T>
            <Box x={X0 + BW - 220} y={y + 30} w={56} h={52} ans={u} show={ans} /><T x={X0 + BW - 192} y={y + 112} s={15} w={800} a="middle">ед.</T>
            <T x={X0 + BW - 130} y={y + 66} s={32} w={900} a="middle">=</T>
            <Box x={X0 + BW - 104} y={y + 26} w={86} h={60} ans={n} show={ans} r={14} />
          </g> })}</>,
      }
    }
    const big = o.range > 100
    const items = Array.from({ length: 10 }, (_, i) => { const n = big ? r.int(101, 999) : r.int(11, Math.min(o.range, 99)); return { n, rev: i % 2 === 1 } })
    return {
      meta: meta(o, big ? 'Стотици, десетици, единици' : 'Разложи числото', big ? 'Напиши колко стотици, десетици и единици има числото — и обратно.' : 'Напиши колко десетици и единици има числото — и обратно.', 'Ползвайте таблица с колони С | Д | Е или монети (1 €, 10 ц., 1 ц.) като опора. Числата с нула (40, 305) са най-трудни — включвайте ги нарочно.', big ? 'С2.4' : 'С2.2'),
      body: (ans) => <>{items.map((it, i) => { const x = X0 + (i % 2) * 362 + 14, y = Y0 + 20 + Math.floor(i / 2) * 156
        const h = Math.floor(it.n / 100), t = Math.floor(it.n / 10) % 10, u = it.n % 10
        const parts = big ? [[h, 'ст.'], [t, 'дес.'], [u, 'ед.']] : [[Math.floor(it.n / 10), 'дес.'], [u, 'ед.']]
        return <g key={i}>
          {card(x - 14, y, 352, 140, th.color, i % 4 < 2 ? th.soft : '#fff')}
          <Num x={x + 10} y={y + 26} n={i + 1} color={th.color} />
          {!it.rev ? <>
            <T x={x + 40} y={y + 88} s={38} w={900}>{it.n} =</T>
            {parts.map(([v, l], j) => <g key={j}><Box x={x + (big ? 140 : 150) + j * (big ? 64 : 88)} y={y + 50} w={50} h={50} ans={v} show={ans} /><T x={x + (big ? 165 : 175) + j * (big ? 64 : 88)} y={y + 120} s={14} w={800} a="middle">{l}</T></g>)}
          </> : <>
            <T x={x + 40} y={y + 88} s={24} w={800}>{parts.map(([v, l]) => `${v} ${l}`).join(' ')} =</T>
            <Box x={x + 248} y={y + 50} w={78} h={52} ans={it.n} show={ans} />
          </>}
        </g> })}</>,
    }
  },
}

// ═══ 9. Часовник ═══
const ROUTINE: [string, string, number][] = [['sun', 'ставам', 7], ['toothbrush', 'мия зъбите', 7], ['bowl', 'закуска', 8], ['backpack', 'тръгвам', 8], ['bowl', 'обяд', 12], ['ball', 'игра', 4], ['house', 'вкъщи', 5], ['bed', 'лягам', 9]]
const clock: Gen = {
  id: 'clock', title: 'Часовник', part: 'math', area: 'Време', skills: ['С6.2', 'С6.3'], levels: [2, 3],
  variants: [{ v: 'h', label: 'цели часове' }, { v: 'hh', label: 'и половин' }, { v: 'q', label: 'и четвърт' }, { v: '5', label: 'през 5 минути' }],
  desc: 'Колко е часът? · нарисувай стрелките',
  make(o) {
    const { theme: th, r } = o
    const mins = o.variant === 'h' ? [0] : o.variant === 'hh' ? [0, 30] : o.variant === 'q' ? [0, 15, 30, 45] : Array.from({ length: 12 }, (_, i) => i * 5)
    const times = r.shuffle(ROUTINE).slice(0, 6).map(act => ({ h: ((act[2] + r.int(-1, 1) + 11) % 12) + 1, m: r.pick(mins), act }))
    const draw = o.level === 3
    const fmt = (t: { h: number; m: number }) => `${t.h}:${String(t.m).padStart(2, '0')}`
    return {
      meta: meta(o, draw ? 'Нарисувай стрелките' : 'Колко е часът?', draw ? 'Нарисувай стрелките така, че часовникът да показва написания час.' : 'Погледни стрелките и напиши часа.', 'Малката (червена) стрелка показва часа, голямата (синя) — минутите. Свържете часовете с дневния режим на детето: „В 8 часа тръгваме за училище.“', o.variant === 'h' || o.variant === 'hh' ? 'С6.2' : 'С6.3', 'clockIcon'),
      body: (ans) => <>{times.map((t, i) => { const x = X0 + (i % 2) * 362, y = Y0 + 10 + Math.floor(i / 2) * 268
        return <g key={i}>
          {card(x, y, 352, 254, th.color, th.soft)}
          <Clock x={x + 22} y={y + 22} s={210} h={t.h} m={t.m} hands={!draw} />
          {draw && ans && <g opacity={0.95}><Clock x={x + 22} y={y + 22} s={210} h={t.h} m={t.m} color="transparent" digits={false} /></g>}
          <Icon id={t.act[0]} x={x + 252} y={y + 26} s={64} />
          <T x={x + 284} y={y + 112} s={15} w={800} a="middle" fill={th.deep}>{t.act[1]}</T>
          {draw ? <T x={x + 290} y={y + 196} s={36} w={900} a="middle">{fmt(t)}</T> : <g>
            <Box x={x + 242} y={y + 160} w={44} h={50} ans={t.h} show={ans} s={26} />
            <T x={x + 294} y={y + 196} s={30} w={900} a="middle">:</T>
            <Box x={x + 302} y={y + 160} w={44} h={50} ans={String(t.m).padStart(2, '0')} show={ans} s={22} />
          </g>}
        </g> })}</>,
    }
  },
}

// ═══ 10. Пари ═══
const makeChange = (r: Opts['r'], amount: number, set: number[]) => {
  const out: number[] = []; let left = amount
  const desc = set.slice().sort((a, b) => b - a)
  while (left > 0) { const ok = desc.filter(c => c <= left); const c = ok.length > 1 && r.next() < 0.3 ? ok[1] : ok[0]; out.push(c); left -= c }
  return out
}
const money: Gen = {
  id: 'money', title: 'Пари', part: 'math', area: 'Пари', skills: ['С7.1', 'С7.2'], levels: [2, 3],
  ranges: [{ v: 100, label: 'до 1 €' }, { v: 1000, label: 'до 10 €' }, { v: 5000, label: 'до 50 €' }],
  desc: 'Колко пари има? · плати точно',
  make(o) {
    const { theme: th, r } = o
    const set = o.range <= 100 ? [1, 2, 5, 10, 20, 50] : o.range <= 1000 ? [10, 20, 50, 100, 200, 500] : [100, 200, 500, 1000, 2000]
    const amt = () => { const step = o.range <= 100 ? 1 : o.range <= 1000 ? 10 : 100; return Math.max(step * 2, Math.round(r.int(Math.ceil(o.range * 0.08), o.range) / step) * step) }
    const drawMoney = (cs: number[], x: number, y: number, w: number, cs0 = 58) => {
      let cx = x, cy = y
      const nw = cs0 * 1.9
      return cs.slice().sort((a, b) => b - a).map((c, j) => {
        const isNote = c >= 500, iw = isNote ? nw : cs0
        if (cx + iw > x + w) { cx = x; cy += isNote ? nw * 0.56 : cs0 + 6 }
        const el = isNote ? <Note key={j} c={c} x={cx} y={cy + 1} w={nw} /> : <Coin key={j} c={c} x={cx} y={cy} s={cs0} />
        cx += iw + 5
        return el
      })
    }
    if (o.level === 2) {
      const cells = Array.from({ length: 6 }, () => { const a = amt(); return { a, cs: r.shuffle(makeChange(r, a, set)).slice(0, 9) } }).map(c => ({ ...c, a: c.cs.reduce((s, x) => s + x, 0) }))
      return {
        meta: meta(o, 'Колко пари има?', 'Събери парите в портмонето и напиши колко са общо.', 'Първо подредете монетите от най-голямата към най-малката, после събирайте. Ползвайте истински или игрални евро монети. 100 цента = 1 евро.', 'С7.2', 'basket'),
        body: (ans) => <>{cells.map((c, i) => { const x = X0 + (i % 2) * 362, y = Y0 + 10 + Math.floor(i / 2) * 268
          return <g key={i}>{card(x, y, 352, 254, th.color)}
            {drawMoney(c.cs, x + 18, y + 18, 316)}
            <T x={x + 22} y={y + 222} s={20} w={800}>Общо:</T>
            <Box x={x + 100} y={y + 186} w={150} h={52} ans={moneyLabel(c.a)} show={ans} s={26} />
          </g> })}</>,
      }
    }
    const qs = Array.from({ length: 4 }, () => {
      const price = amt(), good = makeChange(r, price, set)
      const bad1 = makeChange(r, price + set[0] * r.int(1, 3), set), bad2 = makeChange(r, Math.max(set[0], price - set[0] * r.int(1, 2)), set)
      const opts = r.shuffle([good, bad1, bad2]); return { price, opts, ok: opts.indexOf(good), ic: r.pick(th.icons) }
    })
    return {
      meta: meta(o, 'Плати точно', 'Колко струва? Огради портмонето, с което плащаш ТОЧНО.', 'Съберете парите във всяко портмоне. Питайте: „Стига ли? Остава ли нещо?“. Следващата стъпка е ресто — листът „Магазинчето“.', 'С7.2', 'basket'),
      body: (ans) => <>{qs.map((q, i) => { const y = Y0 + 8 + i * 202
        return <g key={i}>
          {card(X0, y, 150, 188, th.color, th.soft)}
          <Icon id={q.ic} x={X0 + 30} y={y + 12} s={90} />
          <rect x={X0 + 18} y={y + 116} width={114} height={52} rx={12} fill="#fff" stroke={INK} strokeWidth={2.5} />
          <T x={X0 + 75} y={y + 152} s={26} w={900} a="middle">{moneyLabel(q.price)}</T>
          {q.opts.map((cs, j) => { const x = X0 + 168 + j * 184
            return <g key={j}>{card(x, y, 172, 188, th.color)}{drawMoney(cs.slice(0, 9), x + 10, y + 12, 156, 46)}
              {ans && q.ok === j && <rect x={x - 6} y={y - 6} width={184} height={200} rx={26} fill="none" stroke={ANS} strokeWidth={4} />}</g> })}
        </g> })}</>,
    }
  },
}

// ═══ 11. Магазинчето — текстови задачи ═══
const shop: Gen = {
  id: 'shop', title: 'Магазинчето', part: 'math', area: 'Събиране и изваждане', skills: ['С3.5', 'С7.3', 'Г4.1'], levels: [2, 3],
  ranges: [{ v: 10, label: 'до 10 €' }, { v: 20, label: 'до 20 €' }, { v: 100, label: 'до 100 €' }],
  desc: 'Рафт с цени · колко плащам, колко ресто, стига ли ми',
  make(o) {
    const { theme: th, r } = o
    const items = r.shuffle(th.icons).slice(0, 4).map(id => ({ id, p: r.int(1, Math.max(2, Math.floor(o.range / (o.level === 2 ? 3 : 2)))) }))
    const [a, b, c, d] = items
    const wallet = o.range
    const qs: { q: string; ans: string }[] = [
      { q: `Купуваш ${noun(a.id, 1)} и ${noun(b.id, 1)}. Колко плащаш?`, ans: `${a.p + b.p} €` },
      { q: `Имаш ${wallet} €. Купуваш ${noun(c.id, 1)}. Колко ресто ще ти върнат?`, ans: `${wallet - c.p} €` },
      { q: `Кое е по-скъпо — ${noun(a.id, 1)} или ${noun(d.id, 1)}? С колко?`, ans: a.p === d.p ? 'еднакво' : `${a.p > d.p ? noun(a.id, 1) : noun(d.id, 1)}, с ${Math.abs(a.p - d.p)} €` },
      { q: `Купуваш 2 ${noun(b.id, 2)}. Колко плащаш?`, ans: `${b.p * 2} €` },
      ...(o.level === 3 ? [{ q: `Имаш ${Math.max(2, Math.floor(wallet / 2))} €. Стигат ли ти, за да купиш ${noun(c.id, 1)} и ${noun(d.id, 1)}?`, ans: c.p + d.p <= Math.max(2, Math.floor(wallet / 2)) ? 'Да' : 'Не' }] : []),
    ]
    return {
      meta: meta(o, 'Магазинчето', 'Погледни цените на рафта и реши задачите. Отговори с изречение.', 'Разиграйте задачите с истински предмети и игрални пари: детето е купувач, после продавач. Помогнете да подчертае числата и думата, която казва действието (общо, ресто, с колко).', 'С3.5', 'basket'),
      body: (ans) => <>
        {/* рафт */}
        <rect x={X0} y={Y0 + 10} width={BW} height={210} rx={22} fill={th.soft} stroke={th.color} strokeWidth={2.5} />
        <rect x={X0 + 16} y={Y0 + 168} width={BW - 32} height={14} rx={4} fill="#d6a46b" stroke={INK} strokeWidth={2} />
        {items.map((it, i) => { const x = X0 + 40 + i * 170
          return <g key={i}><Icon id={it.id} x={x + 18} y={Y0 + 34} s={110} />
            <path d={`M${x + 98} ${Y0 + 130} L${x + 150} ${Y0 + 130} L${x + 162} ${Y0 + 150} L${x + 150} ${Y0 + 170} L${x + 98} ${Y0 + 170} Z`} fill="#fff" stroke={INK} strokeWidth={2.4} />
            <circle cx={x + 152} cy={Y0 + 150} r={3.5} fill={INK} />
            <T x={x + 122} y={Y0 + 159} s={22} w={900} a="middle">{it.p} €</T>
            <T x={x + 72} y={Y0 + 208} s={15} w={800} a="middle" fill={th.deep}>{noun(it.id, 1)}</T>
          </g> })}
        {qs.map((q, i) => { const y = Y0 + 250 + i * (o.level === 3 ? 112 : 136)
          return <g key={i}>
            <Num x={X0 + 18} y={y + 12} n={i + 1} color={th.color} />
            <TL x={X0 + 46} y={y + 19} s={21} w={700} lines={wrap(q.q, 58)} />
            <T x={X0 + 46} y={y + 82} s={17} w={700} fill="#64748b">Отговор:</T>
            <Line x={X0 + 130} y={y + 84} w={BW - 140} ans={q.ans} show={ans} />
          </g> })}
      </>,
    }
  },
}

// ═══ 12. Групи — умножение ═══
const groups: Gen = {
  id: 'groups', title: 'Групи — умножение', part: 'math', area: 'Умножение и деление', skills: ['С4.1', 'С4.2', 'С4.3'], levels: [2, 3, 4],
  variants: [{ v: 'mix', label: 'смесено до 5' }, { v: '2', label: 'по 2' }, { v: '5', label: 'по 5' }, { v: '10', label: 'по 10' }, { v: 'all', label: 'цялата таблица' }],
  desc: 'Чинии с равен брой · масиви от точки · таблицата',
  make(o) {
    const { theme: th, r } = o
    const factor = () => (o.variant === 'mix' ? r.int(2, 5) : o.variant === 'all' ? r.int(2, 10) : Number(o.variant))
    if (o.level === 2) {
      const rows = Array.from({ length: 4 }, () => ({ k: r.int(2, 4), n: Math.min(factor(), 6), ic: r.pick(th.icons) }))
      return {
        meta: meta(o, 'Чинии с равен брой', 'Колко са във всяка чиния? Колко са всички? Попълни.', 'Умножението е „събиране на равни групи“. Разпределете истински предмети в чинии и кажете: „3 пъти по 4“. Знакът × се въвежда, когато детето разбира групите.', 'С4.1', rows[0].ic),
        body: (ans) => <>{rows.map((q, i) => { const y = Y0 + 8 + i * 202
          return <g key={i}>
            {card(X0, y, BW, 188, th.color, i % 2 ? '#fff' : th.soft)}
            {Array.from({ length: q.k }, (_, j) => { const cx = X0 + 80 + j * 120, cy = y + 64
              return <g key={j}><ellipse cx={cx} cy={cy} rx={54} ry={46} fill="#fff" stroke={INK} strokeWidth={2.5} /><ellipse cx={cx} cy={cy} rx={40} ry={32} fill="none" stroke="#e2e8f0" strokeWidth={2} />
                {scatter(r, q.n, cx - 40, cy - 34, 80, 68, q.n <= 3 ? 34 : 26).map((p, m) => <Icon key={m} id={q.ic} x={p.x} y={p.y} s={q.n <= 3 ? 34 : 26} />)}</g> })}
            <g>{Array.from({ length: q.k }, (_, j) => <g key={j}>{j > 0 && <T x={X0 + 20 + j * 80 - 18} y={y + 162} s={28} w={900} a="middle">+</T>}<Box x={X0 + 20 + j * 80} y={y + 128} w={44} h={46} ans={q.n} show={ans} s={26} /></g>)}
              <T x={X0 + 20 + q.k * 80 - 18} y={y + 162} s={28} w={900} a="middle">=</T><Box x={X0 + 20 + q.k * 80} y={y + 128} w={60} h={46} ans={q.n * q.k} show={ans} s={26} /></g>
            <T x={X0 + BW - 220} y={y + 162} s={30} w={900}>{q.k} × {q.n} =</T>
            <Box x={X0 + BW - 82} y={y + 128} w={64} h={46} ans={q.n * q.k} show={ans} s={26} />
          </g> })}</>,
      }
    }
    if (o.level === 3) {
      const qs = Array.from({ length: 6 }, () => ({ a: r.int(2, 5), b: Math.min(factor(), 10) }))
      return {
        meta: meta(o, 'Редици от точки', 'Колко реда? По колко във всеки? Напиши умножението.', 'Масивът показва, че 3 × 5 и 5 × 3 са едно и също (завъртете листа!). Помага и за „трудните“ факти: 6 × 7 = 5 × 7 + 7.', 'С4.1'),
        body: (ans) => <>{qs.map((q, i) => { const x = X0 + (i % 2) * 362, y = Y0 + 10 + Math.floor(i / 2) * 268, cell = Math.min(28, 300 / q.b)
          return <g key={i}>{card(x, y, 352, 254, th.color)}
            {Array.from({ length: q.a * q.b }, (_, j) => <circle key={j} cx={x + 26 + (j % q.b) * cell + cell / 2} cy={y + 26 + Math.floor(j / q.b) * cell + cell / 2} r={cell * 0.36} fill={th.color} />)}
            <Box x={x + 26} y={y + 188} w={52} h={46} ans={q.a} show={ans} s={26} /><T x={x + 96} y={y + 222} s={28} w={900} a="middle">×</T>
            <Box x={x + 114} y={y + 188} w={52} h={46} ans={q.b} show={ans} s={26} /><T x={x + 186} y={y + 222} s={28} w={900} a="middle">=</T>
            <Box x={x + 206} y={y + 188} w={68} h={46} ans={q.a * q.b} show={ans} s={26} />
          </g> })}</>,
      }
    }
    const qs = Array.from({ length: 20 }, () => { const a = factor(), b = r.int(1, 10); return r.next() < 0.5 ? { a, b } : { a: b, b: a } })
    return {
      meta: meta(o, 'Таблицата за умножение', 'Реши задачите. Засечи колко време ти отне.', 'Работете на малки порции (по една редица от таблицата). Повторете листа след няколко дни и сравнете времето.', o.variant === 'all' ? 'С4.3' : 'С4.2'),
      body: (ans) => <>
        <g><Icon id="clockIcon" x={X0 + BW - 190} y={Y0 + 2} s={44} /><T x={X0 + BW - 140} y={Y0 + 32} s={18} w={800}>Време:</T><Line x={X0 + BW - 74} y={Y0 + 34} w={70} /></g>
        {qs.map((q, i) => { const x = X0 + (i % 2) * 362 + 20, y = Y0 + 60 + Math.floor(i / 2) * 74
          return <g key={i}><T x={x} y={y + 44} s={36} w={800}>{q.a} × {q.b} =</T><Box x={x + 200} y={y + 4} w={84} h={54} ans={q.a * q.b} show={ans} /></g> })}
      </>,
    }
  },
}

// ═══ 13. Раздели поравно ═══
const share: Gen = {
  id: 'share', title: 'Раздели поравно', part: 'math', area: 'Умножение и деление', skills: ['С4.4'], levels: [2, 3],
  desc: 'Разпредели в чинии · деление като обратно на умножението',
  make(o) {
    const { theme: th, r } = o
    const qs = Array.from({ length: 3 }, () => { const k = r.int(2, 4), n = r.int(2, o.level === 2 ? 4 : 6); return { k, n, N: k * n, ic: r.pick(th.icons) } })
    return {
      meta: meta(o, 'Раздели поравно', 'Раздели рисунките поравно в чиниите — нарисувай ги или ги свържи. Колко има във всяка?', 'Раздава се „по едно във всяка чиния, после пак“ — като раздаване на карти. Накрая проверете с умножение: 3 чинии по 4 = 12.', 'С4.4', qs[0].ic),
      body: (ans) => <>{qs.map((q, i) => { const y = Y0 + 8 + i * 270
        return <g key={i}>
          {card(X0, y, BW, 256, th.color, i % 2 ? '#fff' : th.soft)}
          <Num x={X0 + 24} y={y + 26} n={i + 1} color={th.color} />
          <T x={X0 + 48} y={y + 34} s={20} w={800}>Раздели {q.N} {noun(q.ic, q.N)} в {q.k} чинии.</T>
          {rows5(q.N, X0 + 40, y + 52, 32, 6, 12).map((p, j) => <Icon key={j} id={q.ic} x={p.x} y={p.y} s={32} />)}
          {Array.from({ length: q.k }, (_, j) => { const step = q.k === 4 ? 132 : 150, rx = q.k === 4 ? 58 : 64, cx = X0 + 84 + j * step, cy = y + 178
            return <g key={j}><ellipse cx={cx} cy={cy} rx={rx} ry={48} fill="#fff" stroke={INK} strokeWidth={2.5} /><ellipse cx={cx} cy={cy} rx={rx - 16} ry={34} fill="none" stroke="#e2e8f0" strokeWidth={2} />
              {ans && rows5(q.n, cx - 42, cy - 22, 22, 4, 3).map((p, m) => <circle key={m} cx={p.x + 11} cy={p.y + 11} r={9} fill={ANS} />)}</g> })}
          <T x={X0 + BW - 56} y={y + 140} s={16} w={800} a="middle">Във всяка:</T>
          <Box x={X0 + BW - 92} y={y + 152} w={72} h={56} ans={q.n} show={ans} />
        </g> })}</>,
    }
  },
}

export const MATH_GENS: Gen[] = [count, match, compare, tenframe, train, eqGen('add'), eqGen('sub'), tens, clock, money, shop, groups, share]
export type { ReactNode }
