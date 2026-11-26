// Банка с уроци — видове, предмети, възрасти и общи помощници

export const KINDS: Record<string, string> = {
  lesson: 'План на урок',
  presentation: 'Презентация',
  worksheet: 'Работен лист',
  game: 'Игра / упражнение',
  test: 'Проверка / тест',
  other: 'Друго',
}

export const SUBJECTS = [
  'Български език',
  'Математика',
  'Околен свят',
  'Изобразително изкуство',
  'Музика',
  'Технологии',
  'ФВС',
  'Социални умения',
  'Друго',
]

export const LEVELS: { key: string; label: string }[] = [
  { key: 'pg', label: 'ПГ' },
  { key: '1-4', label: 'I–IV клас' },
  { key: '5-7', label: 'V–VII клас' },
  { key: '8-12', label: 'VIII–XII клас' },
]

// Какво има в плана на урока — четирите заедно дават „Пълен урок“
export const CHECKS: { key: string; label: string }[] = [
  { key: 'goal', label: 'Цел' },
  { key: 'result', label: 'Очакван резултат' },
  { key: 'check', label: 'Проверка' },
  { key: 'learned', label: '„Какво научихме днес“' },
]

export type BankItem = {
  id: string; title: string; description: string | null; kind: string
  subjects: string[]; levels: string[]; checks: string[]; author_label: string | null
  file_path: string; file_name: string; mime_type: string | null; size: number | null
  uses_count: number; created_at: string
}

export const isFull = (i: { kind: string; checks: string[] }) =>
  i.kind === 'lesson' && CHECKS.every(c => i.checks.includes(c.key))

export const levelLabel = (k: string) => LEVELS.find(l => l.key === k)?.label || k
