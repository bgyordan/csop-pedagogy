// Рисунките за работните листове — наши, плоски, с мек контур (в кутия 100 × 100).
// Без герои и марки; еднакъв стил, за да изглеждат листовете като една поредица.
import type { ReactNode } from 'react'
import { INK, FONT } from './core'

const S = { stroke: INK, strokeWidth: 3.5, strokeLinejoin: 'round' as const, strokeLinecap: 'round' as const }
const hl = (d: string) => <path d={d} fill="none" stroke="#fff" strokeWidth={4} strokeLinecap="round" opacity={0.75} />

const ICONS: Record<string, () => ReactNode> = {
  // ── есен ──
  apple: () => <>
    <path d="M50 30 C38 21 17 25 17 50 C17 73 34 89 44 87 C47 86 53 86 56 87 C66 89 83 73 83 50 C83 25 62 21 50 30 Z" fill="#ef4444" {...S} />
    <path d="M50 30 C50 22 52 16 57 11" fill="none" {...S} />
    <path d="M54 22 C61 11 73 11 78 15 C72 24 61 27 54 22 Z" fill="#4ade80" {...S} />
    {hl('M29 46 C29 39 33 35 38 34')}
  </>,
  pear: () => <>
    <path d="M50 19 C42 19 40 29 40 37 C40 45 25 53 25 69 C25 83 37 91 50 91 C63 91 75 83 75 69 C75 53 60 45 60 37 C60 29 58 19 50 19 Z" fill="#bef264" {...S} />
    <path d="M50 19 C50 13 51 9 54 6" fill="none" {...S} />
    <path d="M53 14 C59 6 69 6 73 9 C68 16 59 18 53 14 Z" fill="#4ade80" {...S} />
    {hl('M34 66 C34 60 37 56 41 54')}
  </>,
  leaf: () => <>
    <path d="M50 10 C73 22 86 44 77 66 C71 80 59 86 50 88 C41 86 29 80 23 66 C14 44 27 22 50 10 Z" fill="#fb923c" {...S} />
    <path d="M50 22 L50 96 M50 44 L35 34 M50 44 L65 34 M50 62 L32 52 M50 62 L68 52 M50 78 L38 70 M50 78 L62 70" fill="none" {...S} strokeWidth={2.6} />
  </>,
  acorn: () => <>
    <path d="M31 46 C31 67 40 84 50 89 C60 84 69 67 69 46 Z" fill="#f59e0b" {...S} />
    <path d="M22 46 C22 31 35 22 50 22 C65 22 78 31 78 46 Z" fill="#92400e" {...S} />
    <path d="M32 30 L44 44 M44 25 L58 43 M58 25 L70 40 M30 40 L36 46" stroke="#b45309" strokeWidth={2.4} strokeLinecap="round" />
    <path d="M50 22 L50 12 C50 10 54 9 56 10" fill="none" {...S} />
    {hl('M40 56 C40 64 43 71 46 75')}
  </>,
  mushroom: () => <>
    <path d="M38 58 C35 71 35 82 39 89 L61 89 C65 82 65 71 62 58 Z" fill="#fef3c7" {...S} />
    <path d="M12 54 C12 29 31 15 50 15 C69 15 88 29 88 54 C88 58 84 60 80 60 L20 60 C16 60 12 58 12 54 Z" fill="#dc2626" {...S} />
    <circle cx={33} cy={36} r={6} fill="#fff" /><circle cx={56} cy={28} r={5} fill="#fff" /><circle cx={70} cy={45} r={6} fill="#fff" /><circle cx={46} cy={49} r={4} fill="#fff" />
  </>,
  pumpkin: () => <>
    <ellipse cx={34} cy={58} rx={22} ry={28} fill="#f97316" {...S} />
    <ellipse cx={66} cy={58} rx={22} ry={28} fill="#f97316" {...S} />
    <ellipse cx={50} cy={58} rx={19} ry={30} fill="#fb923c" {...S} />
    <path d="M50 29 C50 22 52 17 58 13" fill="none" stroke="#4d7c0f" strokeWidth={6} strokeLinecap="round" />
    <path d="M55 22 C63 16 71 18 74 22" fill="none" stroke="#65a30d" strokeWidth={3} strokeLinecap="round" />
  </>,
  // ── море ──
  fish: () => <>
    <path d="M72 50 L91 34 C93 33 95 34 94 37 L90 50 L94 63 C95 66 93 67 91 66 Z" fill="#0ea5e9" {...S} />
    <path d="M14 50 C25 28 58 26 74 50 C58 74 25 72 14 50 Z" fill="#38bdf8" {...S} />
    <path d="M40 36 C46 30 54 30 58 34" fill="none" {...S} strokeWidth={2.6} />
    <path d="M46 52 C50 58 55 60 60 58" fill="none" stroke="#0284c7" strokeWidth={2.6} strokeLinecap="round" />
    <circle cx={29} cy={47} r={5.5} fill="#fff" {...S} strokeWidth={2.4} /><circle cx={30} cy={47} r={2.4} fill={INK} />
  </>,
  shell: () => <>
    <path d="M42 80 L58 80 L62 90 L38 90 Z" fill="#fbcfe8" {...S} />
    <path d="M50 82 C40 82 33 79 29 73 L13 46 C17 22 83 22 87 46 L71 73 C67 79 60 82 50 82 Z" fill="#fda4af" {...S} />
    <path d="M50 80 L50 24 M50 80 L33 28 M50 80 L67 28 M50 80 L19 40 M50 80 L81 40" fill="none" stroke="#e11d48" strokeWidth={2.4} strokeLinecap="round" opacity={0.7} />
  </>,
  starfish: () => <>
    <path d="M50 8 C54 8 56 30 60 36 C64 41 90 38 91 42 C92 47 70 56 68 62 C66 68 79 89 75 92 C71 95 55 77 50 77 C45 77 29 95 25 92 C21 89 34 68 32 62 C30 56 8 47 9 42 C10 38 36 41 40 36 C44 30 46 8 50 8 Z" fill="#fb923c" {...S} />
    <circle cx={50} cy={30} r={2.6} fill="#fff" /><circle cx={50} cy={52} r={3} fill="#fff" /><circle cx={30} cy={46} r={2.6} fill="#fff" /><circle cx={70} cy={46} r={2.6} fill="#fff" /><circle cx={38} cy={72} r={2.6} fill="#fff" /><circle cx={62} cy={72} r={2.6} fill="#fff" />
  </>,
  boat: () => <>
    <path d="M50 12 L50 64" {...S} fill="none" />
    <path d="M54 18 L54 58 L82 58 Z" fill="#fff" {...S} />
    <path d="M46 26 L46 58 L24 58 Z" fill="#fde68a" {...S} />
    <path d="M50 12 L62 16 L50 20" fill="#ef4444" {...S} strokeWidth={2.4} />
    <path d="M12 64 L88 64 L76 84 L24 84 Z" fill="#ef4444" {...S} />
    <path d="M8 92 C16 87 24 87 32 92 C40 97 48 97 56 92 C64 87 72 87 80 92 C84 94 88 95 92 94" fill="none" stroke="#38bdf8" strokeWidth={3.5} strokeLinecap="round" />
  </>,
  crab: () => <>
    <path d="M22 60 L10 70 M24 66 L14 80 M78 60 L90 70 M76 66 L86 80" {...S} fill="none" />
    <path d="M30 40 L22 24 M70 40 L78 24" {...S} fill="none" />
    <path d="M14 20 C14 12 24 10 28 16 L22 22 L30 26 C26 32 14 30 14 20 Z" fill="#f87171" {...S} />
    <path d="M86 20 C86 12 76 10 72 16 L78 22 L70 26 C74 32 86 30 86 20 Z" fill="#f87171" {...S} />
    <ellipse cx={50} cy={58} rx={32} ry={22} fill="#ef4444" {...S} />
    <path d="M40 40 L40 30 M60 40 L60 30" {...S} /><circle cx={40} cy={28} r={5} fill="#fff" {...S} strokeWidth={2.4} /><circle cx={60} cy={28} r={5} fill="#fff" {...S} strokeWidth={2.4} />
    <circle cx={40} cy={28} r={2} fill={INK} /><circle cx={60} cy={28} r={2} fill={INK} />
    <path d="M42 64 C46 68 54 68 58 64" fill="none" {...S} strokeWidth={2.6} />
  </>,
  // ── градина ──
  flower: () => <>
    <path d="M50 58 L50 94" stroke="#16a34a" strokeWidth={5} strokeLinecap="round" />
    <path d="M50 80 C40 70 28 72 24 78 C32 86 44 86 50 80 Z" fill="#4ade80" {...S} />
    {[0, 72, 144, 216, 288].map(a => <ellipse key={a} cx={50} cy={22} rx={12} ry={17} fill="#f472b6" {...S} transform={`rotate(${a} 50 40)`} />)}
    <circle cx={50} cy={40} r={11} fill="#facc15" {...S} />
  </>,
  ladybug: () => <>
    <path d="M30 34 L18 26 M70 34 L82 26 M24 56 L10 56 M76 56 L90 56 M28 74 L16 84 M72 74 L84 84" {...S} fill="none" />
    <path d="M30 32 C30 18 70 18 70 32 Z" fill={INK} />
    <circle cx={50} cy={58} r={32} fill="#ef4444" {...S} />
    <path d="M50 26 L50 90" {...S} />
    <circle cx={36} cy={48} r={6} fill={INK} /><circle cx={64} cy={48} r={6} fill={INK} /><circle cx={34} cy={70} r={5} fill={INK} /><circle cx={66} cy={70} r={5} fill={INK} /><circle cx={50} cy={80} r={0} />
    {hl('M30 40 C33 35 37 32 41 31')}
  </>,
  bee: () => <>
    <ellipse cx={38} cy={28} rx={14} ry={18} fill="#e0f2fe" {...S} transform="rotate(-20 38 28)" />
    <ellipse cx={62} cy={28} rx={14} ry={18} fill="#e0f2fe" {...S} transform="rotate(20 62 28)" />
    <path d="M86 58 L96 60 L86 64" fill={INK} {...S} />
    <ellipse cx={52} cy={60} rx={34} ry={24} fill="#facc15" {...S} />
    <path d="M44 37 C40 48 40 72 44 83 M60 37 C56 48 56 72 60 83" stroke={INK} strokeWidth={7} fill="none" />
    <circle cx={26} cy={56} r={3} fill={INK} />
    <path d="M22 66 C26 70 30 70 33 67" fill="none" {...S} strokeWidth={2.4} />
  </>,
  carrot: () => <>
    <path d="M50 26 C44 14 34 10 30 14 C36 18 42 22 46 28 M50 26 C50 14 54 6 58 6 C58 14 56 20 52 28 M52 28 C58 18 68 14 72 18 C66 22 60 26 54 30" fill="#4ade80" {...S} />
    <path d="M34 30 C40 26 60 26 66 30 C66 44 56 76 51 92 C50 95 48 95 47 92 C42 76 34 44 34 30 Z" fill="#f97316" {...S} />
    <path d="M40 42 L48 44 M54 56 L60 54 M44 66 L50 68" stroke="#c2410c" strokeWidth={2.6} strokeLinecap="round" />
  </>,
  strawberry: () => <>
    <path d="M50 28 C30 22 14 36 18 54 C22 72 40 90 50 92 C60 90 78 72 82 54 C86 36 70 22 50 28 Z" fill="#ef4444" {...S} />
    <path d="M30 26 L50 34 L70 26 L62 18 L50 26 L38 18 Z" fill="#22c55e" {...S} />
    <path d="M50 26 L50 12" {...S} />
    {[[34, 46], [50, 48], [66, 46], [40, 62], [60, 62], [50, 76], [30, 58], [70, 58]].map(([x, y], i) => <ellipse key={i} cx={x} cy={y} rx={1.8} ry={3} fill="#fef08a" />)}
  </>,
  // ── космос ──
  star: () => <>
    <path d="M50 8 L61 36 L91 38 L68 57 L76 87 L50 70 L24 87 L32 57 L9 38 L39 36 Z" fill="#facc15" {...S} />
    {hl('M36 44 L44 42')}
  </>,
  rocket: () => <>
    <path d="M40 74 C40 86 46 94 50 96 C54 94 60 86 60 74 Z" fill="#fb923c" {...S} />
    <path d="M34 54 L20 72 L22 80 L36 72 Z M66 54 L80 72 L78 80 L64 72 Z" fill="#ef4444" {...S} />
    <path d="M50 6 C68 20 70 46 64 74 L36 74 C30 46 32 20 50 6 Z" fill="#e2e8f0" {...S} />
    <path d="M40 18 C44 14 47 11 50 9 C53 11 56 14 60 18 Z" fill="#ef4444" stroke={INK} strokeWidth={0} />
    <circle cx={50} cy={40} r={10} fill="#38bdf8" {...S} />
    {hl('M44 36 C45 33 47 32 49 31')}
  </>,
  planet: () => <>
    <circle cx={50} cy={50} r={28} fill="#a78bfa" {...S} />
    <path d="M30 40 C40 44 60 44 74 38 M28 58 C40 62 62 60 76 54" fill="none" stroke="#7c3aed" strokeWidth={3} strokeLinecap="round" opacity={0.6} />
    <path d="M14 62 C2 72 20 76 50 66 C80 56 98 42 86 38" fill="none" stroke="#fbbf24" strokeWidth={6} strokeLinecap="round" />
    <path d="M14 62 C2 72 20 76 50 66 C80 56 98 42 86 38" fill="none" stroke={INK} strokeWidth={1.6} strokeLinecap="round" opacity={0.5} />
  </>,
  moon: () => <>
    <path d="M62 10 C36 12 18 32 18 54 C18 76 38 92 60 90 C70 89 78 86 84 80 C60 80 42 64 42 44 C42 30 50 18 62 10 Z" fill="#fde047" {...S} />
    <circle cx={36} cy={56} r={4} fill="#facc15" /><circle cx={48} cy={74} r={3} fill="#facc15" />
  </>,
  // ── зима ──
  snowflake: () => <>
    {[0, 60, 120].map(a => <g key={a} transform={`rotate(${a} 50 50)`}>
      <path d="M50 10 L50 90 M50 22 L42 14 M50 22 L58 14 M50 78 L42 86 M50 78 L58 86 M50 34 L40 26 M50 34 L60 26 M50 66 L40 74 M50 66 L60 74" stroke="#0ea5e9" strokeWidth={5} strokeLinecap="round" fill="none" />
    </g>)}
    <circle cx={50} cy={50} r={7} fill="#e0f2fe" stroke="#0ea5e9" strokeWidth={3} />
  </>,
  mitten: () => <>
    <path d="M30 76 L30 36 C30 20 40 12 50 12 C60 12 68 20 68 34 L68 42 C74 36 84 38 84 46 C84 54 74 62 68 68 L68 76 Z" fill="#ef4444" {...S} />
    <rect x={26} y={74} width={46} height={16} rx={6} fill="#fff" {...S} />
    <path d="M38 30 L44 36 L50 30 L56 36 L62 30 M38 46 L44 52 L50 46 L56 52 L62 46" fill="none" stroke="#fff" strokeWidth={3} strokeLinecap="round" />
  </>,
  snowman: () => <>
    <circle cx={50} cy={70} r={24} fill="#fff" {...S} />
    <circle cx={50} cy={36} r={17} fill="#fff" {...S} />
    <rect x={36} y={8} width={28} height={14} rx={2} fill={INK} /><rect x={30} y={20} width={40} height={5} rx={2} fill={INK} />
    <circle cx={44} cy={34} r={2.4} fill={INK} /><circle cx={56} cy={34} r={2.4} fill={INK} />
    <path d="M50 39 L62 42 L50 44 Z" fill="#f97316" stroke="#f97316" strokeWidth={1.5} strokeLinejoin="round" />
    <path d="M38 52 C46 56 54 56 62 52" stroke="#ef4444" strokeWidth={6} strokeLinecap="round" fill="none" />
    <circle cx={50} cy={66} r={3} fill={INK} /><circle cx={50} cy={78} r={3} fill={INK} />
  </>,
  beanie: () => <>
    <circle cx={50} cy={16} r={9} fill="#fff" {...S} />
    <path d="M18 70 C18 40 32 24 50 24 C68 24 82 40 82 70 Z" fill="#6366f1" {...S} />
    <path d="M34 34 L34 70 M50 26 L50 70 M66 34 L66 70" stroke="#4f46e5" strokeWidth={3} />
    <rect x={14} y={66} width={72} height={20} rx={8} fill="#a5b4fc" {...S} />
  </>,
  // ── празник ──
  balloon: () => <>
    <path d="M50 74 C54 82 44 88 50 98" fill="none" stroke={INK} strokeWidth={2.4} strokeLinecap="round" />
    <path d="M50 8 C30 8 20 24 20 40 C20 58 36 72 50 74 C64 72 80 58 80 40 C80 24 70 8 50 8 Z" fill="#f43f5e" {...S} />
    <path d="M45 74 L55 74 L52 79 L48 79 Z" fill="#f43f5e" {...S} strokeWidth={2.4} />
    {hl('M32 30 C34 24 38 20 43 18')}
  </>,
  cupcake: () => <>
    <path d="M24 54 L76 54 L68 92 L32 92 Z" fill="#f9a8d4" {...S} />
    <path d="M36 56 L40 90 M50 56 L50 90 M64 56 L60 90" stroke="#ec4899" strokeWidth={2.6} />
    <path d="M18 56 C14 46 22 38 30 40 C30 28 44 24 50 32 C56 24 70 28 70 40 C78 38 86 46 82 56 Z" fill="#fef3c7" {...S} />
    <circle cx={50} cy={22} r={7} fill="#ef4444" {...S} />
    <path d="M34 46 L38 44 M48 42 L52 44 M62 46 L66 44" stroke="#a855f7" strokeWidth={3} strokeLinecap="round" />
  </>,
  gift: () => <>
    <rect x={16} y={42} width={68} height={48} rx={4} fill="#22c55e" {...S} />
    <rect x={12} y={30} width={76} height={16} rx={4} fill="#4ade80" {...S} />
    <path d="M44 30 L44 90 L56 90 L56 30 Z" fill="#facc15" {...S} />
    <path d="M50 30 C40 14 26 18 30 26 C33 31 44 30 50 30 C56 30 67 31 70 26 C74 18 60 14 50 30 Z" fill="#facc15" {...S} />
  </>,
  candy: () => <>
    <path d="M30 50 L10 34 L14 50 L10 66 Z M70 50 L90 34 L86 50 L90 66 Z" fill="#c084fc" {...S} />
    <circle cx={50} cy={50} r={22} fill="#a855f7" {...S} />
    <path d="M36 36 C44 44 44 56 36 64 M50 28 C58 38 58 62 50 72 M64 36 C56 44 56 56 64 64" stroke="#f5d0fe" strokeWidth={3} fill="none" strokeLinecap="round" />
  </>,
  // ── градът ──
  car: () => <>
    <path d="M10 66 L10 54 C10 49 14 46 19 46 L27 46 L36 31 C38 29 41 27 45 27 L63 27 C67 27 69 29 71 31 L79 46 L82 46 C87 46 91 50 91 55 L91 66 Z" fill="#3b82f6" {...S} />
    <path d="M33 46 L40 34 L50 34 L50 46 Z M56 46 L56 34 L66 34 L73 46 Z" fill="#e0f2fe" {...S} strokeWidth={2.6} />
    <circle cx={30} cy={68} r={10} fill={INK} /><circle cx={30} cy={68} r={4} fill="#cbd5e1" />
    <circle cx={72} cy={68} r={10} fill={INK} /><circle cx={72} cy={68} r={4} fill="#cbd5e1" />
    <rect x={82} y={52} width={6} height={4} rx={1.5} fill="#fde047" />
  </>,
  bus: () => <>
    <rect x={10} y={24} width={80} height={48} rx={8} fill="#facc15" {...S} />
    {[16, 34, 52].map(x => <rect key={x} x={x} y={32} width={14} height={14} rx={2} fill="#e0f2fe" {...S} strokeWidth={2.4} />)}
    <rect x={70} y={32} width={14} height={30} rx={2} fill="#e0f2fe" {...S} strokeWidth={2.4} />
    <path d="M10 54 L70 54" stroke="#f59e0b" strokeWidth={4} />
    <circle cx={28} cy={74} r={9} fill={INK} /><circle cx={28} cy={74} r={3.5} fill="#cbd5e1" />
    <circle cx={70} cy={74} r={9} fill={INK} /><circle cx={70} cy={74} r={3.5} fill="#cbd5e1" />
  </>,
  house: () => <>
    <rect x={20} y={46} width={60} height={44} fill="#fde68a" {...S} />
    <path d="M12 50 L50 16 L88 50 Z" fill="#ef4444" {...S} />
    <rect x={42} y={64} width={16} height={26} rx={2} fill="#92400e" {...S} strokeWidth={2.6} />
    <rect x={26} y={56} width={12} height={12} fill="#bae6fd" {...S} strokeWidth={2.4} /><rect x={62} y={56} width={12} height={12} fill="#bae6fd" {...S} strokeWidth={2.4} />
  </>,
  tree: () => <>
    <rect x={44} y={60} width={12} height={32} rx={3} fill="#a16207" {...S} />
    <circle cx={50} cy={38} r={26} fill="#4ade80" {...S} />
    <circle cx={30} cy={52} r={14} fill="#4ade80" {...S} /><circle cx={70} cy={52} r={14} fill="#4ade80" {...S} />
    <circle cx={40} cy={34} r={3} fill="#ef4444" /><circle cx={60} cy={44} r={3} fill="#ef4444" /><circle cx={48} cy={54} r={3} fill="#ef4444" />
  </>,
  // ── ежедневие / социални ──
  ball: () => <>
    <circle cx={50} cy={50} r={36} fill="#fff" />
    <path d="M50 14 C30 26 26 50 32 78 C40 84 46 86 50 86 C40 62 40 36 50 14 Z" fill="#ef4444" />
    <path d="M50 14 C70 26 74 50 68 78 C60 84 54 86 50 86 C60 62 60 36 50 14 Z" fill="#3b82f6" />
    <path d="M14 50 C20 40 30 34 40 33 C38 44 38 56 40 66 C28 64 18 58 14 50 Z" fill="#facc15" />
    <circle cx={50} cy={50} r={36} fill="none" {...S} />
    {hl('M30 30 C34 26 38 24 42 23')}
  </>,
  toothbrush: () => <>
    <rect x={18} y={40} width={66} height={12} rx={6} fill="#38bdf8" {...S} transform="rotate(-30 50 50)" />
    <g transform="rotate(-30 50 50)"><rect x={64} y={30} width={18} height={10} rx={2} fill="#fff" {...S} strokeWidth={2.6} />
      <path d="M67 30 L67 24 M71 30 L71 24 M75 30 L75 24 M79 30 L79 24" stroke="#94a3b8" strokeWidth={2.6} strokeLinecap="round" /></g>
    <circle cx={70} cy={20} r={5} fill="#e0f2fe" stroke="#7dd3fc" strokeWidth={2} /><circle cx={82} cy={30} r={3.5} fill="#e0f2fe" stroke="#7dd3fc" strokeWidth={2} />
  </>,
  bowl: () => <>
    <path d="M30 34 C34 26 40 32 44 24 M50 32 C54 24 60 30 64 22" fill="none" stroke="#94a3b8" strokeWidth={3} strokeLinecap="round" />
    <path d="M12 48 L88 48 C88 70 72 84 50 84 C28 84 12 70 12 48 Z" fill="#60a5fa" {...S} />
    <path d="M14 48 C24 40 76 40 86 48" fill="#fde68a" {...S} />
    <path d="M64 46 L86 18" {...S} strokeWidth={4} />
  </>,
  backpack: () => <>
    <path d="M36 22 C36 12 64 12 64 22" fill="none" {...S} strokeWidth={5} />
    <rect x={20} y={20} width={60} height={70} rx={16} fill="#22c55e" {...S} />
    <rect x={30} y={54} width={40} height={26} rx={6} fill="#4ade80" {...S} />
    <path d="M30 62 L70 62" {...S} strokeWidth={2.6} />
    <circle cx={50} cy={36} r={4} fill="#facc15" {...S} strokeWidth={2} />
  </>,
  bed: () => <>
    <path d="M10 82 L10 34 M90 82 L90 56" {...S} strokeWidth={5} />
    <rect x={10} y={56} width={80} height={16} rx={3} fill="#a5b4fc" {...S} />
    <rect x={16} y={44} width={22} height={14} rx={6} fill="#fff" {...S} />
    <path d="M36 56 C40 46 84 46 86 56 Z" fill="#6366f1" {...S} />
    <path d="M60 22 L72 22 L60 34 L72 34" fill="none" stroke="#6366f1" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" />
  </>,
  sun: () => <>
    {Array.from({ length: 8 }, (_, i) => <path key={i} d="M50 6 L50 18" stroke="#f59e0b" strokeWidth={5} strokeLinecap="round" transform={`rotate(${i * 45} 50 50)`} />)}
    <circle cx={50} cy={50} r={24} fill="#facc15" {...S} />
    <circle cx={42} cy={46} r={2.6} fill={INK} /><circle cx={58} cy={46} r={2.6} fill={INK} />
    <path d="M40 56 C46 62 54 62 60 56" fill="none" {...S} strokeWidth={2.8} />
  </>,
  phone: () => <>
    <rect x={28} y={8} width={44} height={84} rx={10} fill="#334155" {...S} />
    <rect x={33} y={18} width={34} height={58} rx={3} fill="#e0f2fe" />
    <circle cx={50} cy={84} r={4} fill="#94a3b8" />
    <path d="M42 40 C42 52 48 58 58 58 L60 52 L54 48 L52 51 C48 50 46 48 45 44 L48 42 L44 36 Z" fill="#22c55e" />
  </>,
  basket: () => <>
    <path d="M28 40 C28 18 72 18 72 40" fill="none" {...S} strokeWidth={5} />
    <path d="M12 40 L88 40 L78 88 L22 88 Z" fill="#f59e0b" {...S} />
    <path d="M18 56 L82 56 M20 72 L80 72 M36 40 L38 88 M50 40 L50 88 M64 40 L62 88" stroke="#b45309" strokeWidth={2.6} />
  </>,
  hand: () => <>
    <path d="M30 92 L30 56 C30 50 22 44 18 40 C14 36 18 30 24 32 C28 34 32 40 34 42 L34 18 C34 12 42 12 42 18 L42 40 L42 12 C42 6 50 6 50 12 L50 40 L50 16 C50 10 58 10 58 16 L58 42 L58 24 C58 18 66 18 66 24 L66 62 C66 76 60 86 56 92 Z" fill="#fcd9b6" {...S} />
  </>,
  heart: () => <path d="M50 86 C20 66 8 48 12 32 C16 16 38 12 50 30 C62 12 84 16 88 32 C92 48 80 66 50 86 Z" fill="#f43f5e" {...S} />,
  clockIcon: () => <>
    <circle cx={50} cy={52} r={36} fill="#fff" {...S} />
    <path d="M50 52 L50 30 M50 52 L66 60" {...S} strokeWidth={4.5} />
    <circle cx={50} cy={52} r={3.5} fill={INK} />
  </>,
}

