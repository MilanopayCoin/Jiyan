import { describe, expect, it, beforeEach } from 'vitest'
import { ASSETS, emptyBalances } from './assets'
import {
  calcWithdrawFee,
  cancelWithdraw,
  creditOnChainDeposit,
  queueWithdraw,
  WITHDRAW_FEE_BPS,
} from './withdrawQueue'
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
    walletAddress: 'So11111111111111111111111111111111111111112',
    walletVerified: true,
    balances: { ...emptyBalances(), sol: 1, usdt: 100 },
    payAsset: 'sol',
    payWithCrypto: true,
    stakeAmount: ASSETS.sol.flightStake,
    demoPackClaimed: true,
    autoCashOut: 0,
    checkInDate: null,
    checkInStreak: 0,
    referredBy: null,
    referralClaimed: false,
    friendMilestonesClaimed: [],
    ...over,
  }
}

describe('withdrawQueue', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('calculates 2% fee with floor', () => {
    const { fee, net } = calcWithdrawFee('usdt', 10)
    expect(fee).toBe(Math.max(0.25, round2((10 * WITHDRAW_FEE_BPS) / 10_000)))
    expect(net).toBe(round2(10 - fee))
  })

  it('queues withdraw and refunds on cancel', () => {
    const p = base()
    const q = queueWithdraw(p, 'usdt', 10, 'So11111111111111111111111111111111111111112')
    expect(q.ok).toBe(true)
    if (!q.ok) return
    expect(q.balances.usdt).toBe(90)
    expect(q.request.net).toBeLessThan(10)
    const next = { ...p, balances: q.balances }
    const c = cancelWithdraw(next, q.request.id)
    expect(c.ok).toBe(true)
    if (!c.ok) return
    expect(c.balances.usdt).toBe(100)
  })

  it('credits on-chain SOL deposit', () => {
    const p = base({ balances: emptyBalances() })
    const res = creditOnChainDeposit(p, 0.05, 'sig123456789abcdef')
    expect(res.ok).toBe(true)
    if (!res.ok) return
    expect(res.balances.sol).toBe(0.05)
  })
})

function round2(n: number) {
  return Math.round(n * 100) / 100
}
