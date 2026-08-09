import { getOrCreatePilotId, type FriendCard } from '../game/friends'
import type { PlayerProfile } from '../game/types'
import { loadWeeklyBest, weekKey, type WeeklyBest } from '../game/season'

const BASE = (import.meta.env.VITE_SYNC_API as string | undefined) || '/api'

export async function pushWeeklyScore(
  profile: PlayerProfile,
  weekly?: WeeklyBest | null,
): Promise<boolean> {
  const w = weekly ?? loadWeeklyBest()
  const wk = weekKey()
  if (!w || w.weekKey !== wk) return false
  try {
    const res = await fetch(`${BASE}/league?week=${encodeURIComponent(wk)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        weekKey: wk,
        pilotId: getOrCreatePilotId(),
        name: profile.displayName,
        bestMultiplier: w.bestMultiplier,
        bestLayer: w.bestLayer,
        flights: w.flights,
      }),
    })
    return res.ok
  } catch {
    return false
  }
}

export async function fetchWeeklyRemote(
  wk = weekKey(),
): Promise<(FriendCard & { rank?: number })[]> {
  try {
    const res = await fetch(`${BASE}/league?week=${encodeURIComponent(wk)}`)
    if (!res.ok) return []
    const data = (await res.json()) as {
      pilots?: Array<{
        id: string
        name: string
        bestMultiplier: number
        bestLayer: number
        streak: number
        rank?: number
        updatedAt?: number
      }>
    }
    return (data.pilots ?? []).map((p) => ({
      id: p.id,
      name: p.name,
      bestMultiplier: p.bestMultiplier,
      bestLayer: p.bestLayer,
      streak: p.streak,
      rank: p.rank,
      updatedAt: p.updatedAt || Date.now(),
    }))
  } catch {
    return []
  }
}
