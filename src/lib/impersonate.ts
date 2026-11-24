// „Влез като…“ — админът отваря ИСТИНСКА сесия на друг служител (за проверка как работи системата при него).
// Всичко, което се запише по време на нея, е реално от името на колегата.
// Бисквитки:
//   eis_imp      = "<до кога, ms>.<user_id на колегата>"  — че сме в този режим
//   eis_imp_back = refresh token-ът на админа             — за връщане без ново влизане
export const IMP_COOKIE = 'eis_imp'
export const IMP_BACK_COOKIE = 'eis_imp_back'
export const IMP_MINUTES = 60

// Кой може „Виж като / Влез като“ и като кого: админът — като всеки освен друг админ;
// ЗДУД — като колегите си (не като админ, директор или друг ЗДУД)
export const VIEW_AS_ROLES = ['admin', 'zdud']
export const canViewAs = (role?: string | null) => VIEW_AS_ROLES.includes(role || '')
// mode 'view' = само меню и табло (админът може и като друг админ); 'login' = истинска сесия
export function viewAsBlocked(myRole?: string | null, targetRole?: string | null, mode: 'view' | 'login' = 'login'): boolean {
  if (myRole === 'admin') return mode === 'login' && targetRole === 'admin'
  if (myRole === 'zdud') return ['admin', 'director', 'zdud'].includes(targetRole || '')
  return true
}

export function parseImp(v?: string | null): { until: number; targetUserId: string } | null {
  if (!v) return null
  const i = v.indexOf('.')
  if (i < 1) return null
  const until = Number(v.slice(0, i))
  const targetUserId = v.slice(i + 1)
  if (!Number.isFinite(until) || !targetUserId) return null
  return { until, targetUserId }
}
