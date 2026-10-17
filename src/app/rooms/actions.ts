'use server'

// Стаи на паралелките — действията на управата и класния.
//  • openClassRooms: отваря стая за избраните паралелки за период; всяко активно дете в паралелката получава личен линк.
//  • closeClassRoom / reopenClassRoom: затваря днес (линковете спират веднага) / връща предишната крайна дата.
//  • deleteEmptyRoom: стая, отворена по грешка — само ако още няма публикации.
//  • syncMembers: добавя деца, записани в паралелката след отварянето.
//  • stopLink / newLink: спира линка на едно дете / дава нов (старият спира да работи).
// Правата пази базата (RLS) — тук само проверките, които правят съобщенията разбираеми.

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { isManagerRole } from '@/lib/class-rooms'
import { todaySofia } from '@/lib/ores'

async function me() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { supabase, profile: null }
  const { data: profile } = await supabase.from('staff_profiles').select('id, role').eq('user_id', user.id).single()
  return { supabase, profile }
}

// активните деца, записани в паралелката за годината
async function classKids(supabase: any, classId: string, yearId: string | null) {
  let q = supabase.from('student_enrollments').select('student_id, student:students(status)').eq('class_id', classId)
  if (yearId) q = q.eq('academic_year_id', yearId)
  const { data } = await q
  return ((data || []) as any[]).filter(e => e.student?.status === 'active').map(e => e.student_id as string)
}

export async function openClassRooms(classIds: string[], from: string, to: string, reason: string) {
  const { supabase, profile } = await me()
  if (!profile || !isManagerRole(profile.role)) return { error: 'Стаи отваря само ръководството' }
  if (!classIds.length) return { error: 'Изберете поне една паралелка' }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to)) return { error: 'Изберете начална и крайна дата' }
  if (to < from) return { error: 'Крайната дата е преди началната' }

  const { data: year } = await supabase.from('academic_years').select('id').eq('is_current', true).single()
  // паралелки, които вече имат отворена стая, застъпваща периода — прескачат се
  const { data: existing } = await supabase.from('class_rooms').select('class_id')
    .in('class_id', classIds).is('closed_at', null).lte('from_date', to).gte('to_date', from)
  const busy = new Set((existing || []).map((r: any) => r.class_id))
  const todo = classIds.filter(id => !busy.has(id))

  let opened = 0
  for (const classId of todo) {
    const { data: room, error } = await supabase.from('class_rooms').insert({
      class_id: classId, academic_year_id: year?.id || null, from_date: from, to_date: to,
      reason: reason.trim() || null, created_by: profile.id,
    }).select('id').single()
    if (error || !room) return { error: 'Грешка при отваряне: ' + (error?.message || ''), opened }
    const kids = await classKids(supabase, classId, year?.id || null)
    if (kids.length) {
      const { error: e2 } = await supabase.from('class_room_members').insert(kids.map(student_id => ({ room_id: room.id, student_id })))
      if (e2) return { error: 'Стаята е отворена, но линковете не се създадоха: ' + e2.message, opened }
    }
    opened++
  }
  revalidatePath('/rooms')
  revalidatePath('/dashboard')
  return { ok: true, opened, skipped: busy.size }
}

export async function closeClassRoom(roomId: string) {
  const { supabase, profile } = await me()
  if (!profile || !isManagerRole(profile.role)) return { error: 'Стая затваря само ръководството' }
  const { data: r } = await supabase.from('class_rooms').select('to_date').eq('id', roomId).single()
  if (!r) return { error: 'Стаята не е намерена' }
  const today = todaySofia()
  const { error } = await supabase.from('class_rooms').update({
    closed_at: new Date().toISOString(), closed_by: profile.id,
    to_date_before_close: r.to_date, to_date: r.to_date > today ? today : r.to_date,
  }).eq('id', roomId)
  if (error) return { error: error.message }
  revalidatePath('/rooms'); revalidatePath(`/rooms/${roomId}`); revalidatePath('/dashboard')
  return { ok: true }
}

