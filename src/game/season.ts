/** Haftalık lig + season pass (skin fragments). */

import type { CraftSkinId, PlayerProfile } from './types'
import { todayKey } from './math'

const WEEKLY_KEY = 'zincir-drone-weekly-v1'
const SEASON_KEY = 'zincir-drone-season-v1'

export interface WeeklyBest {
  weekKey: string
  bestMultiplier: number
  bestLayer: number
  flights: number
  craftId?: string
}

export interface SeasonState {
  weekKey: string
  xp: number
  /** Claimed pass tier ids */
  claimed: number[]
  /** Skin fragment counts */
  fragments: Partial<Record<CraftSkinId, number>>
  /** Last week we awarded top-10 local prize */
  lastRewardWeek: string | null
}

export interface PassTier {
  id: number
  xp: number
  label: string
  fragment?: CraftSkinId
  fragmentCount: number
  credits?: number
}

export const PASS_TIERS: PassTier[] = [
  { id: 1, xp: 50, label: 'Fragment I', fragment: 'drone-gold', fragmentCount: 1 },
  { id: 2, xp: 120, label: '2 pil', fragmentCount: 0, credits: 2 },
  { id: 3, xp: 200, label: 'Fragment II', fragment: 'rocket-night', fragmentCount: 1 },
  { id: 4, xp: 320, label: '3 pil', fragmentCount: 0, credits: 3 },
  { id: 5, xp: 450, label: 'Altın shard', fragment: 'drone-gold', fragmentCount: 2 },
]

/** Fragments needed to unlock a skin */
export const FRAGMENTS_TO_UNLOCK = 3

export function weekKey(d = new Date()): string {
  // ISO week: YYYY-Www
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()))
  const day = date.getUTCDay() || 7
  date.setUTCDate(date.getUTCDate() + 4 - day)
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1))
  const week = Math.ceil(((date.getTime() - yearStart.getTime()) / 86400000 + 1) / 7)
  return `${date.getUTCFullYear()}-W${String(week).padStart(2, '0')}`
}

export function weeklySeed(craftId: string, wk = weekKey()): string {
  return `zincir-week-${wk}-${craftId}`
}

