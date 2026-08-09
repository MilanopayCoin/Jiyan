import { describe, expect, it, beforeEach, vi } from 'vitest'
import {
  canCheckIn,
  claimCheckIn,
  claimFriendMilestones,
  claimReferralJoin,
  nextCheckInDay,
  previewCheckIn,
  REFERRAL_JOIN_CREDITS,
  REFERRAL_JOIN_USDT,
} from './retention'
import { ASSETS, emptyBalances } from './assets'
import type { PlayerProfile } from './types'

function base(over: Partial<PlayerProfile> = {}): PlayerProfile {
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
    flightCredits: 10,
    bombs: 0,
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

describe('retention', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-08-07T12:00:00Z'))
  })

  it('claims first check-in', () => {
    const res = claimCheckIn(base())
    expect(res.ok).toBe(true)
    if (!res.ok) return
    expect(res.profile.flightCredits).toBe(12)
    expect(res.profile.checkInStreak).toBe(1)
    expect(canCheckIn(res.profile)).toBe(false)
  })

  it('continues streak from yesterday', () => {
    const p = base({ checkInDate: '2026-08-06', checkInStreak: 2 })
    expect(nextCheckInDay(2, '2026-08-06')).toBe(3)
    const res = claimCheckIn(p)
    expect(res.ok).toBe(true)
    if (!res.ok) return
    expect(res.profile.checkInStreak).toBe(3)
    expect(res.profile.bombs).toBe(1)
  })

  it('grants referral join once', () => {
    const first = claimReferralJoin(base(), 'pref1234')
    expect(first.ok).toBe(true)
    if (!first.ok) return
    expect(first.profile.balances.usdt).toBe(REFERRAL_JOIN_USDT)
    expect(first.profile.flightCredits).toBe(10 + REFERRAL_JOIN_CREDITS)
    expect(claimReferralJoin(first.profile, 'pref1234').ok).toBe(false)
  })

  it('pays friend milestones', () => {
    const m1 = claimFriendMilestones(base(), 1)
    expect(m1?.ok).toBe(true)
    if (!m1?.ok) return
    expect(m1.profile.friendMilestonesClaimed).toContain(1)
    const again = claimFriendMilestones(m1.profile, 1)
    expect(again).toBeNull()
    const m3 = claimFriendMilestones(m1.profile, 3)
    expect(m3?.ok).toBe(true)
    if (!m3?.ok) return
    expect(m3.profile.friendMilestonesClaimed).toEqual([1, 3])
  })

  it('previews next reward', () => {
    expect(previewCheckIn(base()).day).toBe(1)
  })
})
