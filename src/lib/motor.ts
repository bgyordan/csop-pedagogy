// Двигателна оценка (ФВС) — работна педагогическа карта на ЦСОП: 62 проби в 13 области.
// Не е стандартизиран тест и няма възрастови норми: детето се сравнява само със себе си, без общ бал.
// Скалата 0–4 е по степен на физическа помощ; НП/НО/НР/ОТ са отделни кодове (не са 0 точки).
// Два режима: „Основна“ (24 ключови проби, бърза оценка) и „Подробна“ (всички проби, два опита,
// ляво/дясно и критерии за качество на движението — по идеята на TGMD-3 / APEAS II, с наши формулировки).

export type Measure = 'none' | 'sec' | 'cm' | 'm' | 'min' | 'reps' | 'hits' | 'kg' | 'pref'

export interface MotorItem {
  no: number
  domain: string
  name: string
  how: string        // провеждане
  record: string     // какво се записва
  measure: Measure
  of?: number        // „успехи от N“ / максимум
  better?: 'up' | 'down'
  sides?: boolean    // ляво и дясно поотделно
  trials?: boolean   // два отчетни опита
  basic?: boolean    // в основния набор
  stand?: boolean    // изисква стоеж/ходене — при GMFCS IV–V обикновено НП
  quality?: string[] // критерии за качество (подробна оценка)
}

export const DOMAINS: { key: string; label: string; color: string }[] = [
  { key: 'mobility', label: 'Основна мобилност', color: '#0d9488' },
  { key: 'static', label: 'Статичен баланс', color: '#0891b2' },
  { key: 'dynamic', label: 'Динамичен баланс', color: '#0284c7' },
  { key: 'gross', label: 'Груба моторика', color: '#2563eb' },
  { key: 'body', label: 'Телесна схема и ляво–дясно', color: '#7c3aed' },
  { key: 'head', label: 'Имитация по типа на Хед', color: '#9333ea' },
  { key: 'bilateral', label: 'Двустранна координация', color: '#c026d3' },
  { key: 'eyehand', label: 'Зрително-моторна координация', color: '#db2777' },
  { key: 'rhythm', label: 'Ритъм и двигателно планиране', color: '#e11d48' },
  { key: 'space', label: 'Пространствена ориентация', color: '#ea580c' },
  { key: 'strength', label: 'Сила и функционална подвижност', color: '#d97706' },
  { key: 'speed', label: 'Бързина и издръжливост', color: '#65a30d' },
  { key: 'participation', label: 'Разбиране и участие', color: '#475569' },
]
export const domainOf = (k: string) => DOMAINS.find(d => d.key === k) || DOMAINS[0]

const I = (no: number, domain: string, name: string, how: string, record: string, measure: Measure, o: Partial<MotorItem> = {}): MotorItem =>
  ({ no, domain, name, how, record, measure, better: measure === 'sec' && !o.better ? 'down' : o.better || 'up', ...o })

