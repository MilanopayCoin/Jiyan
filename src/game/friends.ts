/** Friends roster + shareable pilot score cards (no backend). */

import type { LeaderboardEntry, PlayerProfile } from './types'

const FRIENDS_KEY = 'zincir-drone-friends-v1'
const PILOT_ID_KEY = 'zincir-drone-pilot-id'

export interface FriendCard {
  id: string
  name: string
  bestMultiplier: number
  bestLayer: number
  streak: number
  updatedAt: number
}

function b64urlEncode(bytes: Uint8Array): string {
  let bin = ''
  bytes.forEach((b) => {
    bin += String.fromCharCode(b)
  })
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function b64urlDecode(s: string): Uint8Array {
  const pad = s.length % 4 === 0 ? '' : '='.repeat(4 - (s.length % 4))
  const b64 = s.replace(/-/g, '+').replace(/_/g, '/') + pad
  const bin = atob(b64)
  const out = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
  return out
}

export function getOrCreatePilotId(): string {
  try {
    const existing = localStorage.getItem(PILOT_ID_KEY)
    if (existing && existing.length >= 6) return existing
  } catch {
    // ignore
  }
  const id = `p${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36).slice(-4)}`
  try {
    localStorage.setItem(PILOT_ID_KEY, id)
  } catch {
    // ignore
  }
  return id
}

export function profileToCard(profile: PlayerProfile): FriendCard {
  return {
    id: getOrCreatePilotId(),
    name: profile.displayName || 'Pilot',
    bestMultiplier: profile.bestMultiplier || 0,
    bestLayer: profile.bestLayer || 0,
    streak: profile.streak || 0,
    updatedAt: Date.now(),
  }
}

export function encodeFriendCode(card: FriendCard): string {
  const payload = {
    v: 1,
    id: card.id,
    n: card.name.slice(0, 16),
    m: Math.round(card.bestMultiplier * 1000) / 1000,
    l: card.bestLayer | 0,
    s: card.streak | 0,
    t: card.updatedAt,
  }
  const json = JSON.stringify(payload)
  const bytes = new TextEncoder().encode(json)
  return `ZD1.${b64urlEncode(bytes)}`
}

export function decodeFriendCode(raw: string): FriendCard | null {
  const trimmed = raw.trim()
  // Accept bare code, URL with ?f=, or full URL
  let code = trimmed
  try {
    if (trimmed.includes('://') || trimmed.startsWith('?') || trimmed.includes('f=')) {
      const url = trimmed.includes('://')
        ? new URL(trimmed)
        : new URL(trimmed, 'https://chaindrone.netlify.app/')
      code = url.searchParams.get('f') || url.searchParams.get('friend') || trimmed
    }
  } catch {
    // use as-is
  }

  const match = code.match(/ZD1\.([A-Za-z0-9_-]+)/)
  if (!match) return null
  try {
    const json = new TextDecoder().decode(b64urlDecode(match[1]))
    const p = JSON.parse(json) as {
      v?: number
      id?: string
      n?: string
      m?: number
      l?: number
      s?: number
      t?: number
    }
    if (!p.id || typeof p.n !== 'string') return null
    return {
      id: String(p.id).slice(0, 24),
      name: p.n.slice(0, 16) || 'Pilot',
      bestMultiplier: Math.max(0, Number(p.m) || 0),
      bestLayer: Math.max(0, Number(p.l) || 0),
      streak: Math.max(0, Number(p.s) || 0),
      updatedAt: Number(p.t) || Date.now(),
    }
  } catch {
    return null
  }
}

export function loadFriends(): FriendCard[] {
  try {
    const raw = localStorage.getItem(FRIENDS_KEY)
    if (!raw) return []
    const list = JSON.parse(raw) as FriendCard[]
    if (!Array.isArray(list)) return []
    return list.filter((f) => f && typeof f.id === 'string' && typeof f.name === 'string')
  } catch {
    return []
  }
}

export function saveFriends(friends: FriendCard[]): void {
  localStorage.setItem(FRIENDS_KEY, JSON.stringify(friends.slice(0, 40)))
}

/** Upsert friend; ignore self. Returns updated list. */
export function upsertFriend(card: FriendCard, selfId?: string): FriendCard[] {
  const me = selfId || getOrCreatePilotId()
  if (card.id === me) return loadFriends()
  const list = loadFriends()
  const idx = list.findIndex((f) => f.id === card.id)
  if (idx >= 0) {
    const prev = list[idx]
    // Keep newer card
    if (card.updatedAt >= (prev.updatedAt || 0)) list[idx] = card
  } else {
    list.push(card)
  }
  saveFriends(list)
  return list
}

export function removeFriend(id: string): FriendCard[] {
  const next = loadFriends().filter((f) => f.id !== id)
  saveFriends(next)
  return next
}

export function friendInviteUrl(card: FriendCard): string {
  const code = encodeFriendCode(card)
  const origin =
    typeof location !== 'undefined' ? location.origin + location.pathname : 'https://chaindrone.netlify.app/'
  const base = origin.endsWith('/') ? origin : `${origin}/`
  return `${base}?f=${encodeURIComponent(code)}`
}

export function friendsToEntries(friends: FriendCard[]): LeaderboardEntry[] {
  return friends.map((f) => ({
    id: f.id,
    name: f.name,
    bestMultiplier: f.bestMultiplier,
    bestLayer: f.bestLayer,
    streak: f.streak,
  }))
}

/** Import from current URL query once. */
export function consumeFriendFromUrl(): FriendCard | null {
  if (typeof location === 'undefined') return null
  try {
    const url = new URL(location.href)
    const raw = url.searchParams.get('f') || url.searchParams.get('friend')
    if (!raw) return null
    const card = decodeFriendCode(raw)
    if (card) upsertFriend(card)
    url.searchParams.delete('f')
    url.searchParams.delete('friend')
    const clean = url.pathname + (url.searchParams.toString() ? `?${url.searchParams}` : '') + url.hash
    history.replaceState(null, '', clean)
    return card
  } catch {
    return null
  }
}