export function loadWeeklyBest(): WeeklyBest | null {
  try {
    const raw = localStorage.getItem(WEEKLY_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as WeeklyBest
    if (parsed.weekKey !== weekKey()) return null
    return parsed
  } catch {
    return null
  }
}

export function saveWeeklyBest(best: WeeklyBest): WeeklyBest {
  localStorage.setItem(WEEKLY_KEY, JSON.stringify(best))
  return best
}

export function updateWeeklyFromFlight(
  multiplier: number,
  layer: number,
  craftId: string,
  outcome: 'cashed' | 'crashed',
): WeeklyBest {
  const wk = weekKey()
  const prev = loadWeeklyBest()
  const base: WeeklyBest =
    prev && prev.weekKey === wk
      ? prev
      : { weekKey: wk, bestMultiplier: 0, bestLayer: 0, flights: 0 }
  const next: WeeklyBest = {
    weekKey: wk,
    flights: base.flights + 1,
    bestMultiplier:
      outcome === 'cashed'
        ? Math.max(base.bestMultiplier, multiplier)
        : base.bestMultiplier,
    bestLayer: Math.max(base.bestLayer, layer),
    craftId,
  }
  return saveWeeklyBest(next)
}

export function defaultSeason(): SeasonState {
  return {
    weekKey: weekKey(),
    xp: 0,
    claimed: [],
    fragments: {},
    lastRewardWeek: null,
  }
}

export function loadSeason(): SeasonState {
  try {
    const raw = localStorage.getItem(SEASON_KEY)
    if (!raw) return defaultSeason()
    const parsed = JSON.parse(raw) as SeasonState
    if (parsed.weekKey !== weekKey()) {
      // Soft reset XP progress each ISO week; keep fragments
      return {
        ...defaultSeason(),
        fragments: parsed.fragments || {},
        lastRewardWeek: parsed.lastRewardWeek ?? null,
      }
    }
    return {
      ...defaultSeason(),
      ...parsed,
      fragments: parsed.fragments || {},
      claimed: Array.isArray(parsed.claimed) ? parsed.claimed : [],
    }
  } catch {
    return defaultSeason()
  }
}

export function saveSeason(s: SeasonState): void {
  localStorage.setItem(SEASON_KEY, JSON.stringify(s))
}

/** XP from a weekly-league flight */
export function xpForWeeklyFlight(
  outcome: 'cashed' | 'crashed',
  multiplier: number,
  layer: number,
): number {
  if (outcome === 'crashed') return 5 + layer * 2
  return 15 + Math.floor(multiplier * 8) + layer * 3
}

export function grantSeasonXp(amount: number): SeasonState {
  const s = loadSeason()
  const next = { ...s, weekKey: weekKey(), xp: s.xp + Math.max(0, amount) }
  saveSeason(next)
  return next
}

export function claimPassTier(profile: PlayerProfile): {
  profile: PlayerProfile
  season: SeasonState
  claimed: PassTier[]
} {
  let season = loadSeason()
  const claimed: PassTier[] = []
  let credits = profile.flightCredits
  const fragments = { ...season.fragments }
  const claimedIds = new Set(season.claimed)

  for (const tier of PASS_TIERS) {
    if (claimedIds.has(tier.id)) continue
    if (season.xp < tier.xp) continue
    claimedIds.add(tier.id)
    claimed.push(tier)
    if (tier.credits) credits += tier.credits
    if (tier.fragment && tier.fragmentCount > 0) {
      fragments[tier.fragment] =
        (fragments[tier.fragment] ?? 0) + tier.fragmentCount
    }
  }

  season = {
    ...season,
    claimed: Array.from(claimedIds),
    fragments,
  }
  saveSeason(season)

  // Auto-unlock skins with enough fragments
  const unlocked = new Set(profile.unlockedSkins)
  for (const [skin, n] of Object.entries(fragments)) {
    if ((n ?? 0) >= FRAGMENTS_TO_UNLOCK) {
      unlocked.add(skin as CraftSkinId)
    }
  }

  return {
    profile: {
      ...profile,
      flightCredits: credits,
      unlockedSkins: Array.from(unlocked) as CraftSkinId[],
      badges: unlocked.has('drone-gold') && !profile.badges.includes('sezon-pilot')
        ? [...profile.badges, 'sezon-pilot']
        : profile.badges,
    },
    season,
    claimed,
  }
}

/** Local top-10 consolation: if weekly score strong, grant a fragment once/week */
export function maybeWeeklyTopReward(
  weekly: WeeklyBest,
  rank: number | null,
): SeasonState {
  const season = loadSeason()
  const wk = weekKey()
  if (season.lastRewardWeek === wk) return season
  if (rank == null || rank > 10) return season
  if (weekly.bestMultiplier < 1.5) return season
  const fragments = { ...season.fragments }
  fragments['drone-gold'] = (fragments['drone-gold'] ?? 0) + 1
  const next = { ...season, fragments, lastRewardWeek: wk }
  saveSeason(next)
  return next
}

export function daysLeftInWeek(): number {
  const d = new Date()
  const day = d.getUTCDay() || 7 // 1 Mon … 7 Sun
  return 8 - day
}

export function seasonProgress(season: SeasonState): {
  xp: number
  next: PassTier | null
  pct: number
} {
  const next = PASS_TIERS.find((t) => !season.claimed.includes(t.id) && season.xp < t.xp)
    ?? PASS_TIERS.find((t) => !season.claimed.includes(t.id))
    ?? null
  if (!next) return { xp: season.xp, next: null, pct: 100 }
  const prevXp =
    PASS_TIERS.filter((t) => t.xp < next.xp).pop()?.xp ?? 0
  const span = next.xp - prevXp
  const pct = Math.min(100, ((season.xp - prevXp) / Math.max(1, span)) * 100)
  return { xp: season.xp, next, pct }
}

export { todayKey }