export const ITEMS: MotorItem[] = [
  I(1, 'mobility', 'Ставане и сядане', 'От стабилен стол с опрени ходила; 3 цикъла.', 'Опора с ръце, симетрия, контрол; помощ.', 'none', { basic: true }),
  I(2, 'mobility', 'Ставане от пода', 'От удобен седеж върху постелка, само ако е безопасно.', 'Начин, опори и необходима помощ.', 'none'),
  I(3, 'mobility', 'Ходене 10 м', 'Маркирана отсечка; обичаен темп и помощно средство.', 'Време, стабилност, спирания.', 'sec', { basic: true, trials: true, stand: true,
    quality: ['Равномерен ритъм на стъпките', 'Стъпва с пета, после с пръсти', 'Ръцете се движат срещу краката', 'Без широка опорна база'] }),
  I(4, 'mobility', 'Ходене назад 5 м', 'Свободна отсечка с непосредствена защита.', 'Стъпки, посока и контрол.', 'none', { stand: true }),

  I(5, 'static', 'Събрани ходила', 'Стоеж до 20 сек с отворени очи.', 'Секунди без опора; колебания.', 'sec', { of: 20, better: 'up', basic: true, stand: true }),
  I(6, 'static', 'Тандемен стоеж', 'Едно ходило пред другото; до 10 сек; смяна.', 'Време за всяка позиция (Л/Д отпред).', 'sec', { of: 10, better: 'up', sides: true, stand: true }),
  I(7, 'static', 'Стоеж на един крак', 'До 10 сек на всеки крак, с осигуряване.', 'Ляво/дясно; време, опора.', 'sec', { of: 10, better: 'up', sides: true, basic: true, stand: true }),
  I(8, 'static', 'Баланс в седеж', 'Стабилен седеж и достигане към предмет.', 'Контрол на трупа и връщане.', 'none', { basic: true }),

  I(9, 'dynamic', 'Ходене по линия', 'Линия 3 м; нормални стъпки.', 'Отклонения и помощ.', 'none', { basic: true, stand: true }),
  I(10, 'dynamic', 'Прекрачване', '3 ниски препятствия с описана височина.', 'Закачания, опора, контрол.', 'hits', { of: 3, stand: true }),
  I(11, 'dynamic', 'Качване и слизане', 'Стабилно ниско стъпало; 3 цикъла.', 'Водещ крак, опора, контрол.', 'none', { basic: true, stand: true }),
  I(12, 'dynamic', 'Слалом', '4 конуса през 1 м; ходене.', 'Пропуски, сблъсъци, време.', 'sec', { stand: true }),

  I(13, 'gross', 'Бягане', '10 м при безопасни условия.', 'Модел, координация, време.', 'sec', { basic: true, trials: true, stand: true,
    quality: ['Ръцете се движат срещу краката, свити в лактите', 'Има кратък момент без опора (полет)', 'Стъпва на предната част на ходилото или пета–пръсти, не с плоско ходило', 'Неопорният крак се свива силно назад', 'Държи посоката без отклонения'] }),
  I(14, 'gross', 'Подскок с два крака', '3 подскока на място.', 'Едновременно оттласкване и приземяване.', 'reps', { of: 3, basic: true, stand: true,
    quality: ['Оттласква се едновременно с двата крака', 'Приземява се едновременно на двата крака', 'Свива коленете при приземяването', 'Ръцете помагат на движението'] }),
  I(15, 'gross', 'Скок напред', 'От място; 2 опита, рулетка.', 'Сантиметри и стабилно приземяване.', 'cm', { trials: true, basic: true, stand: true,
    quality: ['Подготвително свиване в коленете с ръце назад', 'Ръцете замахват напред и нагоре при оттласкването', 'Оттласква се и се приземява с двата крака едновременно', 'Приземява се стабилно, без падане назад'] }),
  I(16, 'gross', 'Подскок на един крак', 'До 3 подскока с всеки крак.', 'Брой и контрол по страни.', 'reps', { of: 3, sides: true, stand: true,
    quality: ['Неопорният крак замахва и помага за тласъка', 'Неопорният крак не докосва пода', 'Ръцете са свити и помагат', 'Приземява се на същия крак с контрол'] }),
  I(17, 'gross', 'Галоп и странични стъпки', 'По 5 м след демонстрация.', 'Ритъм, последователност, модел.', 'none', { basic: true, stand: true,
    quality: ['Водещият крак стъпва, другият го „догонва“', 'Кратък момент без опора', 'Ритмично поне 4 последователни цикъла', 'Запазва посоката (напред / встрани)'] }),

  I(18, 'body', 'Части на тялото', 'Покажи нос, ухо, рамо, коляно, ходило.', 'Правилни от 5; начин на инструкция.', 'hits', { of: 5, basic: true }),
  I(19, 'body', 'Ляво и дясно върху себе си', 'Покажи дясна ръка, лява ръка, десен крак, ляв крак.', 'Правилни от 4 без подсказване.', 'hits', { of: 4, basic: true }),
  I(20, 'body', 'Кръстосана инструкция', 'Дясна ръка към ляво ухо; обратното.', 'Избор на страна и изпълнение; 2 задачи.', 'hits', { of: 2 }),
  I(21, 'body', 'Ляво и дясно върху друг', 'Покажи лява/дясна ръка на учител срещу детето.', 'Правилни от 2; положение на учителя.', 'hits', { of: 2 }),
  I(22, 'body', 'Предпочитана страна', '3 вземания, 3 хвърляния, 3 ритания; предмет в центъра.', 'Ръка/крак по задача; не налагайте страна.', 'pref'),
  I(23, 'body', 'Предпочитано око', 'Поглед през широка тръбичка; 3 опита, ако разбира.', 'Избрано око; описателно наблюдение.', 'pref'),

  I(24, 'head', 'Поза в една посока', 'Учител до детето: ръка към ухо от същата страна; 2 пози.', 'Възпроизвеждане и страна.', 'hits', { of: 2 }),
  I(25, 'head', 'Кръстосана поза', 'Учител до детето: ръка към срещуположното ухо; 2 пози.', 'Пресичане и пространствено съответствие.', 'hits', { of: 2 }),
  I(26, 'head', 'Поза лице в лице', 'Демонстрирайте 2 едностранни и 2 кръстосани пози.', 'Огледално или по анатомична страна (в бележката).', 'hits', { of: 4 }),
  I(27, 'head', 'Поза по словесна инструкция', '2 едностранни и 2 кръстосани задачи без модел.', 'Разбиране, страна, правилни от 4.', 'hits', { of: 4 }),

  I(28, 'bilateral', 'Симетрични движения', 'Двете ръце нагоре, встрани и напред; 3 цикъла.', 'Едновременност и обем.', 'none', { basic: true }),
  I(29, 'bilateral', 'Редуващи движения', 'Потупване лява/дясна ръка по маса; 6 редувания.', 'Ред, ритъм, пропуски.', 'hits', { of: 6 }),
  I(30, 'bilateral', 'Кръстосано докосване', 'Дясна ръка – ляво коляно и обратно; 6 докосвания.', 'Правилни, ритъм, помощ.', 'hits', { of: 6, basic: true }),
  I(31, 'bilateral', 'Маршируване', '10 стъпки с противоположни ръка и крак.', 'Съгласуване и устойчивост.', 'none', { stand: true }),
  I(32, 'bilateral', 'Срединна линия', 'С дясна ръка предмет вляво, с лява вдясно; 4 опита.', 'Пресичане, смяна на ръката, завъртане.', 'hits', { of: 4 }),

  I(33, 'eyehand', 'Хвърляне към цел', 'Мека топка към голяма цел от 1,5 м; 5 опита.', 'Успехи от 5; сила и посока.', 'hits', { of: 5, basic: true,
    quality: ['Замахва с ръката надолу и назад', 'Завърта таза и раменете (страната към целта)', 'Стъпва напред с противоположния крак', 'Ръката продължава движението след пускането'] }),
  I(34, 'eyehand', 'Хвърляне към партньор', 'От 1,5 м; 5 опита.', 'Дозиране, насочване, предпочитана ръка.', 'hits', { of: 5 }),
  I(35, 'eyehand', 'Улавяне', 'Мека топка към гърдите от 1 м; 5 опита.', 'Успехи от 5; проследяване.', 'hits', { of: 5, basic: true,
    quality: ['Готова позиция: ръцете пред тялото, лактите свити', 'Протяга ръце към топката', 'Лови само с ръцете, без да притиска към гърдите', 'Проследява топката с поглед'] }),
  I(36, 'eyehand', 'Отбиване в земята', 'До 5 последователни удара.', 'Брой, контрол, ритъм.', 'reps', { of: 5, stand: true,
    quality: ['Удря с една ръка около нивото на кръста', 'Тласка с пръстите, не „шамари“ с длан', 'Топката пада пред/до крака от същата страна', 'Задържа контрол, без да гони топката'] }),
  I(37, 'eyehand', 'Ритане към цел', 'Неподвижна топка към широка цел от 2 м; 5 опита.', 'Успехи, крак, баланс.', 'hits', { of: 5, basic: true, stand: true,
    quality: ['Бърз, непрекъснат подход към топката', 'Удължена последна крачка преди удара', 'Опорният крак е до или малко зад топката', 'Удря с вътрешната част или връхчето на ходилото'] }),
  I(38, 'eyehand', 'Водене с крак', 'По права отсечка 5 м.', 'Контрол, отклонения, помощ.', 'none', { stand: true }),

  I(39, 'rhythm', 'Ритъм с пляскане', 'Покажете 4 равномерни пляскания, после кратка пауза и 2.', 'Повторен ритъм и последователност.', 'none'),
  I(40, 'rhythm', 'Движение по ритъм', 'Марш или потупване 10 сек с равномерен сигнал.', 'Съгласуване и задържане.', 'none'),
  I(41, 'rhythm', 'Имитация на поредица', 'Ръце нагоре → на рамене → встрани.', 'Ред, пропуски, нужда от модел.', 'none'),
  I(42, 'rhythm', 'Двигателен маршрут', 'Стани → вземи топката → хвърли към цел.', 'Планиране и изпълнение на 3 стъпки.', 'hits', { of: 3, basic: true }),
  I(43, 'rhythm', 'Стоп и тръгни', '5 сигнала при ходене или движения в седеж.', 'Реакции, закъснение, спиране.', 'hits', { of: 5, basic: true }),

  I(44, 'space', 'Пред, зад и до', 'Постави предмет пред, зад и до конус; 3 задачи.', 'Правилни от 3; разбиране.', 'hits', { of: 3 }),
  I(45, 'space', 'Маршрут', 'Обиколи конуса, върни се и спри на маркера.', 'Посока, ред и подкрепа.', 'none'),
  I(46, 'space', 'Смяна на посока', '4 сигнала с жест/стрелка, после при възможност с думи.', 'Правилни от 4; вид сигнал.', 'hits', { of: 4 }),

  I(47, 'strength', 'Ставане за 30 сек', 'Стабилен стол; описана височина и еднакви опори.', 'Пълни повторения; качество.', 'reps', { basic: true }),
  I(48, 'strength', 'Клек до стол', 'До 5 контролирани повторения.', 'Дълбочина, симетрия, опора.', 'reps', { of: 5, stand: true }),
  I(49, 'strength', 'Лицеви опори на стена', 'До 5 повторения; фиксирана дистанция на ходилата.', 'Брой, позиция на трупа, контрол.', 'reps', { of: 5, stand: true }),
  I(50, 'strength', 'Контрол на трупа', 'В седеж достигане напред и връщане; 5 пъти.', 'Контрол и помощ; не е изолирана сила.', 'reps', { of: 5 }),
  I(51, 'strength', 'Сила на захвата', 'Динамометър по неговия протокол, ако е подходящ.', 'Резултат по ръце, настройка, опити.', 'kg', { sides: true }),
  I(52, 'strength', 'Навеждане в седеж', 'Плавно достигане към ходилата, без натиск.', 'Достигане и комфорт; без норми.', 'none'),
  I(53, 'strength', 'Раменна подвижност', 'Ръце над глава; после достигане зад гърба.', 'Активен обем, симетрия, болка.', 'none'),

  I(54, 'speed', 'Бързо придвижване 10 м', 'Ходене или бягане според възможностите; 2 опита.', 'Време и начин на придвижване.', 'sec', { trials: true }),
  I(55, 'speed', 'Совалково придвижване', '2 × 5 м с едно обръщане, ако е безопасно.', 'Време и контрол при обръщане.', 'sec', { stand: true }),
  I(56, 'speed', 'Ходене за 2 или 6 мин', 'Една продължителност и описан маршрут; почивки са допустими.', 'Метри, почивки, помощ, симптоми; не сравнявайте двата варианта.', 'm', { basic: true }),
  I(57, 'speed', 'Участие в продължителна дейност', 'Позната двигателна игра 3–5 мин; без натиск до изтощение.', 'Време на участие, почивки, признаци на умора.', 'min'),

  I(58, 'participation', 'Едностепенна инструкция', '3 познати задачи като „вземи топката“.', 'Успехи и начин на представяне.', 'hits', { of: 3, basic: true }),
  I(59, 'participation', 'Двустепенна инструкция', '„Вземи топката и я сложи в коша“; 3 задачи.', 'Ред, успехи, подкрепа.', 'hits', { of: 3 }),
  I(60, 'participation', 'Изчакване на ред', 'Кратка игра с партньор; 3 редувания.', 'Изчакване и подсказване.', 'hits', { of: 3 }),
  I(61, 'participation', 'Дейност с партньор', '5 подавания или търкаляния на топка.', 'Взаимност, участие и помощ.', 'hits', { of: 5, basic: true }),
  I(62, 'participation', 'Задържане в дейност', 'Наблюдение в позната игра.', 'Минути, прекъсвания, условия.', 'min'),
]
export const itemOf = (no: number) => ITEMS.find(i => i.no === no)
export const BASIC = ITEMS.filter(i => i.basic).map(i => i.no)

