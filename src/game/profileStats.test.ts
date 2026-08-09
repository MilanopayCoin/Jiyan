import { describe, expect, it } from 'vitest'
import {
  computeProfileStats,
  formatPnl,
  formatPilotCode,
  formatWinRate,
  usdcDelta,
} from './profileStats'
import type { FlightResult, PlayerProfile } from './types'
import { emptyBalances } from './assets'

function flight(partial: Partial<FlightResult>): FlightResult {
  return {
    outcome: 'cashed',
    layer: 3,
    multiplier: 2,
    nearMissMultiplier: 2.2,
    timestamp: Date.now(),
    craftId: 'drone',
    skinId: 'drone-default',
    ...partial,
  }
}

function base(over: Partial<PlayerProfile> = {}): PlayerProfile {
  return {
    displayName: 'Pilot',
    flights: 10,
    safeLandings: 7,
    crashes: 3,
    bestMultiplier: 5,
    bestLayer: 6,
    totalCashed: 12,
    streak: 2,
    lastFlightDate: null,
    flightCredits: 3,
    bombs: 1,
    lastBombGrantDate: null,
    badges: ['yeni-pilot', 'irtifa-5'],
    history: [],
    missions: [],
    missionDate: null,
    unlockedCrafts: ['drone', 'plane'],
    unlockedSkins: ['drone-default'],
    selectedCraft: 'drone',
    selectedSkin: 'drone-default',
    walletAddress: null,
    walletVerified: false,
    balances: emptyBalances(),
    payAsset: 'usdc',
    payWithCrypto: true,
    stakeAmount: 1,
    demoPackClaimed: false,
    instantUsdcClaimed: true,
    highRoller: false,
    autoCashOut: 0,
    checkInDate: null,
    checkInStreak: 4,
    referredBy: null,
    referralClaimed: false,
    friendMilestonesClaimed: [],
    ...over,
  }
}

describe('profileStats', () => {
  it('computes win rate and wallet', () => {
    const p = base({
      balances: { ...emptyBalances(), usdc: 25, usdt: 5 },
    })
    const s = computeProfileStats(p)
    expect(s.winRate).toBe(70)
    expect(s.walletUsd).toBeCloseTo(30, 5)
    expect(s.badgeCount).toBe(2)
    expect(s.checkInStreak).toBe(4)
  })

  it('sums USDC pnl from history', () => {
    const p = base({
      history: [
        flight({ usdcPayout: 3.5 }),
        flight({ outcome: 'crashed', usdcPayout: -1 }),
        flight({ usdcStake: 2, outcome: 'cashed', multiplier: 2 }),
      ],
    })
    const s = computeProfileStats(p)
    expect(s.usdcFlights).toBe(3)
    // 3.5 - 1 + (2*(2-1)) = 4.5
    expect(s.usdcPnl).toBeCloseTo(4.5, 5)
  })

  it('usdcDelta falls back from stake', () => {
    expect(usdcDelta(flight({ usdcStake: 5, outcome: 'crashed' }))).toBe(-5)
    expect(
      usdcDelta(flight({ usdcStake: 5, outcome: 'cashed', multiplier: 3 })),
    ).toBe(10)
    expect(usdcDelta(flight({}))).toBeNull()
  })

  it('formats helpers', () => {
    expect(formatWinRate(70.4)).toBe('70%')
    expect(formatPnl(12.5)).toContain('+')
    expect(formatPnl(-3)).toContain('−')
    expect(formatPilotCode('pabc1234xyz')).toMatch(/…/)
  })
})
