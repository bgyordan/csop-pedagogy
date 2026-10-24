// „Подреди таблото“ — всеки сам избира с отметка кои карти да стоят на началната страница.
// Изборът се пази в бисквитка за този служител (на това устройство); без избор важат стойностите по роля.
export type DashWidget = { key: string; label: string; hint?: string; roles?: string[]; notRoles?: string[] }

export const DASH_WIDGETS: DashWidget[] = [
  { key: 'calendar', label: 'Моята седмица (календар)', hint: 'събития, срокове, покани' },
  { key: 'nonschool', label: 'Неучебен ден', hint: 'известие за спонтанен неучебен ден' },
  { key: 'visit', label: 'Посещения на час', hint: 'избор на ден при отворена проверка' },
  { key: 'control', label: 'Контролна дейност', hint: 'протоколи за запознаване' },
  { key: 'duty', label: 'Дежурства', hint: 'дежурните тази седмица' },
  { key: 'council', label: 'За съгласуване', hint: 'материали за предстоящ съвет' },
  { key: 'facilities', label: 'Материална база', hint: 'нови сигнали и отговори' },
  { key: 'ores', label: 'Онлайн стаи (ОРЕС)', notRoles: ['secretary', 'support'] },
  { key: 'classroom', label: 'Онлайн стаи на паралелките', notRoles: ['secretary', 'support'] },
  { key: 'absent', label: 'Отсъстващи деца', notRoles: ['secretary', 'support'] },
  { key: 'todayAbsent', label: 'Днес отсъстват (колеги)', notRoles: ['admin', 'zdud', 'director'] },
  { key: 'shared', label: 'Споделено от колеги', hint: 'файлове и публикации за сайта', roles: ['secretary'] },
]

// по подразбиране скрито (докато човек сам не избере)
const DEFAULT_HIDDEN: Record<string, string[]> = {
  secretary: ['calendar'],
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