export const UNIT: Record<Measure, string> = { none: '', sec: 'сек', cm: 'см', m: 'м', min: 'мин', reps: 'бр.', hits: 'усп.', kg: 'кг', pref: '' }

/** Скала 0–4 — по степен на физическа помощ */
export const MSCALE: { v: number; label: string; bg: string; fg: string }[] = [
  { v: 0, label: 'Не изпълнява (след проверено разбиране)', bg: '#e2e8f0', fg: '#475569' },
  { v: 1, label: 'С пълна физическа помощ', bg: '#fecaca', fg: '#991b1b' },
  { v: 2, label: 'С частична физическа помощ', bg: '#fde68a', fg: '#92400e' },
  { v: 3, label: 'Без физическа помощ, но непълно/неточно/нестабилно', bg: '#bbf7d0', fg: '#166534' },
  { v: 4, label: 'Без физическа помощ, по критерия', bg: '#22c55e', fg: '#ffffff' },
]
export const CODES: Record<string, string> = { 'НП': 'неприложимо', 'НО': 'неоценено', 'НР': 'неразбрана инструкция', 'ОТ': 'отказ' }
/** Подкрепа за инструкцията (отделно от двигателния резултат) — от най-леката към най-силната */
export const SUPPORT: { k: string; label: string; rank: number }[] = [
  { k: 'С', label: 'словесна', rank: 1 }, { k: 'В', label: 'визуална', rank: 2 }, { k: 'Ж', label: 'жест', rank: 2 },
  { k: 'М', label: 'демонстрация', rank: 3 }, { k: 'ПФ', label: 'частична физическа', rank: 4 }, { k: 'ПП', label: 'пълна физическа', rank: 5 },
]
export const supportRank = (s: string[] | null | undefined) => Math.max(0, ...(s || []).map(k => SUPPORT.find(x => x.k === k)?.rank || 0))