export const ICON_IDS = Object.keys(ICONS)

/** Рисунка с горен ляв ъгъл (x, y) и размер s */
export function Icon({ id, x, y, s, rot = 0, opacity = 1 }: { id: string; x: number; y: number; s: number; rot?: number; opacity?: number }) {
  const f = ICONS[id] || ICONS.star
  return <g transform={`translate(${x} ${y}) scale(${s / 100})${rot ? ` rotate(${rot} 50 50)` : ''}`} opacity={opacity}>{f()}</g>
}

// ── лица за чувствата ──
export type Emotion = 'happy' | 'sad' | 'angry' | 'scared' | 'surprised' | 'calm'
export const EMOTIONS: { id: Emotion; label: string; color: string }[] = [
  { id: 'happy', label: 'радост', color: '#fde047' },
  { id: 'sad', label: 'тъга', color: '#93c5fd' },
  { id: 'angry', label: 'гняв', color: '#fca5a5' },
  { id: 'scared', label: 'страх', color: '#c4b5fd' },
  { id: 'surprised', label: 'изненада', color: '#fdba74' },
  { id: 'calm', label: 'спокойствие', color: '#86efac' },
]
export function Face({ e, x, y, s, plain }: { e: Emotion; x: number; y: number; s: number; plain?: boolean }) {
  const st = { stroke: INK, strokeWidth: 3.5, strokeLinecap: 'round' as const, fill: 'none' }
  const c = plain ? '#fff7ed' : (EMOTIONS.find(x => x.id === e)?.color || '#fde68a')
  const parts: Record<Emotion, ReactNode> = {
    happy: <><path d="M32 42 C35 36 41 36 44 42 M56 42 C59 36 65 36 68 42" {...st} /><path d="M30 58 C38 74 62 74 70 58 Z" fill="#fff" stroke={INK} strokeWidth={3.5} strokeLinejoin="round" /><circle cx={24} cy={56} r={5} fill="#fb7185" opacity={0.5} /><circle cx={76} cy={56} r={5} fill="#fb7185" opacity={0.5} /></>,
    sad: <><path d="M30 34 L42 30 M70 34 L58 30" {...st} /><circle cx={38} cy={44} r={3.5} fill={INK} /><circle cx={62} cy={44} r={3.5} fill={INK} /><path d="M36 72 C42 62 58 62 64 72" {...st} /><path d="M64 50 C60 58 60 62 64 63 C68 62 68 58 64 50 Z" fill="#38bdf8" stroke="#0284c7" strokeWidth={1.6} /></>,
    angry: <><path d="M28 32 L44 40 M72 32 L56 40" {...st} strokeWidth={4.5} /><circle cx={38} cy={46} r={3.5} fill={INK} /><circle cx={62} cy={46} r={3.5} fill={INK} /><path d="M36 70 C42 64 58 64 64 70" {...st} /><path d="M38 70 L62 70" {...st} strokeWidth={2.4} /></>,
    scared: <><path d="M30 30 C34 26 40 26 44 30 M56 30 C60 26 66 26 70 30" {...st} /><circle cx={38} cy={44} r={7} fill="#fff" stroke={INK} strokeWidth={3} /><circle cx={62} cy={44} r={7} fill="#fff" stroke={INK} strokeWidth={3} /><circle cx={38} cy={45} r={2.5} fill={INK} /><circle cx={62} cy={45} r={2.5} fill={INK} /><path d="M38 70 C42 64 46 72 50 66 C54 72 58 64 62 70" {...st} /></>,
    surprised: <><path d="M30 26 C34 20 42 20 46 26 M54 26 C58 20 66 20 70 26" {...st} /><circle cx={38} cy={40} r={6} fill="#fff" stroke={INK} strokeWidth={3} /><circle cx={62} cy={40} r={6} fill="#fff" stroke={INK} strokeWidth={3} /><circle cx={38} cy={40} r={2.6} fill={INK} /><circle cx={62} cy={40} r={2.6} fill={INK} /><ellipse cx={50} cy={66} rx={8} ry={10} fill="#7f1d1d" stroke={INK} strokeWidth={3} /></>,
    calm: <><path d="M31 44 C35 48 41 48 45 44 M55 44 C59 48 65 48 69 44" {...st} /><path d="M38 62 C44 68 56 68 62 62" {...st} /><circle cx={26} cy={56} r={5} fill="#fb7185" opacity={0.35} /><circle cx={74} cy={56} r={5} fill="#fb7185" opacity={0.35} /></>,
  }
  return <g transform={`translate(${x} ${y}) scale(${s / 100})`}><circle cx={50} cy={50} r={44} fill={c} stroke={INK} strokeWidth={3.5} />{parts[e]}</g>
}

