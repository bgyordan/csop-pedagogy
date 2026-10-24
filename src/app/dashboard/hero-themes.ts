// Цветът на хедъра „Добре дошли…“ на началната страница — всеки си избира в „Подреди таблото“.
// Класовете са тук (в src/app), за да ги вижда Tailwind. Пази се в бисквитка за служителя.
export type HeroTheme = { key: string; label: string; bg: string; swatch: string; dark: boolean }

export const HERO_THEMES: HeroTheme[] = [
  { key: 'teal', label: 'Синьо-зелено', bg: 'bg-gradient-to-r from-teal-600 to-cyan-600', swatch: 'bg-gradient-to-r from-teal-600 to-cyan-600', dark: true },
  { key: 'ocean', label: 'Море', bg: 'bg-gradient-to-r from-sky-600 to-indigo-600', swatch: 'bg-gradient-to-r from-sky-600 to-indigo-600', dark: true },
  { key: 'navy', label: 'Тъмносиньо', bg: 'bg-gradient-to-br from-[#0f2240] via-[#1a3660] to-[#2b5a8f]', swatch: 'bg-gradient-to-br from-[#0f2240] to-[#2b5a8f]', dark: true },
  { key: 'violet', label: 'Лилаво', bg: 'bg-gradient-to-r from-violet-600 to-fuchsia-500', swatch: 'bg-gradient-to-r from-violet-600 to-fuchsia-500', dark: true },
  { key: 'sunset', label: 'Залез', bg: 'bg-gradient-to-r from-orange-500 to-rose-500', swatch: 'bg-gradient-to-r from-orange-500 to-rose-500', dark: true },
  { key: 'forest', label: 'Зелено', bg: 'bg-gradient-to-r from-emerald-600 to-lime-600', swatch: 'bg-gradient-to-r from-emerald-600 to-lime-600', dark: true },
  { key: 'light', label: 'Светло', bg: 'bg-gradient-to-br from-teal-50 via-white to-cyan-50/70 border border-teal-100', swatch: 'bg-gradient-to-br from-teal-50 to-cyan-100 border border-teal-200', dark: false },
]

export const heroCookie = (staffId: string) => `eis_hero_${staffId}`
export const heroTheme = (key?: string | null) => HERO_THEMES.find(t => t.key === key) || HERO_THEMES[0]