export const STAGES: Record<string, string> = { entry: 'Входна', mid: 'Междинна', exit: 'Изходна', current: 'Текуща' }
export const DETAIL: Record<string, string> = { basic: 'Основна', advanced: 'Подробна' }

export interface MotorSession {
  id: string; student_id: string; academic_year_id: string | null; assessed_on: string; stage: string; detail: string
  assessor_id: string | null; conditions: Record<string, string>; profile: Record<string, { strengths?: string; priority?: string }>
  observations: string | null; created_at: string
}
export interface MotorResult {
  session_id: string; item: number; score: number | null; code: string | null
  t1: number | null; t2: number | null; l: number | null; r: number | null; pref: string | null
  support: string[]; quality: number[]; note: string | null
}
export interface MotorGoal {
  id: string; student_id: string; item: number | null; domain: string | null; goal: string; due: string | null
  gas: number | null; set_at: string; achieved_at: string | null
}

export const CONDITIONS: { k: string; label: string; ph: string }[] = [
  { k: 'communication', label: 'Начин на комуникация', ph: 'реч, жестове, картинки, PECS…' },
  { k: 'aids', label: 'Мобилност и помощни средства', ph: 'проходилка, ортези, количка…' },
  { k: 'limits', label: 'Известни ограничения и препоръки', ph: 'от лекар/рехабилитатор: без скокове, епилепсия…' },
  { k: 'setup', label: 'Условия и пособия', ph: 'зала, разстояния, топка, височина на стола…' },
]

