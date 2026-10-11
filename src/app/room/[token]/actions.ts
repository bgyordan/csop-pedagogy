'use server'

// Родителят пише под публикация: „Разбрахме“, „Не разбирам“, „Пратете отново“ или кратък въпрос.
// Без вход — проверява се личният линк (token) и че ОРЕС периодът е активен. До 20 съобщения на ден, до 500 знака.

import { createAdminClient } from '@/lib/supabase/admin'
import { activeOresByToken } from './lib'

const KINDS = ['ok', 'unclear', 'resend', 'text'] as const

export async function sendParentMessage(token: string, postId: string, kind: string, body: string) {
  if (!(KINDS as readonly string[]).includes(kind)) return { error: 'Невалидно съобщение' }
  const text = (body || '').trim().slice(0, 500)
  if (kind === 'text' && !text) return { error: 'Напишете въпроса си' }
  const db = createAdminClient()
  const ores = await activeOresByToken(db, token)
  if (!ores) return { error: 'Стаята не е активна' }

  const { data: post } = await db.from('online_room_posts').select('id').eq('id', postId).eq('ores_id', ores.id).is('hidden_at', null).maybeSingle()
  if (!post) return { error: 'Публикацията не е намерена' }

  const since = new Date(Date.now() - 24 * 3600 * 1000).toISOString()
  const { count } = await db.from('online_room_messages').select('id', { count: 'exact', head: true })
    .eq('ores_id', ores.id).eq('from_parent', true).gte('created_at', since)
  if ((count || 0) >= 20) return { error: 'Достигнат е лимитът за днес. Свържете се с учителя по телефона.' }

  const { error } = await db.from('online_room_messages').insert({
    post_id: postId, ores_id: ores.id, from_parent: true, kind, body: text || null,
  })
  if (error) return { error: 'Съобщението не беше изпратено' }
  return { ok: true }
}
