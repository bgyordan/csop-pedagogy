import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'
import { format } from 'date-fns'
import { bg } from 'date-fns/locale'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatDate(date: string | Date) {
  return format(new Date(date), 'dd.MM.yyyy', { locale: bg })
}

export function formatDateLong(date: string | Date) {
  return format(new Date(date), 'dd MMMM yyyy', { locale: bg })
}

export function getFullName(person: {
  first_name: string
  middle_name?: string | null
  last_name: string
}) {
  return [person.first_name, person.middle_name, person.last_name]
    .filter(Boolean)
    .join(' ')
}

export function getMonthName(month: number): string {
  const months = [
    'Януари', 'Февруари', 'Март', 'Април', 'Май', 'Юни',
    'Юли', 'Август', 'Септември', 'Октомври', 'Ноември', 'Декември'
  ]
  return months[month - 1] || ''
}

export function getDaysUntil(dateStr: string): number {
  const target = new Date(dateStr)
  const now = new Date()
  const diff = target.getTime() - now.getTime()
  return Math.ceil(diff / (1000 * 60 * 60 * 24))
}

export function getDeadlineColor(days: number): 'red' | 'yellow' | 'green' {
  if (days <= 7) return 'red'
  if (days <= 30) return 'yellow'
  return 'green'
}

export const MONTHS = [
  { value: 9, label: 'Септември' },
  { value: 10, label: 'Октомври' },
  { value: 11, label: 'Ноември' },
  { value: 12, label: 'Декември' },
  { value: 1, label: 'Януари' },
  { value: 2, label: 'Февруари' },
  { value: 3, label: 'Март' },
  { value: 4, label: 'Април' },
  { value: 5, label: 'Май' },
  { value: 6, label: 'Юни' },
]