export const MOTOR_ROLES = ['admin', 'zdud', 'director', 'teacher', 'class_teacher', 'educator', 'rehabilitator', 'psychologist', 'speech_therapist']

const num = (x: number | null | undefined) => (x === null || x === undefined || Number.isNaN(Number(x)) ? null : Number(x))
/** Основната стойност на резултата (по-добрият опит; при страни — средно от двете) */
export function mainValue(it: MotorItem, r: Partial<MotorResult> | undefined): number | null {
  if (!r) return null
  if (it.sides) {
    const v = [num(r.l), num(r.r)].filter((x): x is number => x !== null)
    return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null
  }
  const v = [num(r.t1), num(r.t2)].filter((x): x is number => x !== null)
  if (!v.length) return null
  return it.better === 'down' ? Math.min(...v) : Math.max(...v)
}

const fmtN = (x: number) => (Math.round(x * 10) / 10).toLocaleString('bg-BG', { maximumFractionDigits: 1 })
/** Кратък текст на резултата: „3 · 4/5 · М“ */
export function resultText(it: MotorItem, r: Partial<MotorResult> | undefined, o: { support?: boolean } = { support: true }): string {
  if (!r) return ''
  const parts: string[] = []
  if (r.code) parts.push(r.code)
  else if (r.score !== null && r.score !== undefined) parts.push(String(r.score))
  const u = UNIT[it.measure]
  if (it.measure === 'pref') { if (r.pref) parts.push(r.pref) }
  else if (it.sides) {
    const l = num(r.l), rr = num(r.r)
    if (l !== null || rr !== null) parts.push(`Л ${l !== null ? fmtN(l) : '–'} / Д ${rr !== null ? fmtN(rr) : '–'}${u ? ' ' + u : ''}`)
  } else {
    const v = [num(r.t1), num(r.t2)].filter((x): x is number => x !== null)
    if (v.length) parts.push(it.measure === 'hits' && it.of ? v.map(x => `${fmtN(x)}/${it.of}`).join('; ') : `${v.map(fmtN).join('; ')}${u ? ' ' + u : ''}`)
  }
  if (o.support && r.support?.length) parts.push(r.support.join('+'))
  return parts.join(' · ')
}

