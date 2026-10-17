// Листовете за социални умения: чувства, „подреди по ред“, моят ден, карта за безопасност, ролеви карти.
import type { ReactNode } from 'react'
import { BODY, INK, ANS, T, TL, Box, Line, Num, wrap } from './core'
import { Icon, Face, EMOTIONS, type Emotion } from './icons'
import { LEVEL_LABEL, type Gen, type Opts } from './types'

const { x: X0, y: Y0, w: BW } = BODY
const S = { stroke: INK, strokeWidth: 3.5, strokeLinejoin: 'round' as const, strokeLinecap: 'round' as const }
const meta = (o: Opts, title: string, instr: string, tip: string, code: string, icon?: string) => ({ title, instr, tip, code, levelLabel: LEVEL_LABEL[o.level], icon })
const card = (x: number, y: number, w: number, h: number, color: string, fill = '#fff', dash = false) =>
  <rect x={x} y={y} width={w} height={h} rx={20} fill={fill} stroke={color} strokeWidth={2.5} strokeDasharray={dash ? '9 7' : undefined} />
const Scissors = ({ x, y }: { x: number; y: number }) => <g transform={`translate(${x} ${y})`}>
  <circle cx={6} cy={6} r={5} fill="none" stroke={INK} strokeWidth={2} /><circle cx={6} cy={20} r={5} fill="none" stroke={INK} strokeWidth={2} />
  <path d="M10 9 L28 18 M10 17 L28 8" stroke={INK} strokeWidth={2} strokeLinecap="round" />
</g>

// ── пиктограми за последователностите (кутия 100 × 100) ──
const skin = '#fcd9b6'
const Hands = ({ bubbles }: { bubbles?: boolean }) => <>
  <path d="M22 88 L22 52 C22 44 30 40 36 44 L48 56 L48 34 C48 28 56 28 56 34 L56 60 C56 76 48 88 40 88 Z" fill={skin} {...S} />
  <path d="M78 88 L78 52 C78 44 70 40 64 44 L52 56" fill={skin} {...S} />
  <path d="M78 88 L60 88 C54 82 52 72 52 60 L52 34" fill="none" {...S} />
  {bubbles && <>{[[30, 30, 8], [66, 26, 7], [44, 18, 6], [80, 40, 5], [20, 46, 5]].map(([x, y, r], i) => <circle key={i} cx={x} cy={y} r={r} fill="#e0f2fe" stroke="#38bdf8" strokeWidth={2} />)}</>}
