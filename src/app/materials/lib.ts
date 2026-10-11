// Материали — видове и общи помощници

export const KINDS: Record<string, string> = {
  worksheet: 'Работен лист',
  board: 'Табло',
  cards: 'Карти',
  game: 'Игра',
  story: 'Социална история',
  other: 'Друго',
}

export type Source = { id: string; name: string; allow_parents: boolean; valid_until: string | null; note: string | null; sort: number }
export type Material = {
  id: string; title: string; description: string | null; kind: string; areas: string[]; source_id: string | null
  file_path: string; file_name: string; mime_type: string | null; size: number | null; uploaded_by: string | null; created_at: string
}

export const isImage = (m: { mime_type: string | null; file_name: string }) =>
  (m.mime_type || '').startsWith('image/') || /\.(png|jpe?g|gif|webp)$/i.test(m.file_name)

// Източникът важи ли днес (празна дата = безсрочно)
export const sourceValid = (s: Source | undefined, today: string) => !s || !s.valid_until || s.valid_until >= today
