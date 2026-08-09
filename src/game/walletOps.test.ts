import { describe, expect, it } from 'vitest'
import { ASSETS, DEMO_PACK, emptyBalances } from './assets'
import {
  claimDemoPack,
  creditPayout,
  depositAsset,
  stakeForFlight,
  withdrawAsset,
} from './walletOps'
import type { PlayerProfile } from './types'

function baseProfile(over: Partial<PlayerProfile> = {}): PlayerProfile {
  return {
    displayName: 'Pilot',
    flights: 0,
    safeLandings: 0,
    crashes: 0,
    bestMultiplier: 0,
    bestLayer: 0,
    totalCashed: 0,
    streak: 0,
    lastFlightDate: null,
    flightCredits: 12,
    bombs: 1,
    lastBombGrantDate: null,
    badges: [],
    history: [],
    missions: [],
    missionDate: null,
    unlockedCrafts: ['drone'],
    unlockedSkins: ['drone-default'],
    selectedCraft: 'drone',
    selectedSkin: 'drone-default',
    walletAddress: null,
    walletVerified: false,
    balances: emptyBalances(),
    payAsset: 'usdt',
    payWithCrypto: true,
    stakeAmount: ASSETS.usdt.flightStake,
    demoPackClaimed: false,
    instantUsdcClaimed: true,
    highRoller: false,
    autoCashOut: 0,
    checkInDate: null,
    checkInStreak: 0,
    referredBy: null,
    referralClaimed: false,
    friendMilestonesClaimed: [],
    ...over,
  }
}

describe('walletOps', () => {
  it('claims demo pack once', () => {
    const p = baseProfile()
    const first = claimDemoPack(p)
    expect(first.ok).toBe(true)
    if (!first.ok) return
    expect(first.balances.usdt).toBe(DEMO_PACK.usdt)
    expect(first.profilePatch.demoPackClaimed).toBe(true)
    const second = claimDemoPack({ ...p, ...first.profilePatch, balances: first.balances })
    expect(second.ok).toBe(false)
  })

  it('deposits and withdraws USDT', () => {
    let p = baseProfile({ balances: { ...emptyBalances(), usdt: 10 } })
    const dep = depositAsset(p, 'usdt', 5)
    expect(dep.ok).toBe(true)
    if (!dep.ok) return
    p = { ...p, balances: dep.balances }
    expect(p.balances.usdt).toBe(15)
    const w = withdrawAsset(p, 'usdt', 3, 'So11111111111111111111111111111111111111112')
    expect(w.ok).toBe(true)
    if (!w.ok) return
    expect(w.balances.usdt).toBe(12)
  })

  it('stakes and pays out SOL', () => {
    const stake = ASSETS.sol.flightStake
    let p = baseProfile({
      balances: { ...emptyBalances(), sol: 1 },
      payAsset: 'sol',
      stakeAmount: stake,
    })
    const s = stakeForFlight(p, 'sol', stake)
    expect(s.ok).toBe(true)
    if (!s.ok) return
    p = { ...p, balances: s.balances }
    expect(p.balances.sol).toBeCloseTo(1 - stake)
    const pay = creditPayout(p, 'sol', stake * 2, 2)
    expect(pay.ok).toBe(true)
    if (!pay.ok) return
    expect(pay.balances.sol).toBeCloseTo(1 - stake + stake * 2)
  })

  it('rejects overdraw', () => {
    const p = baseProfile({ balances: emptyBalances() })
    expect(stakeForFlight(p, 'usdt', 1).ok).toBe(false)
    expect(withdrawAsset(p, 'btc', 0.001, 'bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh').ok).toBe(
      false,
    )
  })
})