/** Промяна между два резултата за една проба: по помощ (0–4), после по подкрепата, после по стойността (>10%) */
export function compare(it: MotorItem, a: Partial<MotorResult> | undefined, b: Partial<MotorResult> | undefined): { dir: -1 | 0 | 1 | null; why: string } {
  if (!a || !b) return { dir: null, why: '' }
  if (a.code || b.code || a.score === null || a.score === undefined || b.score === null || b.score === undefined) {
    // без оценка 0–4: само по стойността, ако я има и в двете
  } else if (b.score !== a.score) {
    return { dir: b.score > a.score ? 1 : -1, why: b.score > a.score ? 'по-малко физическа помощ' : 'повече физическа помощ' }
  } else {
    const sa = supportRank(a.support), sb = supportRank(b.support)
    if (sa !== sb) return { dir: sb < sa ? 1 : -1, why: sb < sa ? 'по-лека подкрепа за инструкцията' : 'по-силна подкрепа за инструкцията' }
  }
  const va = mainValue(it, a), vb = mainValue(it, b)
  if (va !== null && vb !== null && va !== vb) {
    const rel = Math.abs(vb - va) / Math.max(Math.abs(va), 1e-6)
    const discrete = it.measure === 'hits' || it.measure === 'reps'
    if (discrete || rel > 0.1) {
      const up = vb > va
      const good = it.better === 'down' ? !up : up
      return { dir: good ? 1 : -1, why: `${fmtN(va)} → ${fmtN(vb)}${UNIT[it.measure] ? ' ' + UNIT[it.measure] : ''}` }
    }
  }
  const qa = a.quality?.length || 0, qb = b.quality?.length || 0
  if (it.quality && qa !== qb && (qa || qb)) return { dir: qb > qa ? 1 : -1, why: `качество ${qa} → ${qb} от ${it.quality.length}` }
  if (a.code || b.code) return { dir: null, why: '' }
  return { dir: 0, why: 'без промяна' }
}

export const isEmptyResult = (r: Partial<MotorResult> | undefined) => !r || (r.score === null || r.score === undefined) && !r.code &&
  num(r.t1) === null && num(r.t2) === null && num(r.l) === null && num(r.r) === null && !r.pref && !(r.support?.length) && !(r.quality?.length) && !r.note?.trim()

export const sortSessions = (l: MotorSession[]) => [...l].sort((a, b) => a.assessed_on.localeCompare(b.assessed_on) || a.created_at.localeCompare(b.created_at))
export const fmtD = (d: string) => d ? d.split('-').reverse().join('.') : ''
export const GAS_LABEL: Record<number, string> = { [-2]: 'много под очакваното', [-1]: 'под очакваното', 0: 'очакваното', 1: 'над очакваното', 2: 'много над очакваното' }
