'use server'

// Родителят пише под публикация: „Разбрахме“, „Не разбирам“, „Пратете отново“ или кратък въпрос.
// Без вход — проверява се личният линк (token) и че стаята е активна. До 20 съобщения на ден, до 500 знака.
// Линкът може да е от личната ОРЕС стая или от стаята на паралелката (тогава въпросът е видим само за учителите
// и за този родител — другите родители не го виждат).

import { createAdminClient } from '@/lib/supabase/admin'
import { activeOresByToken, activeMemberByToken } from './lib'

const KINDS = ['ok', 'unclear', 'resend', 'text'] as const
const LIMIT_MSG = 'Достигнат е лимитът за днес. Свържете се с учителя по телефона.'

export async function sendParentMessage(token: string, postId: string, kind: string, body: string) {
  if (!(KINDS as readonly string[]).includes(kind)) return { error: 'Невалидно съобщение' }
  const text = (body || '').trim().slice(0, 500)
  if (kind === 'text' && !text) return { error: 'Напишете въпроса си' }
  const db = createAdminClient()
  const since = new Date(Date.now() - 24 * 3600 * 1000).toISOString()

  const ores = await activeOresByToken(db, token)
  if (ores) {
    const { data: post } = await db.from('online_room_posts').select('id').eq('id', postId).eq('ores_id', ores.id).is('hidden_at', null).maybeSingle()
    if (!post) return { error: 'Публикацията не е намерена' }
    const { count } = await db.from('online_room_messages').select('id', { count: 'exact', head: true })
      .eq('ores_id', ores.id).eq('from_parent', true).gte('created_at', since)
    if ((count || 0) >= 20) return { error: LIMIT_MSG }
    const { error } = await db.from('online_room_messages').insert({
      post_id: postId, ores_id: ores.id, from_parent: true, kind, body: text || null,
    })
    if (error) return { error: 'Съобщението не беше изпратено' }
    return { ok: true }
  }

  // стаята на паралелката: публикацията трябва да е за цялата паралелка или точно за това дете
  const member = await activeMemberByToken(db, token)
  if (!member) return { error: 'Стаята не е активна' }
  const { data: post } = await db.from('class_room_posts').select('id, student_id')
    .eq('id', postId).eq('room_id', member.roomId).is('hidden_at', null).maybeSingle()
  if (!post || (post.student_id && post.student_id !== member.studentId)) return { error: 'Публикацията не е намерена' }
  const { count } = await db.from('class_room_messages').select('id', { count: 'exact', head: true })
    .eq('member_id', member.memberId).eq('from_parent', true).gte('created_at', since)
  if ((count || 0) >= 20) return { error: LIMIT_MSG }
  const { error } = await db.from('class_room_messages').insert({
    post_id: postId, room_id: member.roomId, member_id: member.memberId, from_parent: true, kind, body: text || null,
  })
  if (error) return { error: 'Съобщението не беше изпратено' }
  return { ok: true }
}