</>
const PICTO: Record<string, () => ReactNode> = {
  tap: () => <>
    <rect x={14} y={14} width={44} height={16} rx={6} fill="#cbd5e1" {...S} />
    <path d="M50 22 L70 22 C78 22 82 28 82 36 L82 44 L70 44 L70 36 L50 36 Z" fill="#cbd5e1" {...S} />
    <rect x={30} y={6} width={12} height={10} rx={3} fill="#38bdf8" {...S} strokeWidth={2.6} />
    {[[76, 56], [70, 70], [80, 82], [74, 94]].map(([x, y], i) => <path key={i} d={`M${x} ${y - 8} C${x - 5} ${y - 1} ${x - 5} ${y + 4} ${x} ${y + 4} C${x + 5} ${y + 4} ${x + 5} ${y - 1} ${x} ${y - 8} Z`} fill="#38bdf8" stroke="#0284c7" strokeWidth={1.6} />)}
  </>,
  soap: () => <>
    <rect x={18} y={48} width={64} height={34} rx={14} fill="#f9a8d4" {...S} />
    <path d="M30 60 C36 56 44 56 50 60" stroke="#fff" strokeWidth={4} fill="none" strokeLinecap="round" />
    {[[30, 30, 9], [52, 22, 11], [72, 32, 8], [62, 12, 5]].map(([x, y, r], i) => <circle key={i} cx={x} cy={y} r={r} fill="#e0f2fe" stroke="#38bdf8" strokeWidth={2} />)}
  </>,
  rub: () => <Hands bubbles />,
  rinse: () => <>
    <path d="M44 4 L44 30 M50 4 L50 34 M56 4 L56 30" stroke="#38bdf8" strokeWidth={4} strokeLinecap="round" />
    <g transform="translate(0 8)"><Hands /></g>
  </>,
  towel: () => <>
    <rect x={14} y={12} width={50} height={66} rx={6} fill="#86efac" {...S} />
    <path d="M14 26 L64 26 M14 64 L64 64" stroke="#16a34a" strokeWidth={4} />
    <path d="M56 90 L56 62 C56 56 62 54 66 58 L74 66 L74 48 C74 42 82 42 82 48 L82 72 C82 82 76 90 70 90 Z" fill={skin} {...S} />
  </>,
  stop: () => <>
    <circle cx={50} cy={50} r={44} fill="#fee2e2" stroke="#dc2626" strokeWidth={6} />
    <g transform="translate(18 14) scale(0.64)"><Icon id="hand" x={0} y={0} s={100} /></g>
  </>,
  light: () => <>
    <rect x={30} y={4} width={40} height={84} rx={12} fill="#334155" {...S} />
    <circle cx={50} cy={22} r={10} fill="#7f1d1d" /><circle cx={50} cy={46} r={10} fill="#78350f" /><circle cx={50} cy={70} r={10} fill="#22c55e" stroke="#bbf7d0" strokeWidth={3} />
    <rect x={46} y={88} width={8} height={10} fill="#334155" />
  </>,
  look: () => <>
    <ellipse cx={34} cy={50} rx={16} ry={20} fill="#fff" {...S} /><ellipse cx={66} cy={50} rx={16} ry={20} fill="#fff" {...S} />
    <circle cx={28} cy={52} r={7} fill={INK} /><circle cx={60} cy={52} r={7} fill={INK} />
    <path d="M14 86 L4 86 M4 86 L12 80 M4 86 L12 92" {...S} fill="none" stroke="#2563eb" />
    <path d="M86 86 L96 86 M96 86 L88 80 M96 86 L88 92" {...S} fill="none" stroke="#2563eb" />
    <path d="M18 18 C26 12 40 12 46 18 M54 18 C60 12 74 12 82 18" fill="none" {...S} />
  </>,
  zebra: () => <>
    <rect x={4} y={10} width={92} height={80} rx={6} fill="#64748b" />
    {[16, 32, 48, 64, 80].map(y => <rect key={y} x={14} y={y} width={72} height={8} rx={2} fill="#fff" />)}
    <path d="M40 76 C34 70 36 58 42 58 C48 58 48 70 44 76 Z M58 46 C52 40 54 28 60 28 C66 28 66 40 62 46 Z" fill="#f59e0b" stroke={INK} strokeWidth={2} />
  </>,
  shirt: () => <>
    <path d="M34 12 L18 22 L8 42 L22 50 L28 40 L28 88 L72 88 L72 40 L78 50 L92 42 L82 22 L66 12 C62 20 38 20 34 12 Z" fill="#60a5fa" {...S} />
    <path d="M40 14 C44 22 56 22 60 14" fill="none" {...S} strokeWidth={2.6} />
  </>,
  list: () => <>
    <rect x={20} y={8} width={60} height={84} rx={6} fill="#fff" {...S} />
    {[28, 46, 64].map(y => <g key={y}><rect x={30} y={y - 6} width={10} height={10} rx={2} fill="none" stroke={INK} strokeWidth={2.4} /><line x1={46} y1={y} x2={70} y2={y} stroke="#94a3b8" strokeWidth={3} strokeLinecap="round" /></g>)}
    <path d="M31 25 L35 29 L41 20" fill="none" stroke="#16a34a" strokeWidth={3} strokeLinecap="round" />
  </>,
  pay: () => <>
    <rect x={10} y={30} width={60} height={42} rx={8} fill="#a16207" {...S} />
    <rect x={44} y={42} width={30} height={18} rx={6} fill="#ca8a04" {...S} />
    <circle cx={74} cy={28} r={14} fill="#e3b23c" {...S} /><text x={74} y={34} fontSize={16} fontWeight={900} textAnchor="middle" fill={INK}>€</text>
  </>,
  thanks: () => <>
    <path d="M14 18 L86 18 C90 18 92 20 92 24 L92 60 C92 64 90 66 86 66 L40 66 L24 82 L26 66 L14 66 C10 66 8 64 8 60 L8 24 C8 20 10 18 14 18 Z" fill="#fef9c3" {...S} />
    <g transform="translate(32 22) scale(0.36)"><path d="M50 86 C20 66 8 48 12 32 C16 16 38 12 50 30 C62 12 84 16 88 32 C92 48 80 66 50 86 Z" fill="#f43f5e" {...S} /></g>
  </>,
}
const Picto = ({ id, x, y, s }: { id: string; x: number; y: number; s: number }) => {
  const f = PICTO[id]
  return <g transform={`translate(${x} ${y}) scale(${s / 100})`}>{f ? f() : <Icon id={id} x={0} y={0} s={100} />}</g>
}

