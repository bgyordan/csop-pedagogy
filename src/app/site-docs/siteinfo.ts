// Данните на сайта от ЕИС → Сайт → Настройки (site_settings.site_info). Без 'use client' — ползва се и от сървъра.
export interface SiteInfo {
  notice: { on: boolean; text: string; link: string; until: string }
  contact: { address: string; city: string; email: string; phone: string; facebook: string }
  hours: { center: string; admin: string; director: string }
  phones: { name: string; role: string; phone: string }[]
  bank: { to: string; iban: string; bic: string; reason: string }
  signali: { person: string; email: string; phone: string }
}
export const EMPTY_INFO: SiteInfo = {
  notice: { on: false, text: '', link: '', until: '' },
  contact: { address: '', city: '', email: '', phone: '', facebook: '' },
  hours: { center: '', admin: '', director: '' },
  phones: [],
  bank: { to: '', iban: '', bic: '', reason: '' },
  signali: { person: '', email: '', phone: '' },
}
// попълва липсващите полета, за да не гърми формата при стари данни
export function normalizeInfo(v: unknown): SiteInfo {
  const o = (v && typeof v === 'object' ? v : {}) as Partial<SiteInfo>
  return {
    notice: { ...EMPTY_INFO.notice, ...(o.notice || {}) },
    contact: { ...EMPTY_INFO.contact, ...(o.contact || {}) },
    hours: { ...EMPTY_INFO.hours, ...(o.hours || {}) },
    phones: Array.isArray(o.phones) ? o.phones.map((p) => ({ name: p?.name || '', role: p?.role || '', phone: p?.phone || '' })) : [],
    bank: { ...EMPTY_INFO.bank, ...(o.bank || {}) },
    signali: { ...EMPTY_INFO.signali, ...(o.signali || {}) },
  }
}

