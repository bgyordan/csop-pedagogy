'use client'
// „Любими“ и „Последно отваряни“. Промяна в един компонент се вижда веднага и в другите.
// Любимите се пазят и в базата (user_favorites) — еднакви са на всяко устройство; браузърът държи копие,
// за да се покажат веднага. Без SQL файла 2026-11-10_user_favorites.sql работят само в браузъра, както досега.
// „Последно отваряни“ остават само в браузъра.
import { useCallback, useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

export type NavEntry = { href: string; label: string; group?: string }

const FAV_KEY = 'eis-favorites'
const RECENT_KEY = 'eis-recent'
const OWNER_KEY = 'eis-favorites-owner'
const EVT = 'eis-nav-memory'

function read(key: string): NavEntry[] {
  try { const v = JSON.parse(localStorage.getItem(key) || '[]'); return Array.isArray(v) ? v : [] } catch { return [] }
}
function write(key: string, list: NavEntry[]) {
  try { localStorage.setItem(key, JSON.stringify(list)) } catch {}
  window.dispatchEvent(new Event(EVT))
}

// ── Любими в базата ──
const clean = (v: unknown): NavEntry[] => Array.isArray(v)
  ? v.filter((x: any) => x && typeof x.href === 'string' && x.href.startsWith('/') && typeof x.label === 'string')
      .map((x: any) => ({ href: x.href, label: x.label })).slice(0, 12)
  : []
let pulled: Promise<void> | null = null
let dbOff = false   // таблицата я няма или няма връзка — само браузърът
async function pushFavorites(list: NavEntry[]) {
  if (dbOff) return
  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { error } = await supabase.from('user_favorites')
      .upsert({ user_id: user.id, items: list, updated_at: new Date().toISOString() }, { onConflict: 'user_id' })
    if (error) dbOff = true
  } catch { dbOff = true }
}
// Веднъж на зареждане: базата е водеща; ако там още няма ред, качва се това от браузъра
function pullFavorites() {
  if (pulled) return pulled
  pulled = (async () => {
    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data, error } = await supabase.from('user_favorites').select('items').eq('user_id', user.id).maybeSingle()
      if (error) { dbOff = true; return }
      // общ компютър: любимите в браузъра може да са на предишния влязъл колега — не се качват на чуждо име
      let owner: string | null = null
      try { owner = localStorage.getItem(OWNER_KEY); localStorage.setItem(OWNER_KEY, user.id) } catch {}
      if (owner && owner !== user.id && !data) { write(FAV_KEY, []); return }
      if (data) {
        const remote = clean(data.items)
        if (JSON.stringify(remote) !== JSON.stringify(read(FAV_KEY))) write(FAV_KEY, remote)
      } else {
        const local = clean(read(FAV_KEY))
        if (local.length) await pushFavorites(local)
      }
    } catch { dbOff = true }
  })()
  return pulled
}

function useStored(key: string) {
  const [list, setList] = useState<NavEntry[]>([])
  useEffect(() => {
    const sync = () => setList(read(key))
    sync()
    window.addEventListener(EVT, sync)
    window.addEventListener('storage', sync)
    return () => { window.removeEventListener(EVT, sync); window.removeEventListener('storage', sync) }
  }, [key])
  return list
}

export function useFavorites() {
  const favorites = useStored(FAV_KEY)
  useEffect(() => { pullFavorites() }, [])
  const isFav = useCallback((href: string) => favorites.some(f => f.href === href), [favorites])
  const toggle = useCallback((e: NavEntry) => {
    const cur = read(FAV_KEY)
    const next = cur.some(f => f.href === e.href) ? cur.filter(f => f.href !== e.href) : [...cur, { href: e.href, label: e.label }].slice(0, 12)
    write(FAV_KEY, next)
    pushFavorites(next)
  }, [])
  return { favorites, isFav, toggle }
}

export function useRecent() {
  return { recent: useStored(RECENT_KEY) }
}

export function rememberVisit(e: NavEntry) {
  if (typeof window === 'undefined') return
  const cur = read(RECENT_KEY).filter(r => r.href !== e.href)
  write(RECENT_KEY, [{ href: e.href, label: e.label }, ...cur].slice(0, 12))
}