// ═══ Чувства ═══
const SITUATIONS: [string, Emotion][] = [
  ['Получаваш подарък за рождения си ден.', 'happy'], ['Любимата ти играчка се счупи.', 'sad'], ['Някой взема молива ти, без да пита.', 'angry'],
  ['Голямо куче лае силно до теб.', 'scared'], ['Отваряш вратата и всички викат „Изненада!“.', 'surprised'], ['Слушаш тиха музика, сгушен в одеяло.', 'calm'],
  ['Изгубваш се в магазина.', 'scared'], ['Приятел те кани да играете заедно.', 'happy'], ['Не те взимат в играта.', 'sad'], ['Някой те блъска на опашката.', 'angry'],
]
const feelings: Gen = {
  id: 'feelings', title: 'Чувства', part: 'social', area: 'Общуване', skills: ['Г2.5', 'Г3.3'], levels: [2, 3],
  desc: 'Назови чувството на лицето · какво чувства детето в ситуацията',
  make(o) {
    const { theme: th, r } = o
    if (o.level === 2) {
      const faces = r.shuffle(EMOTIONS), words = r.shuffle(EMOTIONS.map(e => e.label))
      return {
        meta: meta(o, 'Как се чувства?', 'Разгледай лицата. Напиши под всяко коя дума му подхожда.', 'Покажете лицето в огледало заедно: „Как изглеждаш, когато си тъжен?“. Свържете чувството със случка от деня на детето. За нечетящи — изрежете думите и ги залепете.', 'Г2.5', 'heart'),
        body: (ans) => <>
          {faces.map((f, i) => { const x = X0 + (i % 3) * 242, y = Y0 + 8 + Math.floor(i / 3) * 262
            return <g key={f.id}>{card(x, y, 230, 248, th.color, th.soft)}<Face e={f.id} x={x + 40} y={y + 18} s={150} />
              <Line x={x + 24} y={y + 222} w={182} ans={f.label} show={ans} /></g> })}
          <rect x={X0} y={Y0 + 548} width={BW} height={86} rx={20} fill="#fff" stroke={th.color} strokeWidth={2.5} strokeDasharray="9 7" />
          <Scissors x={X0 + 10} y={Y0 + 534} />
          {words.map((w, i) => <g key={w}><rect x={X0 + 18 + i * 116} y={Y0 + 568} width={106} height={46} rx={12} fill={th.soft} stroke={INK} strokeWidth={2} /><T x={X0 + 71 + i * 116} y={Y0 + 598} s={w.length > 9 ? 13 : w.length > 8 ? 15 : 19} w={800} a="middle">{w}</T></g>)}
          <T x={X0} y={Y0 + 678} s={21} w={800} fill={th.deep}>Как се чувствам днес? Огради лицето.</T>
          {EMOTIONS.map((e, i) => <Face key={e.id} e={e.id} x={X0 + 10 + i * 118} y={Y0 + 698} s={92} />)}
        </>,
      }
    }
    const qs = r.shuffle(SITUATIONS).slice(0, 4).map(([t, e]) => ({ t, e, opts: r.shuffle([e, ...r.shuffle(EMOTIONS.map(x => x.id).filter(x => x !== e)).slice(0, 2)]) }))
    return {
      meta: meta(o, 'Какво чувства?', 'Прочети какво се случва. Огради лицето, което показва как се чувства детето.', 'Обсъдете: „Защо се чувства така? Какво може да направи?“. Няма „лоши“ чувства — важно е какво правим с тях. Отметнете заедно стратегиите долу.', 'Г2.5', 'heart'),
      body: (ans) => <>
        {qs.map((q, i) => { const y = Y0 + 6 + i * 150
          return <g key={i}>{card(X0, y, BW, 138, th.color, i % 2 ? '#fff' : th.soft)}
            <Num x={X0 + 26} y={y + 30} n={i + 1} color={th.color} />
            <TL x={X0 + 52} y={y + 38} s={20} w={700} lines={wrap(q.t, 25)} />
            {q.opts.map((e, j) => { const fx = X0 + BW - 342 + j * 112; return <g key={j}><Face e={e} x={fx} y={y + 18} s={100} />{ans && e === q.e && <circle cx={fx + 50} cy={y + 68} r={56} fill="none" stroke={ANS} strokeWidth={4} />}</g> })}
          </g> })}
        <rect x={X0} y={Y0 + 616} width={BW} height={190} rx={20} fill={th.soft} stroke={th.color} strokeWidth={2.5} />
        <T x={X0 + 22} y={Y0 + 650} s={20} w={800} fill={th.deep}>Когато съм ядосан или тъжен, мога да:</T>
        {['дишам дълбоко 5 пъти', 'преброя бавно до 10', 'кажа на учителя', 'стисна мека топка', 'отида на тихо място', 'кажа с думи какво чувствам'].map((t, i) => { const x = X0 + 26 + (i % 2) * 350, y = Y0 + 674 + Math.floor(i / 2) * 42
          return <g key={i}><rect x={x} y={y} width={26} height={26} rx={6} fill="#fff" stroke={INK} strokeWidth={2.2} /><T x={x + 38} y={y + 21} s={18} w={600}>{t}</T></g> })}
      </>,
    }
  },
}

