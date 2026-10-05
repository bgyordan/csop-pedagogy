// Материална база — общи видове, статуси и кой движи сигналите.
import { DoorClosed, Armchair, PlugZap, Droplets, Flame, Monitor, Wrench } from 'lucide-react'

export type IssueStatus = 'new' | 'accepted' | 'done' | 'cannot'
export interface Issue {
  id: string; reporter_id: string | null; room: string; category: string; description: string
  urgent: boolean; photo_path: string | null; status: IssueStatus; reply: string | null
  handled_by: string | null; resolved_at: string | null; reporter_seen_at: string | null
  created_at: string; updated_at: string
}
export interface IssueEvent { id: string; issue_id: string; author_id: string | null; kind: 'status' | 'comment' | 'reopen'; status: string | null; body: string | null; created_at: string }

export const CATEGORIES = [
  { key: 'door', label: 'Врата / брава', icon: DoorClosed },
  { key: 'furniture', label: 'Мебели', hint: 'чин, стол, шкаф', icon: Armchair },
  { key: 'electric', label: 'Ел. / осветление', hint: 'контакт, лампа', icon: PlugZap },
  { key: 'water', label: 'ВиК', hint: 'кран, тоалетна', icon: Droplets },
  { key: 'heating', label: 'Отопление', hint: 'радиатор, климатик', icon: Flame },
  { key: 'tech', label: 'Техника', hint: 'компютър, принтер, интернет', icon: Monitor },
  { key: 'other', label: 'Друго', icon: Wrench },
] as const
export const catMeta = (k: string) => CATEGORIES.find(c => c.key === k) || CATEGORIES[CATEGORIES.length - 1]

export const STATUS: Record<IssueStatus, { label: string; cls: string; dot: string }> = {
  new: { label: 'Нов', cls: 'bg-amber-50 text-amber-800 border-amber-200', dot: 'bg-amber-400' },
  accepted: { label: 'Приет', cls: 'bg-sky-50 text-sky-800 border-sky-200', dot: 'bg-sky-400' },
  done: { label: 'Поправено', cls: 'bg-emerald-50 text-emerald-800 border-emerald-200', dot: 'bg-emerald-500' },
  cannot: { label: 'Не може засега', cls: 'bg-slate-100 text-slate-700 border-slate-300', dot: 'bg-slate-400' },
}

/** Кой движи сигналите: админ, ЗДУД, директор и деловодството (технически секретар, без ЗАС) */
export const isFacilityHandler = (p: { role?: string | null; position?: string | null } | null | undefined) =>
  ['admin', 'zdud', 'director'].includes(p?.role || '') ||
  (p?.role === 'secretary' && /секретар|деловод/i.test(p?.position || '') && !/ЗАС|завеждащ/i.test(p?.position || ''))