export async function reopenClassRoom(roomId: string) {
  const { supabase, profile } = await me()
  if (!profile || !isManagerRole(profile.role)) return { error: 'Стая отваря само ръководството' }
  const { data: r } = await supabase.from('class_rooms').select('to_date, to_date_before_close').eq('id', roomId).single()
  if (!r) return { error: 'Стаята не е намерена' }
  const { error } = await supabase.from('class_rooms').update({
    closed_at: null, closed_by: null, to_date: r.to_date_before_close || r.to_date, to_date_before_close: null,
  }).eq('id', roomId)
  if (error) return { error: error.message }
  revalidatePath('/rooms'); revalidatePath(`/rooms/${roomId}`); revalidatePath('/dashboard')
  return { ok: true }
}

// Промяна на крайната дата (напр. ваканцията е удължена)
export async function extendClassRoom(roomId: string, to: string) {
  const { supabase, profile } = await me()
  if (!profile || !isManagerRole(profile.role)) return { error: 'Само ръководството' }
  const { data: r } = await supabase.from('class_rooms').select('from_date').eq('id', roomId).single()
  if (!r) return { error: 'Стаята не е намерена' }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(to) || to < r.from_date) return { error: 'Крайната дата е преди началната' }
  const { error } = await supabase.from('class_rooms').update({ to_date: to }).eq('id', roomId)
  if (error) return { error: error.message }
  revalidatePath('/rooms'); revalidatePath(`/rooms/${roomId}`)
  return { ok: true }
}

export async function deleteEmptyRoom(roomId: string) {
  const { supabase, profile } = await me()
  if (!profile || !isManagerRole(profile.role)) return { error: 'Само ръководството' }
  const { count } = await supabase.from('class_room_posts').select('id', { count: 'exact', head: true }).eq('room_id', roomId)
  if (count) return { error: 'В стаята има публикации — тя е доказателство и не се трие. Затворете я.' }
  const { error } = await supabase.from('class_rooms').delete().eq('id', roomId)
  if (error) return { error: error.message }
  revalidatePath('/rooms'); revalidatePath('/dashboard')
  return { ok: true }
}

export async function syncMembers(roomId: string) {
  const { supabase, profile } = await me()
  if (!profile) return { error: 'Не сте влезли' }
  const { data: r } = await supabase.from('class_rooms').select('class_id, academic_year_id').eq('id', roomId).single()
  if (!r) return { error: 'Стаята не е намерена' }
  const kids = await classKids(supabase, r.class_id, r.academic_year_id)
  const { data: have } = await supabase.from('class_room_members').select('student_id').eq('room_id', roomId)
  const has = new Set((have || []).map((m: any) => m.student_id))
  const add = kids.filter(k => !has.has(k))
  if (!add.length) return { ok: true, added: 0 }
  const { error } = await supabase.from('class_room_members').insert(add.map(student_id => ({ room_id: roomId, student_id })))
  if (error) return { error: error.message.includes('row-level') ? 'Децата добавя класният или ръководството' : error.message }
  revalidatePath(`/rooms/${roomId}`)
  return { ok: true, added: add.length }
}

export async function stopLink(memberId: string, roomId: string) {
  const { supabase } = await me()
  const { data, error } = await supabase.from('class_room_members').update({ revoked_at: new Date().toISOString() }).eq('id', memberId).select('id')
  if (error || !data?.length) return { error: 'Линкове спира класният или ръководството' }
  revalidatePath(`/rooms/${roomId}`)
  return { ok: true }
}

export async function newLink(memberId: string, roomId: string) {
  const { supabase } = await me()
  const { data, error } = await supabase.from('class_room_members')
    .update({ token: crypto.randomUUID(), revoked_at: null }).eq('id', memberId).select('id')
  if (error || !data?.length) return { error: 'Нов линк дава класният или ръководството' }
  revalidatePath(`/rooms/${roomId}`)
  return { ok: true }
}
