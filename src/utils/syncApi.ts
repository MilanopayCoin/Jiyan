/** Client for Netlify /api/sync (Neon-backed pilot scores) */

import { getOrCreatePilotId, type FriendCard } from '../game/friends'
import type { PlayerProfile } from '../game/types'
import { loadDailyBest } from '../game/challenge'
import { todayKey } from '../game/math'

const BASE = (import.meta.env.VITE_SYNC_API as string | undefined) || '/api'

export interface RemotePilot {
  id: string
  name: string
  best_multiplier: number
  best_layer: number
  streak: number
  daily_best: number
  daily_layer: number
  day_key: string | null
  updated_at?: string
}

function mapPilot(p: RemotePilot): FriendCard {
  return {
    id: p.id,
    name: p.name,
    bestMultiplier: Number(p.best_multiplier) || 0,
    bestLayer: Number(p.best_layer) || 0,
    streak: Number(p.streak) || 0,
    updatedAt: p.updated_at ? Date.parse(p.updated_at) : Date.now(),
  }
}

export async function pushScore(profile: PlayerProfile): Promise<boolean> {
  const daily = loadDailyBest()
  const day = todayKey()
  try {
    const res = await fetch(`${BASE}/sync`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: getOrCreatePilotId(),
        name: profile.displayName,
        bestMultiplier: profile.bestMultiplier,
        bestLayer: profile.bestLayer,
        streak: profile.streak,
        dailyBest: daily?.dayKey === day ? daily.bestMultiplier : 0,
        dailyLayer: daily?.dayKey === day ? daily.bestLayer : 0,
        dayKey: day,
      }),
    })
    return res.ok
  } catch {
    return false
  }
}

export async function fetchFriendsRemote(ids: string[]): Promise<FriendCard[]> {
  if (ids.length === 0) return []
  try {
    const res = await fetch(
      `${BASE}/sync?ids=${encodeURIComponent(ids.join(','))}`,
    )
    if (!res.ok) return []
    const data = (await res.json()) as { pilots?: RemotePilot[] }
    return (data.pilots ?? []).map(mapPilot)
  } catch {
    return []
  }
}

export async function fetchDailyRemote(day = todayKey()): Promise<FriendCard[]> {
  try {
    const res = await fetch(`${BASE}/sync?daily=${encodeURIComponent(day)}`)
    if (!res.ok) return []
    const data = (await res.json()) as { pilots?: RemotePilot[] }
    return (data.pilots ?? []).map((p) => ({
      id: p.id,
      name: p.name,
      bestMultiplier: Number(p.daily_best) || 0,
      bestLayer: Number(p.daily_layer) || 0,
      streak: Number(p.streak) || 0,
      updatedAt: p.updated_at ? Date.parse(p.updated_at) : Date.now(),
    }))
  } catch {
    return []
  }
}

export async function fetchTopRemote(): Promise<FriendCard[]> {
  try {
    const res = await fetch(`${BASE}/sync?top=1`)
    if (!res.ok) return []
    const data = (await res.json()) as { pilots?: RemotePilot[] }
    return (data.pilots ?? []).map(mapPilot)
  } catch {
    return []
  }
}