// ── пари: монети и банкноти в евро (опростени, не копират истинските дизайни) ──
export const COINS = [1, 2, 5, 10, 20, 50, 100, 200]          // в центове
export const NOTES = [500, 1000, 2000, 5000]                  // 5, 10, 20, 50 €
export const moneyLabel = (c: number) => c >= 100 ? (c % 100 ? `${(c / 100).toFixed(2).replace('.', ',')} €` : `${c / 100} €`) : `${c} ц.`
export function Coin({ c, x, y, s = 60 }: { c: number; x: number; y: number; s?: number }) {
  // размер според стойността (както истинските: 1 ц. най-малка, 2 € най-голяма)
  const k = ({ 1: 0.72, 2: 0.8, 5: 0.86, 10: 0.82, 20: 0.9, 50: 0.97, 100: 0.94, 200: 1 } as Record<number, number>)[c] || 0.9
  const r = (s / 2) * k, cx = x + s / 2, cy = y + s / 2
  const copper = c < 10, gold = c >= 10 && c < 100
  const outer = copper ? '#c2703d' : gold ? '#e3b23c' : c === 100 ? '#d6d3d1' : '#e3b23c'
  const inner = c === 100 ? '#e3b23c' : c === 200 ? '#d6d3d1' : outer
  const big = c >= 100 ? `${c / 100}` : `${c}`
  return (
    <g>
      <circle cx={cx} cy={cy} r={r} fill={outer} stroke={INK} strokeWidth={2.4} />
      {c >= 100 && <circle cx={cx} cy={cy} r={r * 0.68} fill={inner} stroke={INK} strokeWidth={1.4} />}
      <circle cx={cx} cy={cy} r={r * 0.86} fill="none" stroke="#fff" strokeWidth={1.2} opacity={0.55} strokeDasharray="2 3" />
      <text x={cx} y={cy + r * (c >= 100 ? 0.12 : 0.16)} fontSize={r * (c >= 100 ? 0.62 : big.length > 1 ? 0.6 : 0.74)} fontWeight={900} fill={INK} textAnchor="middle" fontFamily={FONT}>{big}</text>
      <text x={cx} y={cy + r * (c >= 100 ? 0.46 : 0.54)} fontSize={r * (c >= 100 ? 0.2 : 0.26)} fontWeight={800} fill={INK} textAnchor="middle" fontFamily={FONT}>{c >= 100 ? 'ЕВРО' : c === 1 ? 'ЦЕНТ' : 'ЦЕНТА'}</text>
    </g>
  )
}
export function Note({ c, x, y, w = 130 }: { c: number; x: number; y: number; w?: number }) {
  const h = w * 0.52
  const col = ({ 500: '#cbd5e1', 1000: '#fca5a5', 2000: '#93c5fd', 5000: '#fdba74' } as Record<number, string>)[c] || '#e2e8f0'
  return (
    <g>
      <rect x={x} y={y} width={w} height={h} rx={6} fill={col} stroke={INK} strokeWidth={2.4} />
      <rect x={x + 6} y={y + 6} width={w - 12} height={h - 12} rx={4} fill="none" stroke="#fff" strokeWidth={1.5} opacity={0.8} />
      <circle cx={x + w * 0.72} cy={y + h / 2} r={h * 0.26} fill="#fff" opacity={0.55} />
      <text x={x + 14} y={y + h * 0.42} fontSize={h * 0.34} fontWeight={900} fill={INK} fontFamily={FONT}>{c / 100}</text>
      <text x={x + 14} y={y + h * 0.78} fontSize={h * 0.18} fontWeight={800} fill={INK} fontFamily={FONT}>ЕВРО</text>
    </g>
  )
}

