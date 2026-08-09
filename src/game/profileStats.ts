/** Derived pilot stats for the profile screen. */

import type { FlightResult, PlayerProfile } from './types'
import { formatUsd, totalUsdBalance } from './stableEconomy'

export interface ProfileStats {
  winRate: number
  safeLandings: number
  crashes: number
  flights: number
  /** Net USDC PnL from history rows that have usdc fields */
  usdcPnl: number
  usdcFlights: number
  bestLayer: number
  bestMultiplier: number
  checkInStreak: number
  flightStreak: number
  walletUsd: number
  badgeCount: number
  craftCount: number
  skinCount: number
}

export function usdcDelta(h: FlightResult): number | null {
  if (h.usdcPayout != null && Number.isFinite(h.usdcPayout)) return h.usdcPayout
  if (h.usdcStake == null || !Number.isFinite(h.usdcStake)) return null
  if (h.outcome === 'crashed') return -Math.abs(h.usdcStake)
  return Math.abs(h.usdcStake) * (h.multiplier - 1)
}

export function computeProfileStats(profile: PlayerProfile): ProfileStats {
  const flights = profile.flights
  const safe = profile.safeLandings
  const crashes = profile.crashes
  const winRate = flights > 0 ? (safe / flights) * 100 : 0

  let usdcPnl = 0
  let usdcFlights = 0
  for (const h of profile.history) {
    const d = usdcDelta(h)
    if (d == null) continue
    usdcPnl += d
    usdcFlights += 1
  }

  return {
    winRate,
    safeLandings: safe,
    crashes,
    flights,
    usdcPnl,
    usdcFlights,
    bestLayer: profile.bestLayer,
    bestMultiplier: profile.bestMultiplier,
    checkInStreak: profile.checkInStreak,
    flightStreak: profile.streak,
    walletUsd: totalUsdBalance(profile.balances),
    badgeCount: profile.badges.length,
    craftCount: profile.unlockedCrafts.length,
    skinCount: profile.unlockedSkins.length,
  }
}

export function formatWinRate(pct: number): string {
  if (!Number.isFinite(pct)) return '—'
  return `${pct.toFixed(0)}%`
}

export function formatPnl(amount: number): string {
  if (!Number.isFinite(amount) || amount === 0) return formatUsd(0)
  const sign = amount > 0 ? '+' : '−'
  return `${sign}${formatUsd(Math.abs(amount))}`
}

export function formatPilotCode(id: string): string {
  if (!id) return '—'
  if (id.length <= 10) return id.toUpperCase()
  return `${id.slice(0, 4).toUpperCase()}…${id.slice(-4).toUpperCase()}`
}