// ═══ Подреди по ред ═══
const SEQS: Record<string, { title: string; code: string; steps: [string, string][]; tip: string }> = {
  wash: { title: 'Мия ръцете', code: 'Г1.1', steps: [['tap', 'Пускам водата'], ['soap', 'Слагам сапун'], ['rub', 'Търкам ръцете'], ['rinse', 'Изплаквам'], ['towel', 'Подсушавам']], tip: 'Залепете готовата редица над мивката. Търкането трае колкото една песничка (около 20 секунди).' },
  street: { title: 'Пресичам улицата', code: 'Г4.2', steps: [['stop', 'Спирам на тротоара'], ['light', 'Чакам зелено'], ['look', 'Поглеждам наляво и надясно'], ['zebra', 'Пресичам по пътеката']], tip: 'Упражнявайте първо в двора с начертана „пътека“, после на истинско кръстовище с възрастен. Повтаряйте стъпките на глас.' },
  morning: { title: 'Сутрин', code: 'Г5.2', steps: [['sun', 'Ставам'], ['toothbrush', 'Мия зъбите'], ['shirt', 'Обличам се'], ['bowl', 'Закусвам'], ['backpack', 'Тръгвам']], tip: 'Направете същата редица за вкъщи — родителят отбелязва всяка стъпка. Детето показва коя стъпка е следващата.' },
  shop: { title: 'Пазарувам', code: 'Г4.1', steps: [['list', 'Правя списък'], ['basket', 'Избирам'], ['pay', 'Плащам'], ['thanks', 'Казвам „Благодаря“']], tip: 'Свържете с истинско пазаруване: списък с картинки, малък бюджет, учтив разговор с продавача.' },
}
const steps: Gen = {
  id: 'steps', title: 'Подреди по ред', part: 'social', area: 'Ежедневие', skills: ['Г1.1', 'Г4.1', 'Г4.2', 'Г5.1', 'Г5.2'], levels: [2, 3],
  variants: Object.entries(SEQS).map(([v, s]) => ({ v, label: s.title })),
  desc: 'Изрежи и подреди стъпките · номерирай по ред',
  make(o) {
    const { theme: th, r } = o
    const sq = SEQS[o.variant] || SEQS.wash
    const n = sq.steps.length
    const order = r.shuffle(sq.steps.map((_, i) => i))
    const cw = (BW - (n - 1) * 14) / n
    if (o.level === 2) return {
      meta: meta(o, `${sq.title} — по ред`, 'Изрежи картинките долу и ги залепи по ред в квадратчетата.', sq.tip, sq.code, undefined),
      body: (ans) => <>
        {sq.steps.map((_, i) => { const x = X0 + i * (cw + 14)
          return <g key={i}>{card(x, Y0 + 10, cw, cw + 40, th.color, th.soft)}<Num x={x + 22} y={Y0 + 34} n={i + 1} color={th.color} />
            {ans && <><Picto id={sq.steps[i][0]} x={x + cw * 0.18} y={Y0 + 40} s={cw * 0.64} /></>}
            {i < n - 1 && <path d={`M${x + cw + 2} ${Y0 + 10 + (cw + 40) / 2} l10 0 m-5 -5 l5 5 l-5 5`} stroke={th.color} strokeWidth={3} fill="none" strokeLinecap="round" />}</g> })}
        <T x={X0} y={Y0 + cw + 110} s={20} w={800} fill={th.deep}>Разкажи: какво правиш първо, после, накрая?</T>
        {[0, 1].map(k => <Line key={k} x={X0} y={Y0 + cw + 160 + k * 48} w={BW} />)}
        <Scissors x={X0 - 4} y={Y0 + 452} />
        <line x1={X0 + 30} y1={Y0 + 465} x2={X0 + BW} y2={Y0 + 465} stroke="#94a3b8" strokeWidth={2} strokeDasharray="9 7" />
        {order.map((si, i) => { const x = X0 + i * (cw + 14), y = Y0 + 490
          return <g key={i}>{card(x, y, cw, cw + 70, INK, '#fff', true)}
            <Picto id={sq.steps[si][0]} x={x + cw * 0.15} y={y + 14} s={cw * 0.7} />
            <TL x={x + cw / 2} y={y + cw * 0.7 + 42} s={15} w={800} a="middle" lines={wrap(sq.steps[si][1], 14)} />
            {ans && <T x={x + cw - 18} y={y + 28} s={22} w={900} fill={ANS} a="middle">{si + 1}</T>}</g> })}
      </>,
    }
    return {
      meta: meta(o, `${sq.title} — по ред`, 'Напиши в квадратчето коя поред е всяка стъпка. После напиши изречение.', sq.tip, sq.code),
      body: (ans) => <>
        {order.map((si, i) => { const x = X0 + (i % 2) * 362, y = Y0 + 10 + Math.floor(i / 2) * 230
          return <g key={i}>{card(x, y, 352, 216, th.color, i % 2 ? '#fff' : th.soft)}
            <Picto id={sq.steps[si][0]} x={x + 20} y={y + 20} s={150} />
            <TL x={x + 186} y={y + 70} s={19} w={800} lines={wrap(sq.steps[si][1], 15)} />
            <Box x={x + 272} y={y + 136} w={60} h={60} ans={si + 1} show={ans} />
          </g> })}
        <T x={X0} y={Y0 + 10 + Math.ceil(n / 2) * 230 + 30} s={20} w={800} fill={th.deep}>Първо …, после …, накрая …</T>
        {[0, 1].map(k => <Line key={k} x={X0} y={Y0 + 10 + Math.ceil(n / 2) * 230 + 80 + k * 48} w={BW} />)}
      </>,
    }
  },
}

