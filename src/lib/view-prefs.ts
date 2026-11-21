// „Изглед“ — лични настройки на вида на ЕИС (само за този човек, на това устройство).
// Класическият изглед е по подразбиране; стъкленият е по желание. Логиката на системата не се пипа —
// всичко е атрибути на <html> + CSS в globals.css (html[data-ui="glass"] …).
export type ViewPrefs = {
  mode: 'classic' | 'glass'
  frost: number            // матовост на стъклото, px (0–24)
  solid: boolean           // плътни панели — без прозрачност
  text: 's' | 'm' | 'l'    // размер на съдържанието
  calm: boolean            // без анимации
}
export const VIEW_DEFAULT: ViewPrefs = { mode: 'classic', frost: 14, solid: false, text: 'm', calm: false }
export const VIEW_KEY = 'eis-view'
export const VIEW_EVENT = 'eis-view-change'

export function readView(): ViewPrefs {
  try { return { ...VIEW_DEFAULT, ...JSON.parse(localStorage.getItem(VIEW_KEY) || '{}') } } catch { return { ...VIEW_DEFAULT } }
}

export function applyView(p: ViewPrefs) {
  const el = document.documentElement
  el.dataset.ui = p.mode
  el.dataset.solid = p.solid ? '1' : '0'
  el.dataset.text = p.text
  el.dataset.calm = p.calm ? '1' : '0'
  el.style.setProperty('--frost', `${p.frost}px`)
}

export function saveView(p: ViewPrefs) {
  try { localStorage.setItem(VIEW_KEY, JSON.stringify(p)) } catch { /* пълна памет — важи само до презареждане */ }
  applyView(p)
  window.dispatchEvent(new Event(VIEW_EVENT))
}

// Пуска се в <head> преди първото изрисуване — за да няма „примигване“ от класически към стъклен.
export const VIEW_BOOT_SCRIPT = `try{var p=Object.assign(${JSON.stringify(VIEW_DEFAULT)},JSON.parse(localStorage.getItem('${VIEW_KEY}')||'{}'));var e=document.documentElement;e.dataset.ui=p.mode;e.dataset.solid=p.solid?'1':'0';e.dataset.text=p.text;e.dataset.calm=p.calm?'1':'0';e.style.setProperty('--frost',p.frost+'px')}catch(_){}`
