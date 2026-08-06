/** Deterministic daily challenge seed + personal best storage */

import { todayKey } from './math'
import type { CraftId } from './types'

const DAILY_KEY = 'zincir-drone-daily-v1'

export interface DailyBest {
  dayKey: string
  bestMultiplier: number
  bestLayer: number
  craftId: CraftId
}

/** Stable 32-bit hash */
export function hashSeed(str: string): number {
  let h = 2166136261
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

/** Mulberry32 PRNG */
export function createRng(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export function dailyChallengeSeed(day = todayKey(), craftId: CraftId = 'drone'): number {
  return hashSeed(`zincir-challenge-${day}-${craftId}`)
}

export function loadDailyBest(): DailyBest | null {
  try {
    const raw = localStorage.getItem(DAILY_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as DailyBest
    if (parsed.dayKey !== todayKey()) return null
    return parsed
  } catch {
    return null
  }
}

export function saveDailyBest(best: DailyBest): DailyBest {
  const prev = loadDailyBest()
  if (prev && prev.dayKey === best.dayKey && prev.bestMultiplier >= best.bestMultiplier) {
    return prev
  }
  localStorage.setItem(DAILY_KEY, JSON.stringify(best))
  return best
}

export function updateDailyBestFromFlight(
  multiplier: number,
  layer: number,
  craftId: CraftId,
  outcome: 'cashed' | 'crashed',
): DailyBest | null {
  // Only cashed runs count for daily board (survived & locked)
  if (outcome !== 'cashed' || multiplier <= 0) {
    return loadDailyBest()
  }
  return saveDailyBest({
    dayKey: todayKey(),
    bestMultiplier: multiplier,
    bestLayer: layer,
    craftId,
  })
}