// ═══ Моят ден ═══
const DAY: [string, string][] = [['sun', 'Ставам'], ['toothbrush', 'Мия зъбите'], ['bowl', 'Закусвам'], ['backpack', 'Тръгвам за училище'], ['bowl', 'Обядвам'], ['ball', 'Играя'], ['house', 'Прибирам се'], ['bed', 'Лягам да спя']]
const dayplan: Gen = {
  id: 'dayplan', title: 'Моят ден', part: 'social', area: 'Ежедневие', skills: ['Г5.1', 'С6.1'], levels: [2, 3],
  desc: 'Дневен режим с картинки, час и отметка',
  make(o) {
    const { theme: th } = o
    const rowH = 96
    return {
      meta: meta(o, 'Моят ден', o.level === 2 ? 'Какво правя през деня? Отбележи, когато го направиш.' : 'Напиши в колко часа правиш всяко нещо. Отбележи, когато го направиш.', 'Попълнете часовете заедно с детето и семейството. Листът може да виси в стаята; отметката след всяко действие дава сигурност и самостоятелност.', o.level === 2 ? 'Г5.1' : 'С6.1', 'sun'),
      body: () => <>
        <g><T x={X0 + 26} y={Y0 + 20} s={15} w={800} fill="#64748b">ЧАС</T><T x={X0 + 170} y={Y0 + 20} s={15} w={800} fill="#64748b">КАКВО ПРАВЯ</T><T x={X0 + BW - 30} y={Y0 + 20} s={15} w={800} fill="#64748b" a="middle">✓</T></g>
        {DAY.map(([ic, t], i) => { const y = Y0 + 32 + i * rowH
          return <g key={i}>{card(X0, y, BW, rowH - 10, th.color, i % 2 ? '#fff' : th.soft)}
            {o.level === 2 ? <Icon id="clockIcon" x={X0 + 20} y={y + 12} s={62} /> : <Line x={X0 + 18} y={y + 58} w={100} />}
            <Icon id={ic} x={X0 + 150} y={y + 8} s={70} />
            <T x={X0 + 240} y={y + 54} s={24} w={800}>{t}</T>
            <rect x={X0 + BW - 54} y={y + 20} width={46} height={46} rx={10} fill="#fff" stroke={INK} strokeWidth={2.5} />
          </g> })}
      </>,
    }
  },
}

