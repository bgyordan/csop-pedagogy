'use client'
// „Любими“ и „Последно отваряни“ — пазят се в браузъра (за всяко устройство поотделно),
// без нищо в базата. Промяна в един компонент се вижда веднага и в другите.
import { useCallback, useEffect, useState } from 'react'

export type NavEntry = { href: string; label: string; group?: string }

const FAV_KEY = 'eis-favorites'
const RECENT_KEY = 'eis-recent'
const EVT = 'eis-nav-memory'

function read(key: string): NavEntry[] {
  try { const v = JSON.parse(localStorage.getItem(key) || '[]'); return Array.isArray(v) ? v : [] } catch { return [] }
}
function write(key: string, list: NavEntry[]) {
  try { localStorage.setItem(key, JSON.stringify(list)) } catch {}
  window.dispatchEvent(new Event(EVT))
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
  const isFav = useCallback((href: string) => favorites.some(f => f.href === href), [favorites])
  const toggle = useCallback((e: NavEntry) => {
    const cur = read(FAV_KEY)
    write(FAV_KEY, cur.some(f => f.href === e.href) ? cur.filter(f => f.href !== e.href) : [...cur, { href: e.href, label: e.label }].slice(0, 12))
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
