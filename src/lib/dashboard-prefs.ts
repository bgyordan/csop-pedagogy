// „Подреди таблото“ — всеки сам избира с отметка кои карти да стоят на началната страница.
// Изборът се пази в бисквитка за този служител (на това устройство); без избор важат стойностите по роля.
// wide — на цял ред; fixed — не се пренарежда (стои вътре в таблото по роля)
export type DashWidget = { key: string; label: string; hint?: string; roles?: string[]; notRoles?: string[]; wide?: boolean; fixed?: boolean }

// Редът тук е и подредбата по подразбиране на таблото.
export const DASH_WIDGETS: DashWidget[] = [
  { key: 'nonschool', label: 'Неучебен ден', hint: 'известие за спонтанен неучебен ден', wide: true },
  { key: 'ifoToday', label: 'Деца в ИФО — днес', hint: 'какво имат и при кого', notRoles: ['secretary'], wide: true },
  { key: 'visit', label: 'Посещения на час', hint: 'избор на ден при отворена проверка' },
  { key: 'control', label: 'Контролна дейност', hint: 'протоколи за запознаване' },
  { key: 'duty', label: 'Дежурства', hint: 'дежурните тази седмица' },
  { key: 'council', label: 'За съгласуване', hint: 'материали за предстоящ съвет' },
  { key: 'facilities', label: 'Материална база', hint: 'нови сигнали и отговори' },
  { key: 'ores', label: 'Онлайн стаи (ОРЕС)', notRoles: ['secretary', 'support'] },
  { key: 'classroom', label: 'Онлайн стаи на паралелките', notRoles: ['secretary', 'support'] },
  { key: 'absent', label: 'Отсъстващи деца', notRoles: ['secretary', 'support'] },
  { key: 'todayAbsent', label: 'Днес отсъстват (колеги)', notRoles: ['admin', 'zdud', 'director'] },
  { key: 'calendar', label: 'Моята седмица (календар)', hint: 'събития, срокове, покани', wide: true },
  { key: 'shared', label: 'Споделено от колеги', hint: 'файлове и публикации за сайта', roles: ['secretary'], fixed: true },
]

// по подразбиране скрито (докато човек сам не избере)
const DEFAULT_HIDDEN: Record<string, string[]> = {
  secretary: ['calendar'],
  support: ['calendar'], // помощниците са на крак, с телефона — оперативното отгоре, календарът по желание
}

export const dashCookie = (staffId: string) => `eis_dash_${staffId}`

export function widgetsFor(role: string) {
  return DASH_WIDGETS.filter(w => (!w.roles || w.roles.includes(role)) && !(w.notRoles || []).includes(role))
}

/** скритите карти: от бисквитката (ако човек е избирал) или по роля */
export function hiddenWidgets(role: string, cookieValue?: string | null): Set<string> {
  if (cookieValue != null) return new Set(cookieValue.split(',').filter(Boolean))
  return new Set(DEFAULT_HIDDEN[role] || [])
}

// Пренареждане (стрелки ↑↓ в „Подреди таблото“) — редът се пази в отделна бисквитка за служителя.
export const orderCookie = (staffId: string) => `eis_dash_order_${staffId}`

/** пълният ред на картите: първо избраните от човека, после останалите по подразбиране */
export function widgetOrder(cookieValue?: string | null): string[] {
  const all = DASH_WIDGETS.map(w => w.key)
  const saved = (cookieValue || '').split(',').filter(k => all.includes(k))
  return [...saved, ...all.filter(k => !saved.includes(k))]
}