// ═══ Моята карта за безопасност ═══
const sos: Gen = {
  id: 'sos', title: 'Карта за безопасност', part: 'social', area: 'Самостоятелност навън', skills: ['Г4.4', 'Г4.3'], levels: [2, 3],
  desc: 'Карта за раницата: име, адрес, телефон · кога звъня на 112',
  make(o) {
    const { theme: th, r } = o
    const qs = r.shuffle([['Има пожар.', true], ['Някой е паднал и не може да стане.', true], ['Видях катастрофа.', true], ['Скучно ми е.', false], ['Изгубих си химикалката.', false], ['Искам да чуя приятел.', false]] as [string, boolean][])
    const sosCard = (x: number, y: number) => <g>
      {card(x, y, 342, 230, INK, '#fff', true)}
      <rect x={x + 10} y={y + 10} width={322} height={40} rx={12} fill={th.color} />
      <T x={x + 22} y={y + 38} s={19} w={900} fill="#fff">АКО СЕ ЗАГУБЯ</T>
      <g><rect x={x + 248} y={y + 16} width={76} height={28} rx={14} fill="#fff" /><T x={x + 286} y={y + 37} s={20} w={900} fill="#dc2626" a="middle">112</T></g>
      {['Казвам се', 'Живея на', 'Телефон на мама/татко'].map((l, i) => <g key={i}><T x={x + 18} y={y + 84 + i * 52} s={14} w={700} fill="#64748b">{l}:</T><Line x={x + 18} y={y + 112 + i * 52} w={304} /></g>)}
    </g>
    return {
      meta: meta(o, 'Моята карта за безопасност', 'Попълни картичката с възрастен, изрежи я и я сложи в раницата. Отговори на въпросите.', 'Упражнявайте да казва на глас името, адреса и телефона. Разиграйте „Изгубих се“ — към кого се обръщам (полицай, продавач, майка с деца).', 'Г4.4', 'phone'),
      body: (ans) => <>
        <Scissors x={X0 - 4} y={Y0 - 4} />
        {sosCard(X0, Y0 + 10)}{sosCard(X0 + 372, Y0 + 10)}
        <rect x={X0} y={Y0 + 268} width={BW} height={110} rx={20} fill={th.soft} stroke={th.color} strokeWidth={2.5} />
        <T x={X0 + 22} y={Y0 + 300} s={19} w={800} fill={th.deep}>Моят телефон (научи го наизуст):</T>
        {Array.from({ length: 10 }, (_, i) => <rect key={i} x={X0 + 22 + i * 62 + (i > 3 ? 12 : 0)} y={Y0 + 314} width={52} height={50} rx={10} fill="#fff" stroke={INK} strokeWidth={2.2} />)}
        <g><Icon id="phone" x={X0 + 2} y={Y0 + 398} s={70} /><T x={X0 + 80} y={Y0 + 440} s={22} w={900} fill="#dc2626">Кога звъня на 112?</T><T x={X0 + 80} y={Y0 + 466} s={16} w={600} fill="#64748b">Огради „Да“ или „Не“.</T></g>
        {qs.map(([q, a], i) => { const y = Y0 + 490 + i * 54
          return <g key={i}><Num x={X0 + 18} y={y + 20} n={i + 1} color={th.color} /><T x={X0 + 46} y={y + 28} s={20} w={700}>{q}</T>
            {(['Да', 'Не'] as const).map((l, j) => { const cx = X0 + BW - 140 + j * 84; return <g key={l}><rect x={cx - 32} y={y} width={64} height={38} rx={19} fill={j ? '#fee2e2' : '#dcfce7'} stroke={INK} strokeWidth={2} /><T x={cx} y={y + 26} s={18} w={800} a="middle">{l}</T>
              {ans && (j === 0) === a && <rect x={cx - 38} y={y - 6} width={76} height={50} rx={25} fill="none" stroke={ANS} strokeWidth={4} />}</g> })}</g> })}
      </>,
    }
  },
}

