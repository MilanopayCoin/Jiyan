import { describe, expect, it } from 'vitest'
import { mergeCloudBlob, toCloudBlob } from './cloudSync'
import type { PlayerProfile } from '../game/types'
import { emptyBalances } from '../game/assets'

function base(over: Partial<PlayerProfile> = {}): PlayerProfile {
  return {
    displayName: 'Pilot',
    flights: 0,
    safeLandings: 0,
    crashes: 0,
    bestMultiplier: 1.5,
    bestLayer: 2,
    totalCashed: 0,
    streak: 1,
    lastFlightDate: null,
    flightCredits: 3,
    bombs: 0,
    lastBombGrantDate: null,
    badges: ['yeni-pilot'],
    history: [],
    missions: [],
    missionDate: null,
    unlockedCrafts: ['drone'],
    unlockedSkins: ['drone-default'],
    selectedCraft: 'drone',
    selectedSkin: 'drone-default',
    walletAddress: null,
    walletVerified: false,
    balances: { ...emptyBalances(), usdc: 5 },
    payAsset: 'usdc',
    payWithCrypto: true,
    stakeAmount: 1,
    demoPackClaimed: false,
    instantUsdcClaimed: true,
    highRoller: false,
    autoCashOut: 0,
    checkInDate: null,
    checkInStreak: 0,
    referredBy: null,
    referralClaimed: false,
    friendMilestonesClaimed: [],
    starsBalance: 0,
    payWithStars: false,
    starsWelcomeClaimed: false,
    ...over,
  }
}

describe('telegram cloudSync', () => {
  it('round-trips compact blob', () => {
    const p = base({ streak: 4, flightCredits: 9, badges: ['yeni-pilot', 'irtifa-5'] })
    const blob = toCloudBlob(p)
    expect(blob.v).toBe(1)
    expect(blob.streak).toBe(4)
    expect(JSON.stringify(blob).length).toBeLessThan(4000)
  })

  it('merges taking maxima and union badges', () => {
    const local = base({ streak: 2, flightCredits: 1, bestMultiplier: 3 })
    const blob = toCloudBlob(
      base({
        displayName: 'Ada',
        streak: 5,
        flightCredits: 8,
        bestMultiplier: 2,
        badges: ['seri-ustasi'],
        balances: { ...emptyBalances(), usdc: 20 },
      }),
    )
    const merged = mergeCloudBlob(local, blob)
    expect(merged.displayName).toBe('Ada')
    expect(merged.streak).toBe(5)
    expect(merged.flightCredits).toBe(8)
    expect(merged.bestMultiplier).toBe(3)
    expect(merged.badges).toContain('seri-ustasi')
    expect(merged.balances.usdc).toBe(20)
  })
})