// ── часовник ──
export function Clock({ x, y, s, h, m, hands = true, digits = true, color = '#fff' }: { x: number; y: number; s: number; h: number; m: number; hands?: boolean; digits?: boolean; color?: string }) {
  const r = s / 2, cx = x + r, cy = y + r
  const pt = (a: number, l: number) => [cx + Math.sin(a) * l, cy - Math.cos(a) * l]
  const ha = ((h % 12) + m / 60) * Math.PI / 6, ma = m * Math.PI / 30
  const [hx, hy] = pt(ha, r * 0.5), [mx, my] = pt(ma, r * 0.74)
  return (
    <g>
      <circle cx={cx} cy={cy} r={r} fill={color} stroke={INK} strokeWidth={3.5} />
      {Array.from({ length: 60 }, (_, i) => { const [a1, b1] = pt(i * Math.PI / 30, r * 0.92), [a2, b2] = pt(i * Math.PI / 30, r * (i % 5 ? 0.88 : 0.82)); return <line key={i} x1={a1} y1={b1} x2={a2} y2={b2} stroke={INK} strokeWidth={i % 5 ? 1 : 2.4} strokeLinecap="round" /> })}
      {digits && Array.from({ length: 12 }, (_, i) => { const [a, b] = pt((i + 1) * Math.PI / 6, r * 0.66); return <text key={i} x={a} y={b + r * 0.075} fontSize={r * 0.21} fontWeight={800} fill={INK} textAnchor="middle" fontFamily={FONT}>{i + 1}</text> })}
      {hands && <>
        <line x1={cx} y1={cy} x2={hx} y2={hy} stroke="#ef4444" strokeWidth={r * 0.075} strokeLinecap="round" />
        <line x1={cx} y1={cy} x2={mx} y2={my} stroke="#2563eb" strokeWidth={r * 0.05} strokeLinecap="round" />
      </>}
      <circle cx={cx} cy={cy} r={r * 0.05} fill={INK} />
    </g>
  )
}