// ═══ Ролеви карти ═══
const ROLES: Record<string, { title: string; code: string; cards: [string, string, string][] }> = {
  talk: { title: 'Общуване', code: 'Г2.1', cards: [
    ['sun', 'Сутрин в класа', 'Погледни човека и кажи: „Добро утро!“'], ['hand', 'Нов приятел', 'Кажи: „Здравей! Казвам се … А ти?“'],
    ['hand', 'Имам нужда от помощ', 'Вдигни ръка и попитай: „Може ли да ми помогнете?“'], ['clockIcon', 'Някой говори', 'Изчакай да свърши. Брои наум до 5, после говори.'],
    ['heart', 'Дадоха ми нещо', 'Кажи: „Благодаря!“ и се усмихни.'], ['ball', 'Блъснах някого', 'Спри и кажи: „Извинявай! Добре ли си?“']] },
  shop: { title: 'В магазина', code: 'Г4.1', cards: [
    ['house', 'Влизам в магазина', 'Поздрави продавача: „Добър ден!“'], ['basket', 'Не намирам нещо', 'Попитай: „Извинете, къде има мляко?“'],
    ['basket', 'Искам да знам цената', 'Попитай: „Колко струва това?“'], ['clockIcon', 'На касата', 'Застани на опашката и изчакай реда си.'],
    ['basket', 'Плащам', 'Дай парите и изчакай рестото и бележката.'], ['heart', 'Тръгвам си', 'Кажи: „Благодаря, довиждане!“']] },
  rules: { title: 'Правила и несъгласие', code: 'Г3.3', cards: [
    ['ball', 'Приятел не иска да играе', 'Кажи: „Добре, ще играем после.“ и си избери друга игра.'], ['hand', 'Карат ме да правя нещо, което не искам', 'Кажи ясно: „Не, благодаря.“ и се отдалечи.'],
    ['gift', 'Искаме една и съща играчка', 'Предложи: „Ти първи, после аз.“'], ['star', 'Загубих в игра', 'Кажи: „Браво! Хайде пак.“'],
    ['heart', 'Някой ме дразни', 'Отиди при учителя и кажи какво се случва.'], ['clockIcon', 'Учителят казва „Стоп“', 'Спри, погледни учителя и слушай.']] },
  bus: { title: 'В автобуса', code: 'Г4.3', cards: [
    ['bus', 'На спирката', 'Чакай автобуса зад линията, не тичай към него.'], ['bus', 'Качвам се', 'Покажи картата или билета на шофьора.'],
    ['hand', 'Пътувам', 'Седни или се хвани здраво за дръжката.'], ['bus', 'Наближава моята спирка', 'Натисни бутона и иди до вратата.'],
    ['phone', 'Обърках се', 'Попитай шофьора или се обади на мама/татко.'], ['house', 'Слязох', 'Изчакай автобусът да тръгне, после пресечи на пътеката.']] },
}
const roles: Gen = {
  id: 'roles', title: 'Ролеви карти', part: 'social', area: 'Общуване', skills: ['Г2.1', 'Г2.2', 'Г2.3', 'Г2.4', 'Г3.1', 'Г3.2', 'Г3.3', 'Г4.1', 'Г4.3'], levels: [2, 3],
  variants: Object.entries(ROLES).map(([v, s]) => ({ v, label: s.title })),
  desc: 'Карти за разиграване на ситуации — общуване, магазин, несъгласие, автобус',
  make(o) {
    const { theme: th } = o
    const set = ROLES[o.variant] || ROLES.talk
    return {
      meta: meta(o, `Ролеви карти: ${set.title.toLowerCase()}`, 'Изрежете картите. Изтегли карта и разиграй ситуацията с учителя или с приятел.', 'Първо учителят показва как, после детето играе ролята, накрая сменете ролите. Хвалете конкретно: „Браво, погледна го в очите!“. Пренесете в истинска ситуация същия ден.', set.code, 'hand'),
      body: () => <>
        <Scissors x={X0 - 4} y={Y0 - 4} />
        {set.cards.map(([ic, title, say], i) => { const x = X0 + (i % 2) * 362, y = Y0 + 10 + Math.floor(i / 2) * 270, w = 352, h = 256
          return <g key={i}>{card(x, y, w, h, INK, '#fff', true)}
            <rect x={x + 10} y={y + 10} width={w - 20} height={86} rx={14} fill={th.soft} />
            <Icon id={ic} x={x + 20} y={y + 16} s={74} />
            <TL x={x + 106} y={y + 46} s={19} w={900} fill={th.deep} lines={wrap(title, 20)} />
            {/* балонче с репликата */}
            <path d={`M${x + 24} ${y + 112} L${x + w - 24} ${y + 112} Q${x + w - 14} ${y + 112} ${x + w - 14} ${y + 122} L${x + w - 14} ${y + 216} Q${x + w - 14} ${y + 226} ${x + w - 24} ${y + 226} L${x + 70} ${y + 226} L${x + 46} ${y + 246} L${x + 50} ${y + 226} L${x + 24} ${y + 226} Q${x + 14} ${y + 226} ${x + 14} ${y + 216} L${x + 14} ${y + 122} Q${x + 14} ${y + 112} ${x + 24} ${y + 112} Z`} fill="#fff" stroke={th.color} strokeWidth={2.5} />
            <TL x={x + w / 2} y={y + 150} s={18} w={700} a="middle" lines={wrap(say, 30)} />
          </g> })}
      </>,
    }
  },
}

export const SOCIAL_GENS: Gen[] = [feelings, steps, dayplan, sos, roles]
